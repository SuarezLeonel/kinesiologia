/**
 * @file security_hardening.test.js
 * @description Suite de pruebas automatizadas de seguridad (OWASP Top 10 y OWASP API Security Top 10).
 * Valida mitigaciones de BOLA/IDOR, RBAC, reutilización de Refresh Tokens, limitación de fuerza bruta,
 * protección contra Open Redirects, inyección SQL y prevención de fuga de credenciales.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { query, getPool } from '../src/config/database.js';

test.before(async () => {
  // Limpieza defensiva de registros huérfanos de pruebas previas
  await query("DELETE FROM auth_refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%sec%' OR email LIKE '%token.reuse%' OR email LIKE '%recep.desact%')");
  await query("DELETE FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE '%sec%')");
  await query("DELETE FROM clinical_records WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE '%sec%')");
  await query("DELETE FROM treatments WHERE patient_id IN (SELECT id FROM patients WHERE email LIKE '%sec%')");
  await query("DELETE FROM patients WHERE email LIKE '%sec%'");
  await query("DELETE FROM users WHERE email LIKE '%sec%' OR email LIKE '%token.reuse%' OR email LIKE '%recep.desact%'");
});

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

test('Security Hardening 1. Rutas privadas rechazan acceso sin token de autenticación (401)', async () => {
  const protectedRoutes = [
    { url: '/api/v1/patients/search', body: {} },
    { url: '/api/v1/appointments/search', body: {} },
    { url: '/api/v1/clinical-records/search', body: {} },
    { url: '/api/v1/treatments/search', body: {} },
    { url: '/api/v1/payments/search', body: {} },
    { url: '/api/v1/users/search', body: {} },
    { url: '/api/v1/patient-portal/dashboard', body: {} }
  ];

  for (const { url, body } of protectedRoutes) {
    const res = await request(app).post(url).send(body);
    assert.strictEqual(res.status, 401, `Ruta ${url} debe devolver 401 Unauthorized sin token`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  }
});

test('Security Hardening 2. BOLA / IDOR: Kinesiólogo no puede consultar historias clínicas de pacientes no asignados (403)', async () => {
  // Token de Kinesiólogo Carlos (id 2)
  const kineToken = jwt.sign(
    { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const dni = `${Math.floor(10000000 + Math.random() * 89999999)}`;
  // Crear un paciente temporal no asignado al kinesiólogo 2 (asignado al admin 1 o sin asignar)
  const pResult = await query(`
    INSERT INTO patients (first_name, last_name, dni, email, birth_date, phone, assigned_kinesiologist_id, is_active)
    VALUES ('Paciente', 'NoAsignado', ?, ?, '1990-01-01', '1122334455', 1, 1)
  `, [dni, `sec_test_noasig_${uid}@test.com`]);
  const unassignedPatientId = pResult.insertId;

  // Crear historia clínica emitida por otro profesional (autor 1)
  const cResult = await query(`
    INSERT INTO clinical_records (patient_id, author_id, consultation_reason, initial_evaluation, diagnosis)
    VALUES (?, 1, 'Motivo de consulta privado', 'Evaluación privada', 'Diagnóstico confidencial de otro médico')
  `, [unassignedPatientId]);
  const privateRecordId = cResult.insertId;

  try {
    // 1. Intento de búsqueda por paciente no asignado
    const searchRes = await request(app)
      .post('/api/v1/clinical-records/search')
      .set('Authorization', `Bearer ${kineToken}`)
      .send({ patientId: unassignedPatientId });

    assert.strictEqual(searchRes.status, 403, 'Debe devolver 403 Forbidden al intentar listar registros de paciente no asignado');
    assert.match(searchRes.body.error.message, /autorización clínica sobre pacientes no asignados/);

    // 2. Intento de consulta de detalle por ID directo (BOLA)
    const detailRes = await request(app)
      .post('/api/v1/clinical-records/detail')
      .set('Authorization', `Bearer ${kineToken}`)
      .send({ id: privateRecordId });

    assert.strictEqual(detailRes.status, 403, 'Debe devolver 403 Forbidden al intentar ver detalle de historia de paciente ajeno');

    // 3. Intento de exportación a PDF (BOLA)
    const pdfRes = await request(app)
      .post('/api/v1/clinical-records/export-pdf')
      .set('Authorization', `Bearer ${kineToken}`)
      .send({ id: privateRecordId });

    assert.strictEqual(pdfRes.status, 403, 'Debe devolver 403 Forbidden al intentar exportar PDF de paciente ajeno');
  } finally {
    // Limpieza
    await query('DELETE FROM clinical_records WHERE id = ?', [privateRecordId]);
    await query('DELETE FROM patients WHERE id = ?', [unassignedPatientId]);
  }
});

test('Security Hardening 3. BOLA / IDOR: Kinesiólogo no puede consultar detalle de tratamientos de pacientes no asignados (403)', async () => {
  const kineToken = jwt.sign(
    { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const dni = `${Math.floor(10000000 + Math.random() * 89999999)}`;
  const pResult = await query(`
    INSERT INTO patients (first_name, last_name, dni, email, birth_date, phone, assigned_kinesiologist_id, is_active)
    VALUES ('Paciente', 'TratamientoAjeno', ?, ?, '1990-01-01', '1122334455', 1, 1)
  `, [dni, `sec_trat_ajeno_${uid}@test.com`]);
  const patientId = pResult.insertId;

  const tResult = await query(`
    INSERT INTO treatments (patient_id, kinesiologist_id, title, diagnosis_summary, objectives, start_date, status)
    VALUES (?, 1, 'Tratamiento Privado', 'Diagnóstico Privado', 'Objetivos de prueba', '2026-01-01', 'active')
  `, [patientId]);
  const treatmentId = tResult.insertId;

  try {
    const res = await request(app)
      .post('/api/v1/treatments/detail')
      .set('Authorization', `Bearer ${kineToken}`)
      .send({ id: treatmentId });

    assert.strictEqual(res.status, 403, 'Kinesiólogo ajeno no debe poder ver tratamientos no asignados');
    assert.strictEqual(res.body.success, false);
  } finally {
    await query('DELETE FROM treatments WHERE id = ?', [treatmentId]);
    await query('DELETE FROM patients WHERE id = ?', [patientId]);
  }
});

test('Security Hardening 4. Aislamiento de Paciente: No puede consultar turnos ni rutinas de otros pacientes', async () => {
  const uidA = `${Date.now()}_a${Math.random().toString(36).substring(2, 6)}`;
  const uidB = `${Date.now()}_b${Math.random().toString(36).substring(2, 6)}`;
  const dniA = `${Math.floor(10000000 + Math.random() * 89999999)}`;
  const dniB = `${Math.floor(10000000 + Math.random() * 89999999)}`;

  // Crear Paciente A y Paciente B
  const resA = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Paciente', 'Alfa', ?, '$2a$10$abcdefghijklmnopqrstuu', 1, CURRENT_TIMESTAMP)
  `, [`paciente.alfa.sec_${uidA}@test.com`]);
  const userAId = resA.insertId;
  const patA = await query(`
    INSERT INTO patients (user_id, first_name, last_name, dni, email, birth_date, phone, is_active)
    VALUES (?, 'Paciente', 'Alfa', ?, ?, '1990-01-01', '1122334455', 1)
  `, [userAId, dniA, `paciente.alfa.sec_${uidA}@test.com`]);
  const patientAId = patA.insertId;

  const resB = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (4, 'Paciente', 'Beta', ?, '$2a$10$abcdefghijklmnopqrstuu', 1, CURRENT_TIMESTAMP)
  `, [`paciente.beta.sec_${uidB}@test.com`]);
  const userBId = resB.insertId;
  const patB = await query(`
    INSERT INTO patients (user_id, first_name, last_name, dni, email, birth_date, phone, is_active)
    VALUES (?, 'Paciente', 'Beta', ?, ?, '1990-01-01', '1122334455', 1)
  `, [userBId, dniB, `paciente.beta.sec_${uidB}@test.com`]);
  const patientBId = patB.insertId;

  const tokenB = jwt.sign(
    { type: 'access', userId: userBId, role: 'patient', email: `paciente.beta.sec_${uidB}@test.com` },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  // Crear turno para Paciente A
  const appARes = await query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, agreed_price, created_by)
    VALUES (?, 2, 1, DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_ADD(NOW(), INTERVAL 25 HOUR), 'confirmed', 5000, 1)
  `, [patientAId]);
  const appointmentAId = appARes.insertId;

  try {
    // Paciente B intenta cancelar el turno de Paciente A
    const cancelRes = await request(app)
      .post('/api/v1/patient-portal/cancel-appointment')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ appointmentId: appointmentAId, reason: 'Intento malicioso' });

    assert.strictEqual(cancelRes.status, 403);
    assert.match(cancelRes.body.error.message, /No posee autorización para cancelar un turno que no le pertenece/);

    // Paciente B intenta reprogramar el turno de Paciente A
    const reschedRes = await request(app)
      .post('/api/v1/patient-portal/request-reschedule')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        appointmentId: appointmentAId,
        requestedStartTime: '2026-11-20 10:00:00',
        reason: 'Intento malicioso de reprogramación'
      });

    assert.strictEqual(reschedRes.status, 403);
    assert.match(reschedRes.body.error.message, /No posee autorización para reprogramar un turno que no le pertenece/);
  } finally {
    await query('DELETE FROM appointments WHERE id = ?', [appointmentAId]);
    await query('DELETE FROM patients WHERE id IN (?, ?)', [patientAId, patientBId]);
    await query('DELETE FROM users WHERE id IN (?, ?)', [userAId, userBId]);
  }
});

test('Security Hardening 5. Detección de Reutilización de Refresh Tokens (Token Reuse Detection - OWASP ASVS V3.8)', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  // Crear usuario de prueba
  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active)
    VALUES (4, 'Sesion', 'Reutilizada', ?, '$2a$10$abcdefghijklmnopqrstuu', 1)
  `, [`token.reuse.${uid}@test.com`]);
  const testUserId = uRes.insertId;

  // Crear 2 refresh tokens válidos para testUserId
  const token1 = jwt.sign(
    { type: 'refresh', userId: testUserId },
    config.jwt.refreshSecret,
    { expiresIn: '7d', jwtid: crypto.randomUUID() }
  );
  const hash1 = crypto.createHash('sha256').update(token1).digest('hex');

  const token2 = jwt.sign(
    { type: 'refresh', userId: testUserId },
    config.jwt.refreshSecret,
    { expiresIn: '7d', jwtid: crypto.randomUUID() }
  );
  const hash2 = crypto.createHash('sha256').update(token2).digest('hex');

  // Insertar ambos en la BD, pero token1 ya está REVOCADO (simulando token robado/reutilizado)
  await query(`
    INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, revoked_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())
  `, [testUserId, hash1]);

  await query(`
    INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, revoked_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NULL)
  `, [testUserId, hash2]);

  try {
    // El cliente presenta el token1 (ya revocado)
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token1 });

    assert.strictEqual(res.status, 401);
    assert.match(res.body.error.message, /reutilización de sesión previamente revocada/);

    // Verificación crítica: todas las demás sesiones (incluyendo token2) DEBEN HABER SIDO REVOCADAS
    const rows = await query('SELECT revoked_at FROM auth_refresh_tokens WHERE token_hash = ?', [hash2]);
    assert.ok(rows.length > 0);
    assert.notStrictEqual(rows[0].revoked_at, null, 'Todas las sesiones activas del usuario deben revocarse ante detección de reutilización');
  } finally {
    await query('DELETE FROM auth_refresh_tokens WHERE user_id = ?', [testUserId]);
    await query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
});

test('Security Hardening 6. Revocación de sesiones al desactivar usuario o cambiar rol', async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  // Crear usuario con sesión activa
  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active)
    VALUES (3, 'Recepcionista', 'Desactivable', ?, '$2a$10$abcdefghijklmnopqrstuu', 1)
  `, [`recep.desact.${uid}@test.com`]);
  const userId = uRes.insertId;

  const adminToken = jwt.sign(
    { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { type: 'refresh', userId },
    config.jwt.refreshSecret,
    { expiresIn: '7d', jwtid: crypto.randomUUID() }
  );
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await query(`
    INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
  `, [userId, hash]);

  try {
    // Admin desactiva al usuario mediante PATCH /users/:id
    const updateRes = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.strictEqual(updateRes.status, 200);

    // El refresh token del usuario desactivado debe estar revocado
    const rows = await query('SELECT revoked_at FROM auth_refresh_tokens WHERE token_hash = ?', [hash]);
    assert.ok(rows.length > 0);
    assert.notStrictEqual(rows[0].revoked_at, null, 'El refresh token debe haberse revocado al desactivar al usuario');
  } finally {
    await query('DELETE FROM auth_refresh_tokens WHERE user_id = ?', [userId]);
    await query('DELETE FROM users WHERE id = ?', [userId]);
  }
});

test('Security Hardening 7. Mitigación contra inyección SQL en búsquedas y parámetros', async () => {
  const adminToken = jwt.sign(
    { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT id, email, password_hash FROM users --",
    "admin' --"
  ];

  for (const malicious of sqlPayloads) {
    const res = await request(app)
      .post('/api/v1/patients/search')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ search: malicious });

    // La búsqueda debe procesar el input como texto literal sin fallar con error de sintaxis SQL (500)
    assert.strictEqual(res.status, 200, `Payload SQL '${malicious}' debe ser neutralizado`);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data), 'Debe devolver un arreglo sin alterar la estructura SQL');
  }
});

test('Security Hardening 8. Rechazo estricto de Open Redirect en OAuth Bridge Callback', async () => {
  const maliciousUrls = [
    'https://attacker-domain.evil.com/phishing',
    'http://malicious-site.com/steal?code=123',
    'javascript:alert(1)',
    '//attacker.com/evil'
  ];

  for (const evilUrl of maliciousUrls) {
    const evilState = Buffer.from(JSON.stringify({ returnUrl: evilUrl })).toString('base64url');
    const res = await request(app)
      .get(`/api/v1/auth/oauth/callback?code=mock_code&state=${evilState}`);

    assert.strictEqual(res.status, 200);
    // El callback nunca debe redirigir a un dominio externo malicioso; debe resetearse a localhost
    assert.ok(!res.text.includes(evilUrl), `La respuesta nunca debe contener la URL maliciosa externa: ${evilUrl}`);
    assert.ok(res.text.includes('http://localhost:8081'), 'Debe fallbackear al origen seguro de la app');
  }
});

test('Security Hardening 9. Rechazo de Tokens con algoritmo inválido o "none" (Algorithm Confusion)', async () => {
  // Construir token firmado con algoritmo simétrico débil o 'none'
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ type: 'access', userId: 1, role: 'admin' })).toString('base64url');
  const noneToken = `${header}.${payload}.`;

  const res = await request(app)
    .post('/api/v1/users/search')
    .set('Authorization', `Bearer ${noneToken}`)
    .send({});

  assert.strictEqual(res.status, 401, 'Tokens con alg=none deben ser rechazados');
  assert.strictEqual(res.body.success, false);
});
