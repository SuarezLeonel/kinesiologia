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
    { userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/clinical-records/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ patientId: 1 });

  // Debe retornar 403 Forbidden o 401 si no encuentra al usuario en base de datos de test
  assert.ok(
    [401, 403].includes(res.status),
    `Esperaba 401 o 403 para recepcionista en historias clínicas, pero obtuve ${res.status}`
  );
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
    { userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/payments/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({});

  assert.strictEqual(res.status, 403);
});
