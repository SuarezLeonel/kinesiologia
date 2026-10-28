import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { getPool } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

test('1. Comprobación de Regla HTTP: Ningún endpoint de negocio permite GET (405 Method Not Allowed)', async (t) => {
  const businessRoutes = [
    '/api/v1/patients/search',
    '/api/v1/patients/detail',
    '/api/v1/appointments/search',
    '/api/v1/appointments/detail',
    '/api/v1/clinical-records/search',
    '/api/v1/users/search',
    '/api/v1/dashboard/summary'
  ];

  for (const route of businessRoutes) {
    const res = await request(app).get(route);
    assert.strictEqual(
      res.status,
      405,
      `La ruta ${route} no debe responder a solicitudes GET y debe devolver 405 Method Not Allowed`
    );
  }
});

test('2. Validación de entradas (Zod) en /api/v1/auth/login', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'email_invalido', password: '' });

  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
});

test('3. Seguridad de autenticación: Acceso protegido sin Token rechaza con 401', async () => {
  const res = await request(app)
    .post('/api/v1/patients/search')
    .send({});

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

test('4. Seguridad de roles: Recepcionista bloqueada en historias clínicas (403)', async () => {
  // Simular token válido de recepcionista
  const receptionistToken = jwt.sign(
    { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/clinical-records/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ patientId: 1 });

  assert.strictEqual(res.status, 403);
});

test('4b. El rol se toma de la BD: token que declara admin para un usuario recepcionista sigue en 403', async () => {
  const forgedToken = jwt.sign(
    { type: 'access', userId: 3, role: 'admin', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/clinical-records/search')
    .set('Authorization', `Bearer ${forgedToken}`)
    .send({ patientId: 1 });

  assert.strictEqual(res.status, 403);
});

test('4c. Tokens sin type=access (p. ej. de reseteo) son rechazados con 401', async () => {
  const noType = jwt.sign({ userId: 1, role: 'admin' }, config.jwt.accessSecret, { expiresIn: '15m' });
  const resetLike = jwt.sign(
    { userId: 1, purpose: 'reset-password' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  for (const token of [noType, resetLike]) {
    const res = await request(app)
      .post('/api/v1/patients/search')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.strictEqual(res.status, 401);
  }
});

test('4d. JSON malformado responde 400 (no 500)', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email": ');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, 'INVALID_JSON');
});

test('5. Formato consistente de error 404 para rutas inexistentes', async () => {
  const res = await request(app).post('/api/v1/ruta_que_no_existe').send({});
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'ROUTE_NOT_FOUND');
});

test('6. Ejercicios y Pagos: Bloqueo de solicitudes GET (405 Method Not Allowed)', async () => {
  const exGet = await request(app).get('/api/v1/exercises/search');
  assert.strictEqual(exGet.status, 405);

  const payGet = await request(app).get('/api/v1/payments/search');
  assert.strictEqual(payGet.status, 405);
});

test('7. Control de acceso: Kinesiólogo bloqueado en módulo de cobros administrativos (403)', async () => {
  const kineToken = jwt.sign(
    { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/payments/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({});

  assert.strictEqual(res.status, 403);
});
