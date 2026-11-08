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

const adminToken = makeToken({ userId: 1, role: 'admin', email: 'kinesiogestion58@gmail.com' });
const kinesiologistToken = makeToken({ userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' });
let otherKineId = null;
let otherKineToken = null;
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });
// Paciente de prueba vinculado a user 60001
const patientUserToken = makeToken({ userId: 60001, role: 'paciente', email: 'leonelsuarezmiranda@gmail.com' });

const timestamp = Date.now();
let testPatientId = null;
let vacationNoTurnosId = null;
let vacationWithTurnosId = null;
let apptBeforeId = null;
let apptInside1Id = null;
let apptInside2Id = null;
let apptAfterId = null;

// Fechas para pruebas (futuras y hábiles para evitar feriados de fin de semana)
const VAC_START_EMPTY = '2027-04-05'; // Lunes
const VAC_END_EMPTY = '2027-04-09';   // Viernes

const VAC_START_TURNS = '2027-05-10'; // Lunes
const VAC_END_TURNS = '2027-05-14';   // Viernes

test('0. Setup: Asegurar segundo kinesiólogo, paciente de prueba y turnos', async () => {
  const pool = getPool();

  // Limpieza inicial para evitar solapamientos con ejecuciones previas
  await pool.query('DELETE FROM appointments WHERE notes LIKE "%vacaciones%" OR notes LIKE "%afectado%"');
  await pool.query('DELETE FROM kinesiologist_vacations WHERE kinesiologist_id = 2');
  await pool.query('DELETE FROM notifications WHERE type = "KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS"');

  // Asegurar segundo kinesiólogo
  const [kines] = await pool.query('SELECT id, email FROM users WHERE role_id = 2 AND id != 2 LIMIT 1');
  if (kines.length > 0) {
    otherKineId = kines[0].id;
    otherKineToken = makeToken({ userId: otherKineId, role: 'kinesiologist', email: kines[0].email });
  } else {
    const [res] = await pool.query(`
      INSERT INTO users (role_id, name, last_name, email, password_hash, is_active, email_verified_at)
      VALUES (2, 'Segundo', 'Kine', 'segundo.kine@kinesiologia.com', 'hash_test', 1, CURRENT_TIMESTAMP)
    `);
    otherKineId = res.insertId;
    otherKineToken = makeToken({ userId: otherKineId, role: 'kinesiologist', email: 'segundo.kine@kinesiologia.com' });
  }
  assert.ok(otherKineId);

  // Asegurar paciente para user 60001
  const [patRows] = await pool.query('SELECT id FROM patients WHERE user_id = 60001 LIMIT 1');
  if (patRows.length > 0) {
    testPatientId = patRows[0].id;
  } else {
    const [pRes] = await pool.query(`
      INSERT INTO patients (user_id, first_name, last_name, dni, email, phone, birth_date, is_active)
      VALUES (60001, 'Leonel', 'Suarez', 'DNI-VAC-${timestamp.toString().slice(-6)}', 'leonelsuarezmiranda@gmail.com', '+5491100002222', '1990-01-01', 1)
    `);
    testPatientId = pRes.insertId;
  }
  assert.ok(testPatientId);

  // Turno ANTERIOR a VAC_START_TURNS (Viernes 2027-05-07)
  const [resBefore] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2027-05-07 10:00:00', '2027-05-07 10:45:00', 'confirmed', 'Turno previo a vacaciones', 3000, 'ARS', 1)
  `, [testPatientId]);
  apptBeforeId = resBefore.insertId;

  // Turno DENTRO 1 (Martes 2027-05-11 10:00:00)
  const [resInside1] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2027-05-11 10:00:00', '2027-05-11 10:45:00', 'confirmed', 'Turno afectado 1', 3000, 'ARS', 1)
  `, [testPatientId]);
  apptInside1Id = resInside1.insertId;

  // Turno DENTRO 2 (Miércoles 2027-05-12 11:00:00)
  const [resInside2] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2027-05-12 11:00:00', '2027-05-12 11:45:00', 'confirmed', 'Turno afectado 2', 3000, 'ARS', 1)
  `, [testPatientId]);
  apptInside2Id = resInside2.insertId;

  // Turno POSTERIOR a VAC_END_TURNS (Lunes 2027-05-17)
  const [resAfter] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, 2, 1, '2027-05-17 14:00:00', '2027-05-17 14:45:00', 'confirmed', 'Turno posterior a vacaciones', 3000, 'ARS', 1)
  `, [testPatientId]);
  apptAfterId = resAfter.insertId;
});

test('1. Registrar vacaciones sin turnos asignados (éxito y conteo 0)', async () => {
  // Primero previsualizar
  const prevRes = await request(app)
    .post('/api/v1/vacations/preview')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: VAC_START_EMPTY,
      endDate: VAC_END_EMPTY
    });
  assert.equal(prevRes.status, 200);
  assert.equal(prevRes.body.success, true);
  assert.equal(prevRes.body.data.affectedCount, 0);

  // Crear vacaciones
  const createRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: VAC_START_EMPTY,
      endDate: VAC_END_EMPTY,
      notes: 'Vacaciones de descanso sin turnos'
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.data.affectedAppointmentsCount, 0);
  assert.equal(createRes.body.data.status, 'scheduled');
  vacationNoTurnosId = createRes.body.data.id;
  assert.ok(vacationNoTurnosId);
});

test('2. Registrar vacaciones con varios turnos existentes (detección, advertencia y notificación a recepción)', async () => {
  // Previsualizar detecta 2 turnos afectados
  const prevRes = await request(app)
    .post('/api/v1/vacations/preview')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: VAC_START_TURNS,
      endDate: VAC_END_TURNS
    });
  assert.equal(prevRes.status, 200);
  assert.equal(prevRes.body.data.hasConflicts, true);
  assert.equal(prevRes.body.data.affectedCount, 2);

  // Crear vacaciones
  const createRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: VAC_START_TURNS,
      endDate: VAC_END_TURNS,
      notes: 'Vacaciones de mayo con turnos a reasignar'
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.data.affectedAppointmentsCount, 2);
  vacationWithTurnosId = createRes.body.data.id;
  assert.ok(vacationWithTurnosId);

  // Verificar que los turnos NO se hayan cancelado ni eliminado en la BD
  const pool = getPool();
  const [appRows] = await pool.query(
    'SELECT id, status, kinesiologist_id FROM appointments WHERE id IN (?, ?)',
    [apptInside1Id, apptInside2Id]
  );
  assert.equal(appRows.length, 2);
  assert.equal(appRows[0].status, 'confirmed');
  assert.equal(appRows[1].status, 'confirmed');
  assert.equal(appRows[0].kinesiologist_id, 2);
  assert.equal(appRows[1].kinesiologist_id, 2);

  // Verificar que exista la notificación para recepcionistas en notifications
  const [notifRows] = await pool.query(
    "SELECT * FROM notifications WHERE type = 'KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS' ORDER BY id DESC LIMIT 1"
  );
  assert.ok(notifRows.length > 0);
  assert.ok(notifRows[0].message.includes('estará de vacaciones'));
  assert.ok(notifRows[0].message.includes('reorganizados'));
});

test('3. Intentar reservar durante las vacaciones desde portal (bloqueo / sin disponibilidad)', async () => {
  // Consultar disponibilidad en fecha con vacaciones de Kine 2 (2027-05-11)
  const slotsRes = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: '2027-05-11'
    });
  assert.equal(slotsRes.status, 200);
  // Al estar de vacaciones, no debe retornar slots disponibles
  assert.deepEqual(slotsRes.body.data, []);

  // Intentar forzar reserva por bookAppointment en fecha con vacaciones
  const bookRes = await request(app)
    .post('/api/v1/patient-portal/book-appointment')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      startTime: '2027-05-11 09:00:00',
      notes: 'Intento de reserva durante vacaciones'
    });
  // Debe ser rechazado (400 o 409)
  assert.ok(bookRes.status === 400 || bookRes.status === 409);
});

test('4. Intentar asignar turno desde recepción durante vacaciones (bloqueo 409 Conflict)', async () => {
  const createRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: '2027-05-13 10:00:00',
      endTime: '2027-05-13 10:45:00',
      notes: 'Intento recepción turno con kinesiólogo en vacaciones'
    });
  assert.equal(createRes.status, 409);
  assert.equal(createRes.body.success, false);
  assert.ok(createRes.body.error.message.includes('vacaciones'));
});

test('5. Intentar registrar períodos superpuestos o inválidos (bloqueo 400 / 409)', async () => {
  // Superpuesto con VAC_START_TURNS (2027-05-10 a 2027-05-14)
  const overlapRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: '2027-05-12',
      endDate: '2027-05-18',
      notes: 'Intento superpuesto'
    });
  assert.equal(overlapRes.status, 409);
  assert.equal(overlapRes.body.success, false);
  assert.ok(overlapRes.body.error.message.includes('superpone'));

  // Fecha fin anterior a fecha inicio
  const invalidDatesRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: '2027-06-10',
      endDate: '2027-06-05'
    });
  assert.equal(invalidDatesRes.status, 422);

  // Fecha pasada
  const pastRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      startDate: '2020-01-01',
      endDate: '2020-01-10'
    });
  assert.equal(pastRes.status, 400);
});

test('6. Cancelar un período futuro (estado pasa a cancelled)', async () => {
  const cancelRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      vacationId: vacationNoTurnosId
    });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.success, true);
  assert.equal(cancelRes.body.data.status, 'cancelled');

  // Verificar que ya figure en el repositorio como cancelado
  const pool = getPool();
  const [rows] = await pool.query('SELECT status FROM kinesiologist_vacations WHERE id = ?', [vacationNoTurnosId]);
  assert.equal(rows[0].status, 'cancelled');
});

test('7. Consultar vacaciones y alertas desde el administrador y recepcionista', async () => {
  // Admin consulta búsqueda global
  const searchRes = await request(app)
    .post('/api/v1/vacations/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(searchRes.status, 200);
  assert.ok(Array.isArray(searchRes.body.data));
  assert.ok(searchRes.body.data.length > 0);

  // Recepcionista consulta alertas activas
  const alertsRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  assert.equal(alertsRes.status, 200);
  assert.ok(alertsRes.body.success);
  const foundAlert = alertsRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.ok(foundAlert);
  assert.equal(foundAlert.pendingAffectedCount, 2);

  // Consultar turnos afectados específicos
  const affRes = await request(app)
    .post('/api/v1/vacations/affected-appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationWithTurnosId });
  assert.equal(affRes.status, 200);
  assert.equal(affRes.body.data.length, 2);
  assert.equal(affRes.body.data[0].patient_first_name, 'Leonel');
});

test('8. Reasignar los turnos afectados a otro profesional (horario y notificación)', async () => {
  // Reasignar el primer turno afectado al segundo kinesiólogo
  const reassignRes = await request(app)
    .post('/api/v1/vacations/reassign-appointment')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      vacationId: vacationWithTurnosId,
      appointmentId: apptInside1Id,
      newKinesiologistId: otherKineId,
      newStartTime: '2027-05-11 11:00:00',
      notifyPatient: true
    });
  assert.equal(reassignRes.status, 200);
  assert.equal(reassignRes.body.success, true);
  assert.equal(reassignRes.body.data.kinesiologist_id, otherKineId);

  // Comprobar que pendingAffectedCount en alertas ahora es 1
  const alertsRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  const alertItem = alertsRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.ok(alertItem);
  assert.equal(alertItem.pendingAffectedCount, 1);

  // Reasignar el segundo turno afectado dejándolo sin asignar (kinesiologistId: null)
  const reassign2Res = await request(app)
    .post('/api/v1/vacations/reassign-appointment')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      vacationId: vacationWithTurnosId,
      appointmentId: apptInside2Id,
      newKinesiologistId: null,
      notifyPatient: true
    });
  assert.equal(reassign2Res.status, 200);
  assert.equal(reassign2Res.body.success, true);
  assert.equal(reassign2Res.body.data.kinesiologist_id, null);

  // Alertas ya no debe contener la vacación como pendiente de reorganización
  const alertsAfterRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  const alertItemAfter = alertsAfterRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.equal(alertItemAfter, undefined);
});

test('9. Comprobar que los turnos anteriores y posteriores no se vean afectados', async () => {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, kinesiologist_id, start_time, status FROM appointments WHERE id IN (?, ?)',
    [apptBeforeId, apptAfterId]
  );
  assert.equal(rows.length, 2);

  const beforeTurn = rows.find((r) => r.id === apptBeforeId);
  assert.ok(beforeTurn);
  assert.equal(beforeTurn.kinesiologist_id, 2);
  assert.equal(beforeTurn.status, 'confirmed');

  const afterTurn = rows.find((r) => r.id === apptAfterId);
  assert.ok(afterTurn);
  assert.equal(afterTurn.kinesiologist_id, 2);
  assert.equal(afterTurn.status, 'confirmed');

  // Limpieza de datos de prueba
  await pool.query('DELETE FROM appointments WHERE id IN (?, ?, ?, ?)', [
    apptBeforeId,
    apptInside1Id,
    apptInside2Id,
    apptAfterId
  ]);
  await pool.query('DELETE FROM kinesiologist_vacations WHERE id IN (?, ?)', [
    vacationNoTurnosId,
    vacationWithTurnosId
  ]);
  await pool.query('DELETE FROM notifications WHERE type = "KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS"');
  if (otherKineId && otherKineId !== 2) {
    await pool.query('DELETE FROM users WHERE id = ?', [otherKineId]);
  }
});
