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

test('8. Reseteo de contraseña: un solo uso e invalidación ante reintento (401)', async () => {
  // 1. Solicitar reseteo
  const forgotRes = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email: 'carlos.kine@kinesiologia.com' });

  assert.strictEqual(forgotRes.status, 200);
  const resetToken = forgotRes.body.data?.resetToken || forgotRes.body.resetToken;
  assert.ok(resetToken, 'Debe devolver un resetToken en entorno de desarrollo/test');

  // 2. Usar token para cambiar contraseña
  const resetRes = await request(app)
    .post('/api/v1/auth/reset-password')
    .send({ token: resetToken, newPassword: 'Password123!' });

  assert.strictEqual(resetRes.status, 200);

  // 3. Reintento con el MISMO token: debe ser rechazado inmediatamente (token de un solo uso)
  const replayRes = await request(app)
    .post('/api/v1/auth/reset-password')
    .send({ token: resetToken, newPassword: 'Password123!' });

  assert.strictEqual(replayRes.status, 401);
});

test('9. Trazabilidad: acciones sensibles escriben registros en audit_logs', async () => {
  const { query } = await import('../src/config/database.js');
  const rows = await query("SELECT action, entity_type FROM audit_logs WHERE action = 'PASSWORD_RESET' ORDER BY id DESC LIMIT 1");
  assert.ok(rows.length > 0, 'Debe existir al menos un registro de auditoría para PASSWORD_RESET');
  assert.strictEqual(rows[0].action, 'PASSWORD_RESET');
  assert.strictEqual(rows[0].entity_type, 'user');
});

test('10. Autorización de recurso: Paciente inexistente al crear historia clínica responde 404 (no 500)', async () => {
  const kineToken = jwt.sign(
    { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/clinical-records')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({
      patientId: 999999,
      consultationReason: 'Dolor lumbar agudo',
      initialEvaluation: 'Evaluación inicial',
      diagnosis: 'Lumbalgia mecánica'
    });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error.code, 'NOT_FOUND');
});

test('11. Prestaciones y Tarifas: Consulta de catálogo mediante POST /services/search', async () => {
  const recepToken = jwt.sign(
    { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/services/search')
    .set('Authorization', `Bearer ${recepToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 3, 'Debe devolver los servicios activos iniciales');
});

test('12. Idempotencia de pagos: Recibo duplicado rechaza con 409 Conflict', async () => {
  const adminToken = jwt.sign(
    { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const uniqueReceipt = `REC-TEST-${Date.now()}`;
  const paymentPayload = {
    patientId: 1,
    amount: 15000,
    paymentMethod: 'cash',
    receiptNumber: uniqueReceipt
  };

  try {
    const res1 = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(paymentPayload);

    assert.strictEqual(res1.status, 201);

    // Reintento con el mismo recibo
    const res2 = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(paymentPayload);

    assert.strictEqual(res2.status, 409);
  } finally {
    // Limpieza de datos de prueba para mantener la caja del consultorio limpia y verídica
    const { query } = await import('../src/config/database.js');
    await query('DELETE FROM payments WHERE receipt_number = ?', [uniqueReceipt]);
  }
});

test('13. Dashboard modular: Oculta datos financieros al kinesiólogo', async () => {
  const kineToken = jwt.sign(
    { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/dashboard/summary')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.financial, null, 'El kinesiólogo no debe tener acceso al resumen financiero');
});

test('14. Caja del Día: Consulta verídica de arqueo diario por POST /payments/caja-summary', async () => {
  const adminToken = jwt.sign(
    { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/payments/caja-summary')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(typeof res.body.data.totalIncome === 'number');
  assert.ok(typeof res.body.data.transactionsCount === 'number');
  assert.ok(typeof res.body.data.cashTotal === 'number');
  assert.ok(typeof res.body.data.electronicTotal === 'number');
  assert.ok(typeof res.body.data.byMethod === 'object');
});

test('15. Búsqueda de cobros: Filtro todayOnly limita a transacciones de la jornada actual', async () => {
  const recepToken = jwt.sign(
    { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .post('/api/v1/payments/search')
    .set('Authorization', `Bearer ${recepToken}`)
    .send({ todayOnly: true, limit: 10 });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test('16. Historias Clínicas: Exportación de PDF formal médico mediante POST /clinical-records/export-pdf', async () => {
  const adminToken = jwt.sign(
    { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  const recepToken = jwt.sign(
    { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  // 1. Recepcionista bloqueada con 403 Forbidden
  const forbiddenRes = await request(app)
    .post('/api/v1/clinical-records/export-pdf')
    .set('Authorization', `Bearer ${recepToken}`)
    .send({ id: 30001 });

  assert.strictEqual(forbiddenRes.status, 403);

  // 2. Admin exporta en formato binario PDF (Content-Type: application/pdf)
  const binaryRes = await request(app)
    .post('/api/v1/clinical-records/export-pdf')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: 30001 });

  assert.strictEqual(binaryRes.status, 200);
  assert.ok(binaryRes.headers['content-type'].includes('application/pdf'));
  assert.ok(binaryRes.headers['content-disposition'].includes('.pdf'));

  // 3. Admin exporta en formato JSON base64
  const base64Res = await request(app)
    .post('/api/v1/clinical-records/export-pdf')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: 30001, format: 'base64' });

  assert.strictEqual(base64Res.status, 200);
  assert.strictEqual(base64Res.body.success, true);
  assert.ok(typeof base64Res.body.data.pdfBase64 === 'string');
  assert.ok(base64Res.body.data.pdfBase64.length > 500);
});
