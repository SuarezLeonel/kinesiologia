/**
 * @file email_verification.test.js
 * @description Suite de pruebas automatizadas para verificación obligatoria de correo electrónico en registro.
 * Valida creación de cuentas pendientes, rechazo de login sin verificación, generación criptográfica de tokens,
 * validación de expiración (30m), un solo uso, reenvío, mitigación de enumeración y prevención de escalada de roles.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query, getPool } from '../src/config/database.js';

test.before(async () => {
  // Limpieza previa defensiva de usuarios de prueba de verificación
  await query("DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%verify.test%')");
  await query("DELETE FROM patients WHERE email LIKE '%verify.test%'");
  await query("DELETE FROM users WHERE email LIKE '%verify.test%'");
});

test.after(async () => {
  // Limpieza final y cierre de pool
  await query("DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%verify.test%')");
  await query("DELETE FROM patients WHERE email LIKE '%verify.test%'");
  await query("DELETE FROM users WHERE email LIKE '%verify.test%'");
  const pool = getPool();
  await pool.end();
});

test('Email Verification 1. Registro crea cuenta pendiente sin emitir tokens de acceso', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `patient.verify.test_${uid}@example.com`;
  const dni = `${Math.floor(10000000 + Math.random() * 89999999)}`;

  const res = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Marcos',
      lastName: 'Pendiente',
      email,
      password: 'StrongPassword123!',
      dni,
      phone: '+5491155556666'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.requiresVerification, true, 'Debe indicar que requiere verificación obligatoria');
  assert.strictEqual(res.body.data.tokens, undefined, 'No debe emitir tokens de sesión antes de verificar');

  const userId = res.body.data.user.id;
  assert.ok(userId);

  // Verificar en la base de datos que la cuenta está inactiva y no verificada
  const userRows = await query('SELECT is_active, email_verified_at FROM users WHERE id = ?', [userId]);
  assert.strictEqual(userRows.length, 1);
  assert.strictEqual(userRows[0].is_active, 0, 'La cuenta debe estar inactiva (is_active = 0)');
  assert.strictEqual(userRows[0].email_verified_at, null, 'email_verified_at debe ser NULL');

  // Verificar que se guardó el hash del token en email_verification_tokens
  const tokenRows = await query('SELECT id, token_hash, expires_at, used_at FROM email_verification_tokens WHERE user_id = ?', [userId]);
  assert.strictEqual(tokenRows.length, 1);
  assert.strictEqual(tokenRows[0].used_at, null);
  assert.ok(tokenRows[0].token_hash.length >= 64, 'El hash sha256 debe tener al menos 64 caracteres hex');
});

test('Email Verification 2. Bloqueo de inicio de sesión antes de verificar el correo (403 EMAIL_NOT_VERIFIED)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `unverified.verify.test_${uid}@example.com`;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // Crear usuario directamente pendiente de verificación
  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'No', 'Verificado', ?, ?, 0, NULL)
  `, [email, passwordHash]);
  const userId = uRes.insertId;

  try {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'Password123!'
      });

    assert.strictEqual(res.status, 403, 'Debe rechazar con 403 Forbidden');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'EMAIL_NOT_VERIFIED');
    assert.match(res.body.error.message, /verificar tu correo electrónico/i);
    assert.strictEqual(res.body.data, undefined, 'No debe retornar datos de sesión');
  } finally {
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});

test('Email Verification 3. Rechazo de tokens inválidos o adulterados (401)', async () => {
  const res = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({
      token: 'token_completamente_falso_y_adulterado_123456789'
    });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /inválido o no existe/i);
});

test('Email Verification 4. Rechazo de tokens expirados (validez de 30 minutos)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `expired.verify.test_${uid}@example.com`;

  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Expirado', 'Token', ?, '$2a$10$abcdefghijklmnopqrstuu', 0, NULL)
  `, [email]);
  const userId = uRes.insertId;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Insertar con expiración en el pasado (-1 hora)
  const pastDate = new Date(Date.now() - 3600 * 1000);
  await query(`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `, [userId, tokenHash, pastDate]);

  try {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error.message, /ha expirado/i);

    // El usuario debe seguir sin verificar
    const check = await query('SELECT email_verified_at FROM users WHERE id = ?', [userId]);
    assert.strictEqual(check[0].email_verified_at, null);
  } finally {
    await query('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});

test('Email Verification 5. Verificación exitosa mediante token válido activa cuenta y permite login', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `valido.verify.test_${uid}@example.com`;
  const dni = `${Math.floor(10000000 + Math.random() * 89999999)}`;

  // 1. Registro
  const regRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Paciente',
      lastName: 'Valido',
      email,
      password: 'Password123!',
      dni
    });

  assert.strictEqual(regRes.status, 201);
  const userId = regRes.body.data.user.id;

  // 2. Obtener el hash almacenado para este usuario
  const rows = await query('SELECT id, token_hash FROM email_verification_tokens WHERE user_id = ?', [userId]);
  assert.strictEqual(rows.length, 1);

  // Para simular la posesión del token de correo legítimo, creamos un token conocido
  const legitimateRawToken = crypto.randomBytes(32).toString('hex');
  const legitimateHash = crypto.createHash('sha256').update(legitimateRawToken).digest('hex');
  await query('UPDATE email_verification_tokens SET token_hash = ? WHERE id = ?', [legitimateHash, rows[0].id]);

  // 3. Ejecutar verificación vía POST /auth/verify-email
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ token: legitimateRawToken });

  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.body.success, true);
  assert.match(verifyRes.body.message, /cuenta fue verificada/i);

  // 4. Comprobar que en BD el usuario está activo y con fecha de verificación
  const userCheck = await query('SELECT is_active, email_verified_at FROM users WHERE id = ?', [userId]);
  assert.strictEqual(userCheck[0].is_active, 1, 'Usuario debe estar activo tras verificar');
  assert.notStrictEqual(userCheck[0].email_verified_at, null, 'email_verified_at debe contener fecha');

  // 5. Comprobar que el token se marcó como usado
  const tokenCheck = await query('SELECT used_at FROM email_verification_tokens WHERE id = ?', [rows[0].id]);
  assert.notStrictEqual(tokenCheck[0].used_at, null, 'used_at no debe ser null');

  // 6. Ahora el inicio de sesión debe funcionar exitosamente
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email,
      password: 'Password123!'
    });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.body.success, true);
  assert.ok(loginRes.body.data.accessToken, 'Debe emitir accessToken');
});

test('Email Verification 6. Token de un solo uso: rechazo al intentar verificar dos veces (One-time use)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `double.verify.test_${uid}@example.com`;

  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Doble', 'Uso', ?, '$2a$10$abcdefghijklmnopqrstuu', 1, NOW())
  `, [email]);
  const userId = uRes.insertId;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Token ya marcado como used_at
  await query(`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, used_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), NOW())
  `, [userId, tokenHash]);

  try {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken });

    assert.strictEqual(res.status, 401);
    assert.match(res.body.error.message, /ya fue utilizado/i);
  } finally {
    await query('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});

test('Email Verification 7. Reenvío de correo genera nuevo token e invalida el anterior', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `resend.verify.test_${uid}@example.com`;

  // 1. Crear usuario pendiente de verificación
  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Reenvio', 'Test', ?, '$2a$10$abcdefghijklmnopqrstuu', 0, NULL)
  `, [email]);
  const userId = uRes.insertId;

  const oldRawToken = crypto.randomBytes(32).toString('hex');
  const oldHash = crypto.createHash('sha256').update(oldRawToken).digest('hex');
  await query(`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))
  `, [userId, oldHash]);

  try {
    // 2. Solicitar reenvío
    const resendRes = await request(app)
      .post('/api/v1/auth/resend-verification-email')
      .send({ email });

    assert.strictEqual(resendRes.status, 200);
    assert.strictEqual(resendRes.body.success, true);

    // 3. Verificar que el token anterior fue eliminado o reemplazado en BD
    const currentTokens = await query('SELECT token_hash FROM email_verification_tokens WHERE user_id = ?', [userId]);
    assert.strictEqual(currentTokens.length, 1);
    assert.notStrictEqual(currentTokens[0].token_hash, oldHash, 'El hash antiguo debe haber sido invalidado');

    // 4. Intentar verificar con el token viejo debe fallar
    const oldVerifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: oldRawToken });

    assert.strictEqual(oldVerifyRes.status, 401);
  } finally {
    await query('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});

test('Email Verification 8. Protección contra enumeración de cuentas en reenvío de correo', async () => {
  const fakeEmail = `nonexistent_${Date.now()}@example.com`;

  const res = await request(app)
    .post('/api/v1/auth/resend-verification-email')
    .send({ email: fakeEmail });

  // No debe responder 404 ni revelar si el email existe
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.match(res.body.message, /Si la dirección de correo corresponde/i);
});

test('Email Verification 9. Registro público crea exclusivamente rol PACIENTE (previene escalada de privilegios)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `privilege.escalation.test_${uid}@example.com`;
  const dni = `${Math.floor(10000000 + Math.random() * 89999999)}`;

  const res = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Intento',
      lastName: 'Hacker',
      email,
      password: 'StrongPassword123!',
      dni,
      role: 'admin',
      roleId: 1
    });

  assert.strictEqual(res.status, 201);
  const userId = res.body.data.user.id;

  // En la base de datos, el rol debe ser estrictamente 4 (paciente)
  const userRow = await query('SELECT role_id FROM users WHERE id = ?', [userId]);
  assert.strictEqual(userRow[0].role_id, 4, 'El rol debe ser estrictamente paciente (4), nunca admin (1)');

  await query('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
  await query('DELETE FROM patients WHERE email = ?', [email]);
  await query('DELETE FROM users WHERE id = ?', [userId]);
});

test('Email Verification 10. Endpoint web GET /auth/verify-email (clic desde cliente de correo)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const email = `web.click.verify.test_${uid}@example.com`;

  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Web', 'Click', ?, '$2a$10$abcdefghijklmnopqrstuu', 0, NULL)
  `, [email]);
  const userId = uRes.insertId;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await query(`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))
  `, [userId, tokenHash]);

  try {
    const res = await request(app)
      .get(`/api/v1/auth/verify-email?token=${rawToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.ok(res.text.includes('¡Tu cuenta fue verificada!'));
    assert.ok(res.text.includes('KinesioGestión'));

    // Usuario ahora activo
    const check = await query('SELECT is_active, email_verified_at FROM users WHERE id = ?', [userId]);
    assert.strictEqual(check[0].is_active, 1);
    assert.notStrictEqual(check[0].email_verified_at, null);
  } finally {
    await query('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});
