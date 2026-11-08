import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

function makeToken(payload) {
  return jwt.sign(
    { type: 'access', ...payload },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
}

const adminToken = makeToken({ userId: 1, role: 'admin', email: 'admin@kinesiologia.com' });
const kinesiologistToken = makeToken({ userId: 2, role: 'kinesiologist', email: 'lucas.kine@kinesiologia.com' });
const otherKineToken = makeToken({ userId: 4, role: 'kinesiologist', email: 'carlos.gomez@kinesiologia.com' });
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });

const timestamp = Date.now();
let testPatientId = null;
let apptKine2Id = null;
let apptUnassignedId = null;

test('0. Setup: Crear paciente de prueba para turnos globales', async () => {
  const res = await request(app)
    .post('/api/v1/patients/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: `GlobalAdmin`,
      lastName: `Test-${timestamp}`,
      dni: `DNI-${timestamp.toString().slice(-8)}`,
      email: `test.admin.global.${timestamp}@example.com`,
      phone: '+5491100001111',
      birthDate: '1988-04-12',
      address: 'Calle Falsa 123'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  testPatientId = res.body.data.id;
  assert.ok(testPatientId);
});

test('1. Crear turno asignado al Kinesiólogo ID 2 y turno sin asignar (NULL)', async () => {
  const pool = getPool();

  // Turno asignado a Kinesiólogo 2
  const [res1] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2027-01-10 10:00:00', '2027-01-10 10:45:00', 'confirmed', 'Turno con Kinesiólogo Lucas', 2500, 'ARS', 1)
  `, [testPatientId]);
  apptKine2Id = res1.insertId;
  assert.ok(apptKine2Id);

  // Turno sin profesional asignado (kinesiologist_id = NULL)
  const [res2] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, NULL, 1, '2027-01-10 11:00:00', '2027-01-10 11:45:00', 'pending', 'Turno pendiente de asignación', 2500, 'ARS', 1)
  `, [testPatientId]);
  apptUnassignedId = res2.insertId;
  assert.ok(apptUnassignedId);
});

test('2. Administrador consulta turnos globales y visualiza tanto asignados como sin asignar', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId: testPatientId,
      limit: 50
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const items = res.body.data;
  assert.ok(items.length >= 2, 'Admin debe ver todos los turnos del paciente');

  const kineAppt = items.find((a) => a.id === apptKine2Id);
  assert.ok(kineAppt, 'Debe incluir turno de Kinesiólogo 2');
  assert.equal(kineAppt.kinesiologist_id, 2);
  assert.ok(kineAppt.kinesiologist_name || kineAppt.kinesiologist_last_name, 'Debe incluir datos del kinesiólogo');

  const unassignedAppt = items.find((a) => a.id === apptUnassignedId);
  assert.ok(unassignedAppt, 'Debe incluir turno sin profesional asignado');
  assert.equal(unassignedAppt.kinesiologist_id, null);
  assert.equal(unassignedAppt.kinesiologist_name, null);
  assert.equal(unassignedAppt.kinesiologist_last_name, null);
});

test('3. Administrador filtra específicamente turnos "Sin asignar" (unassigned)', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 'unassigned',
      limit: 50
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const items = res.body.data;
  assert.ok(items.length >= 1);
  assert.ok(items.every((a) => a.kinesiologist_id === null), 'Todos deben tener kinesiologist_id en null');
});

test('4. Administrador filtra específicamente por kinesiólogo (ID 2)', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 2,
      limit: 50
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const items = res.body.data;
  assert.ok(items.length >= 1);
  assert.ok(items.every((a) => a.kinesiologist_id === 2));
});

test('5. RBAC estricto: Kinesiólogo solo puede ver sus propios turnos asignados', async () => {
  // El usuario con ID 2 consulta la agenda sin filtros
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatientId,
      limit: 50
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const items = res.body.data;
  assert.ok(items.some((a) => a.id === apptKine2Id), 'Debe ver su propio turno asignado');
  assert.ok(!items.some((a) => a.id === apptUnassignedId), 'NO debe ver turnos no asignados a él');
  assert.ok(items.every((a) => a.kinesiologist_id === 2), 'Todos los turnos retornados deben pertenecerle a él');

  // Si el kinesiólogo intenta pasar kinesiologistId de otro profesional o "all" en el body, el backend lo sobrescribe
  const tamperRes = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 'all',
      limit: 50
    });

  assert.equal(tamperRes.status, 200);
  const tamperedItems = tamperRes.body.data;
  assert.ok(tamperedItems.every((a) => a.kinesiologist_id === 2), 'El backend forzó kinesiologistId = currentUser.id');
});

test('6. Recepcionista también puede ver turnos globales de todos los kinesiólogos', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      limit: 50
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const items = res.body.data;
  assert.ok(items.some((a) => a.id === apptKine2Id), 'Recepcionista ve turno asignado');
  assert.ok(items.some((a) => a.id === apptUnassignedId), 'Recepcionista ve turno sin asignar');
});

test('7. Búsqueda de texto en tiempo real filtra por paciente, notas y kinesiólogo', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId: testPatientId,
      search: 'pendiente de asignación'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].id, apptUnassignedId);
});

test('8. Lista de profesionales para filtros y creación dinámica', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/professionals')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  const kine = res.body.data[0];
  assert.ok(kine.id);
  assert.ok(kine.name || kine.last_name);
});

test('9. Limpieza de datos de prueba', async () => {
  const pool = getPool();
  if (apptKine2Id) await pool.query('DELETE FROM appointments WHERE id = ?', [apptKine2Id]);
  if (apptUnassignedId) await pool.query('DELETE FROM appointments WHERE id = ?', [apptUnassignedId]);
  if (testPatientId) {
    await pool.query('DELETE FROM clinical_records WHERE patient_id = ?', [testPatientId]);
    await pool.query('DELETE FROM patients WHERE id = ?', [testPatientId]);
  }
});

