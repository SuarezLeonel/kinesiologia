/**
 * @file payments_appointment_billing.test.js
 * @description Suite de pruebas automatizadas para el cobro de consultas y turnos realizados.
 * Valida obtención automática de precios existentes, bloqueo de manipulación de importes,
 * preservación de precios históricos, rechazo de duplicados y turnos no atendidos, y control RBAC.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { query, getPool } from '../src/config/database.js';

let testPatient1Id = null;
let testPatient2Id = null;
let testAttendedAppointmentId = null;
let testPendingAppointmentId = null;
let testCancelledAppointmentId = null;

const adminToken = jwt.sign(
  { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

const receptionistToken = jwt.sign(
  { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

const kinesiologistToken = jwt.sign(
  { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

test.before(async () => {
  // Limpieza previa defensiva
  await query("DELETE FROM payments WHERE patient_id IN (SELECT id FROM patients WHERE dni LIKE 'DNI-PAY-%')");
  await query("DELETE FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE dni LIKE 'DNI-PAY-%')");
  await query("DELETE FROM patients WHERE dni LIKE 'DNI-PAY-%'");

  // 1. Crear pacientes de prueba con sufijo temporal único
  const uid = Date.now().toString().slice(-6);
  const p1 = await query(`
    INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, is_active)
    VALUES ('PacienteCobro', 'Uno', 'DNI-PAY-1-${uid}', '1985-05-15', '+549110009901', 'paciente.cobro1.${uid}@example.com', 1)
  `);
  testPatient1Id = p1.insertId;

  const p2 = await query(`
    INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, is_active)
    VALUES ('PacienteCobro', 'Dos', 'DNI-PAY-2-${uid}', '1992-08-20', '+549110009902', 'paciente.cobro2.${uid}@example.com', 1)
  `);
  testPatient2Id = p2.insertId;

  // 2. Crear turnos con diferentes estados
  // Turno asistido / realizado para Paciente 1 (Servicio 1 = $12000)
  const appAttended = await query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2026-11-01 10:00:00', '2026-11-01 10:45:00', 'attended', 12000.00, 'ARS', 1)
  `, [testPatient1Id]);
  testAttendedAppointmentId = appAttended.insertId;

  // Turno pendiente para Paciente 1
  const appPending = await query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2026-11-02 11:00:00', '2026-11-02 11:45:00', 'pending', 12000.00, 'ARS', 1)
  `, [testPatient1Id]);
  testPendingAppointmentId = appPending.insertId;

  // Turno cancelado para Paciente 1
  const appCancelled = await query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2026-11-03 12:00:00', '2026-11-03 12:45:00', 'cancelled', 12000.00, 'ARS', 1)
  `, [testPatient1Id]);
  testCancelledAppointmentId = appCancelled.insertId;
});

test.after(async () => {
  // Limpieza de datos creados en pruebas
  if (testPatient1Id) {
    await query('DELETE FROM payments WHERE patient_id = ?', [testPatient1Id]);
    await query('DELETE FROM appointments WHERE patient_id = ?', [testPatient1Id]);
    await query('DELETE FROM patients WHERE id = ?', [testPatient1Id]);
  }
  if (testPatient2Id) {
    await query('DELETE FROM payments WHERE patient_id = ?', [testPatient2Id]);
    await query('DELETE FROM appointments WHERE patient_id = ?', [testPatient2Id]);
    await query('DELETE FROM patients WHERE id = ?', [testPatient2Id]);
  }
  const pool = getPool();
  await pool.end();
});

test('Cobros 1. Recepcionista consulta turnos asistidos no cobrados del paciente', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      status: 'attended',
      unpaidOnly: true
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  const found = res.body.data.find((a) => a.id === testAttendedAppointmentId);
  assert.ok(found, 'Debe encontrar el turno asistido pendiente de cobro');
  assert.strictEqual(found.is_paid, 0);
  assert.strictEqual(Number(found.agreed_price), 12000);
  assert.strictEqual(found.service_name, 'Rehabilitación Traumatológica');
});

test('Cobros 2. Backend rechaza cobro de turno no realizado o pendiente (400 Bad Request)', async () => {
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      appointmentId: testPendingAppointmentId,
      paymentMethod: 'cash'
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /atendido/i);
});

test('Cobros 3. Backend rechaza cobro de turno cancelado (400 Bad Request)', async () => {
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      appointmentId: testCancelledAppointmentId,
      paymentMethod: 'cash'
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /atendido/i);
});

test('Cobros 4. Backend rechaza cobro si el turno pertenece a otro paciente (400 Bad Request)', async () => {
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient2Id, // paciente diferente al dueño del turno
      appointmentId: testAttendedAppointmentId,
      paymentMethod: 'transfer'
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /pertenece al paciente/i);
});

test('Cobros 5. Recepcionista registra cobro legítimo: el backend ignora importe manipulado y aplica precio configurado', async () => {
  const receiptNum = `REC-BILL-${Date.now()}`;
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      appointmentId: testAttendedAppointmentId,
      // INTENTO DE MANIPULACIÓN DESDE EL FRONTEND O HTTP: Se envía $1 en lugar de $12000
      amount: 1.00,
      paymentMethod: 'cash',
      receiptNumber: receiptNum
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  // EL BACKEND DEBE HABER IGNORADO EL $1 Y COBRADO EL PRECIO REAL DE LA PRESTACIÓN ($12.000)
  assert.strictEqual(Number(res.body.data.amount), 12000.00, 'El backend debe ignorar el importe manipulado y fijar $12000');
  assert.strictEqual(res.body.data.appointment_id, testAttendedAppointmentId);
  assert.strictEqual(res.body.data.payment_method, 'cash');
});

test('Cobros 6. Prevención de doble cobro: No se puede cobrar el mismo turno más de una vez (409 Conflict)', async () => {
  const duplicateReceipt = `REC-DUP-${Date.now()}`;
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      appointmentId: testAttendedAppointmentId,
      paymentMethod: 'debit_card',
      receiptNumber: duplicateReceipt
    });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /ya fue cobrado/i);
});

test('Cobros 7. Consulta de agenda ahora reporta que el turno está cobrado (is_paid = 1)', async () => {
  const res = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatient1Id,
      status: 'attended'
    });

  assert.strictEqual(res.status, 200);
  const found = res.body.data.find((a) => a.id === testAttendedAppointmentId);
  assert.ok(found);
  assert.strictEqual(found.is_paid, 1);
  assert.ok(found.payment_id);
});

test('Cobros 8. Preservación de precios históricos: modificación de tarifa posterior no altera pagos pasados', async () => {
  // 1. Obtener el cobro registrado previamente
  const prevRows = await query('SELECT amount FROM payments WHERE appointment_id = ?', [testAttendedAppointmentId]);
  assert.strictEqual(Number(prevRows[0].amount), 12000.00);

  // 2. Modificar el precio del servicio en el catálogo (ej: de 12000 a 25000)
  await query('UPDATE services SET default_price = 25000.00 WHERE id = 1');

  // 3. Comprobar que el cobro anterior conservó exactamente su precio original histórico ($12000)
  const afterRows = await query('SELECT amount FROM payments WHERE appointment_id = ?', [testAttendedAppointmentId]);
  assert.strictEqual(Number(afterRows[0].amount), 12000.00, 'El cobro histórico debe conservar 12000.00');

  // Restaurar el precio original del servicio
  await query('UPDATE services SET default_price = 12000.00 WHERE id = 1');
});

test('Cobros 9. Control de roles (RBAC): Kinesiólogo bloqueado en registro de cobros (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatient1Id,
      appointmentId: testAttendedAppointmentId,
      paymentMethod: 'cash'
    });

  assert.strictEqual(res.status, 403);
});
