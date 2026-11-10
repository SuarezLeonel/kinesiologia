/**
 * @file auth_sessions_and_roles.test.js
 * @description Pruebas de integración para autenticación, gestión de sesiones,
 * rotación de refresh tokens, recuperación de sesión y control de acceso (401 vs 403).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { query, getPool } from '../src/config/database.js';

let testPatientUserId;
let testPatientId;
let testPatientEmail;
let testPatientPassword = 'PatientPass123!';
let testPatientTokens = {};

let adminTokens = {};
let kineTokens = {};
let recepTokens = {};

test.before(async () => {
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  testPatientEmail = `paciente.sesion.${uid}@test.com`;

  // 1. Crear paciente con usuario verificado
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(testPatientPassword, salt);

  const [roleRow] = await query("SELECT id FROM roles WHERE name = 'patient' LIMIT 1");
  const roleId = roleRow.id;

  const uRes = await query(`
    INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
    VALUES (?, 'Paciente', 'Prueba', ?, ?, 1, CURRENT_TIMESTAMP)
  `, [roleId, testPatientEmail, passwordHash]);
  testPatientUserId = uRes.insertId;

  const pRes = await query(`
    INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, user_id, is_active)
    VALUES ('Paciente', 'Prueba', ?, '1995-05-15', '1122334455', ?, ?, 1)
  `, [`DNI${uid.slice(-7)}`, testPatientEmail, testPatientUserId]);
  testPatientId = pRes.insertId;

  // Actualizar contraseñas de usuarios existentes conocidos para login directo
  const testPw = 'Password123!';
  const testHash = await bcrypt.hash(testPw, salt);
  await query('UPDATE users SET password_hash = ?, is_active = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id IN (1, 2, 3)', [testHash]);
});

test.after(async () => {
  if (testPatientUserId) {
    await query('DELETE FROM auth_refresh_tokens WHERE user_id = ?', [testPatientUserId]);
    await query('DELETE FROM patients WHERE id = ?', [testPatientId]);
    await query('DELETE FROM users WHERE id = ?', [testPatientUserId]);
  }
  const pool = getPool();
  await pool.end();
});

test('1. Iniciar sesión como paciente y acceder a todas sus secciones (dashboard, my-appointments, catalog, my-profile, my-routines)', async () => {
  // Login
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: testPatientEmail, password: testPatientPassword });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.body.success, true);
  assert.ok(loginRes.body.data.accessToken);
  assert.ok(loginRes.body.data.refreshToken);

  testPatientTokens = loginRes.body.data;
  const token = testPatientTokens.accessToken;

  // Acceder a las 5 secciones reportadas
  const sections = [
    '/api/v1/patient-portal/dashboard',
    '/api/v1/patient-portal/my-appointments',
    '/api/v1/patient-portal/catalog',
    '/api/v1/patient-portal/my-profile',
    '/api/v1/patient-portal/my-routines'
  ];

  for (const url of sections) {
    const res = await request(app)
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.strictEqual(res.status, 200, `Sección ${url} debe responder 200 OK para paciente autenticado`);
    assert.strictEqual(res.body.success, true);
  }
});

test('2. Iniciar sesión como administrador y acceder a módulos administrativos', async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'kinesiogestion58@gmail.com', password: 'Password123!' });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.body.data.user.role_name, 'admin');
  adminTokens = loginRes.body.data;

  // Acceso al dashboard administrativo
  const dashRes = await request(app)
    .post('/api/v1/dashboard/summary')
    .set('Authorization', `Bearer ${adminTokens.accessToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  assert.strictEqual(dashRes.body.success, true);
});

test('3. Iniciar sesión como kinesiólogo y acceder a sus secciones correspondientes', async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'carlos.kine@kinesiologia.com', password: 'Password123!' });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.body.data.user.role_name, 'kinesiologist');
  kineTokens = loginRes.body.data;

  // Acceso a agenda
  const apptsRes = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${kineTokens.accessToken}`)
    .send({});

  assert.strictEqual(apptsRes.status, 200);
});

test('4. Iniciar sesión como recepcionista y acceder a caja y turnos', async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'mariana.recep@kinesiologia.com', password: 'Password123!' });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.body.data.user.role_name, 'receptionist');
  recepTokens = loginRes.body.data;

  // Acceso a cobros y caja
  const paymentsRes = await request(app)
    .post('/api/v1/payments/search')
    .set('Authorization', `Bearer ${recepTokens.accessToken}`)
    .send({});

  assert.strictEqual(paymentsRes.status, 200);
});

test('5. Navegar entre distintas secciones sin recibir errores 401', async () => {
  const token = testPatientTokens.accessToken;

  // Simulación de navegación consecutiva entre las 5 secciones
  const flow = [
    '/api/v1/patient-portal/dashboard',
    '/api/v1/patient-portal/catalog',
    '/api/v1/patient-portal/my-appointments',
    '/api/v1/patient-portal/my-routines',
    '/api/v1/patient-portal/my-profile',
    '/api/v1/patient-portal/dashboard'
  ];

  for (const endpoint of flow) {
    const res = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.notStrictEqual(res.status, 401, `Navegación a ${endpoint} no debe fallar con 401`);
    assert.strictEqual(res.status, 200);
  }
});

test('6. Actualizar la página manteniendo la sesión (recuperación de token y validez)', async () => {
  // Simulando que el frontend recarga la página: verifica que el token almacenado sigue siendo válido
  const token = testPatientTokens.accessToken;
  const decoded = jwt.decode(token);
  assert.ok(decoded);
  assert.strictEqual(decoded.userId, testPatientUserId);
  assert.ok(decoded.exp * 1000 > Date.now());

  // Consulta posterior al reload
  const res = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${token}`)
    .send({});

  assert.strictEqual(res.status, 200);
});

test('7. Simular la expiración del access token (rechazo con 401)', async () => {
  // Crear token de acceso deliberadamente expirado (exp = hace 10 minutos)
  const expiredToken = jwt.sign(
    { type: 'access', userId: testPatientUserId, role: 'patient' },
    config.jwt.accessSecret,
    { expiresIn: '-10m' }
  );

  const res = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${expiredToken}`)
    .send({});

  assert.strictEqual(res.status, 401, 'Token expirado debe ser rechazado con 401 Unauthorized');
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
});

test('8. Comprobar la renovación de la sesión con refresh token (rotación y nuevo token válido)', async () => {
  const currentRefreshToken = testPatientTokens.refreshToken;

  const refreshRes = await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: currentRefreshToken });

  assert.strictEqual(refreshRes.status, 200);
  assert.strictEqual(refreshRes.body.success, true);
  assert.ok(refreshRes.body.data.accessToken);
  assert.ok(refreshRes.body.data.refreshToken);

  const newAccessToken = refreshRes.body.data.accessToken;
  const newRefreshToken = refreshRes.body.data.refreshToken;
  assert.notStrictEqual(newRefreshToken, currentRefreshToken, 'Refresh token debe rotar en cada renovación');

  // Actualizar tokens del paciente para siguientes pruebas
  testPatientTokens.accessToken = newAccessToken;
  testPatientTokens.refreshToken = newRefreshToken;

  // Acceder con el nuevo token renovado a las secciones
  const testRes = await request(app)
    .post('/api/v1/patient-portal/my-appointments')
    .set('Authorization', `Bearer ${newAccessToken}`)
    .send({});

  assert.strictEqual(testRes.status, 200);
});

test('9. Comprobar que un usuario sin permisos reciba un 403 Forbidden (RBAC estricto)', async () => {
  // A. Recepcionista intentando acceder a historias clínicas -> 403
  const recepClinRes = await request(app)
    .post('/api/v1/clinical-records/search')
    .set('Authorization', `Bearer ${recepTokens.accessToken}`)
    .send({});
  assert.strictEqual(recepClinRes.status, 403, 'Recepcionista en historias clínicas debe recibir 403 Forbidden');
  assert.strictEqual(recepClinRes.body.error.code, 'FORBIDDEN');

  // B. Kinesiólogo intentando acceder a cobros administrativos -> 403
  const kinePayRes = await request(app)
    .post('/api/v1/payments/search')
    .set('Authorization', `Bearer ${kineTokens.accessToken}`)
    .send({});
  assert.strictEqual(kinePayRes.status, 403, 'Kinesiólogo en cobros administrativos debe recibir 403 Forbidden');
  assert.strictEqual(kinePayRes.body.error.code, 'FORBIDDEN');

  // C. Paciente intentando acceder al dashboard administrativo -> 403
  const patAdminRes = await request(app)
    .post('/api/v1/dashboard/summary')
    .set('Authorization', `Bearer ${testPatientTokens.accessToken}`)
    .send({});
  assert.strictEqual(patAdminRes.status, 403, 'Paciente en dashboard administrativo debe recibir 403 Forbidden');

  // D. Administrador intentando acceder al portal de paciente -> 403
  const adminPatRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${adminTokens.accessToken}`)
    .send({});
  assert.strictEqual(adminPatRes.status, 403, 'Administrador en portal exclusivo de paciente debe recibir 403 Forbidden');
});

test('10. Cerrar sesión y verificar que no se pueda acceder a las rutas protegidas (401)', async () => {
  const tokenToLogout = testPatientTokens.refreshToken;

  // Logout
  const logoutRes = await request(app)
    .post('/api/v1/auth/logout')
    .send({ refreshToken: tokenToLogout });

  assert.strictEqual(logoutRes.status, 200);
  assert.strictEqual(logoutRes.body.success, true);

  // Intentar refrescar con el token recién revocado -> 401
  const reattemptRefresh = await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: tokenToLogout });

  assert.strictEqual(reattemptRefresh.status, 401, 'Refresh token revocado tras logout debe devolver 401');

  // Acceder a rutas protegidas sin token -> 401
  const unauthRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .send({});

  assert.strictEqual(unauthRes.status, 401);
  assert.strictEqual(unauthRes.body.error.code, 'UNAUTHORIZED');
});
