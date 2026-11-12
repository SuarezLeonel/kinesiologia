import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool } from '../src/config/database.js';
import { holidayService } from '../src/services/holidayService.js';
import { getClinicDateString, addCalendarDays } from '../src/utils/date.js';

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
let createdOtherKine = false;
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
    createdOtherKine = true;
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

test('2. Registrar vacaciones con varios turnos existentes (cancelación automática, historial y notificaciones individuales)', async () => {
  // Previsualizar detecta 2 turnos afectados que serán cancelados
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
      notes: 'Vacaciones de mayo con cancelación automática'
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.data.affectedAppointmentsCount, 2);
  assert.equal(createRes.body.data.cancelledAppointmentsCount, 2);
  vacationWithTurnosId = createRes.body.data.id;
  assert.ok(vacationWithTurnosId);

  // Verificar que los turnos sigan existiendo en la BD con estado 'cancelled', sin reasignarse ni eliminarse
  const pool = getPool();
  const [appRows] = await pool.query(
    `SELECT id, patient_id, kinesiologist_id, service_id, start_time, end_time, status, agreed_price, currency,
            cancellation_reason, cancelled_by_vacation_id
     FROM appointments WHERE id IN (?, ?) ORDER BY id ASC`,
    [apptInside1Id, apptInside2Id]
  );
  assert.equal(appRows.length, 2);
  for (const row of appRows) {
    assert.equal(row.status, 'cancelled');
    assert.equal(row.kinesiologist_id, 2);
    assert.equal(row.patient_id, testPatientId);
    assert.equal(row.service_id, 1);
    assert.equal(Number(row.agreed_price), 3000);
    assert.equal(row.cancellation_reason, 'Vacaciones del kinesiólogo');
    assert.equal(row.cancelled_by_vacation_id, vacationWithTurnosId);
  }

  // Verificar trazabilidad en appointment_history
  const [histRows] = await pool.query(
    'SELECT appointment_id, previous_status, new_status, changed_by, reason FROM appointment_history WHERE appointment_id IN (?, ?)',
    [apptInside1Id, apptInside2Id]
  );
  assert.equal(histRows.length, 2);
  for (const h of histRows) {
    assert.equal(h.previous_status, 'confirmed');
    assert.equal(h.new_status, 'cancelled');
    assert.equal(h.changed_by, 2);
    assert.ok(h.reason.includes('vacaciones'));
  }

  // Verificar aviso en tabla general de notificaciones (sin reasignación)
  const [notifRows] = await pool.query(
    "SELECT * FROM notifications WHERE type = 'KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS' ORDER BY id DESC LIMIT 1"
  );
  assert.ok(notifRows.length > 0);
  assert.ok(notifRows[0].message.includes('cancelados automáticamente'));

  // Verificar que existan 2 notificaciones individuales en vacation_cancellation_notifications (sin duplicados)
  const [vcnRows] = await pool.query(
    'SELECT * FROM vacation_cancellation_notifications WHERE vacation_id = ? ORDER BY appointment_start_time ASC',
    [vacationWithTurnosId]
  );
  assert.equal(vcnRows.length, 2);
  assert.equal(vcnRows[0].tracking_status, 'pending_notification');
  assert.equal(vcnRows[0].cancellation_reason, 'Vacaciones del kinesiólogo');
  assert.ok(vcnRows[0].patient_name.includes('Leonel'));
  assert.ok(vcnRows[0].whatsapp_message.includes('Hola Leonel, te contactamos del consultorio para informarte que tu turno del día 11/05/2027 a las 10:00'));
  assert.ok(vcnRows[0].whatsapp_message.includes('debió ser cancelado debido a que el profesional estará de vacaciones durante ese período.'));
  assert.ok(vcnRows[0].whatsapp_message.includes('Disculpá las molestias ocasionadas. Ante cualquier consulta, podés comunicarte con nosotros. ¡Muchas gracias!'));
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

test('7. Recepción consulta alertas, notificaciones individuales y turnos visibles como cancelados en agenda/portal', async () => {
  // Admin consulta búsqueda global
  const searchRes = await request(app)
    .post('/api/v1/vacations/search')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(searchRes.status, 200);
  assert.ok(Array.isArray(searchRes.body.data));
  assert.ok(searchRes.body.data.length > 0);

  // Recepcionista consulta alertas activas (pendientes de notificar al paciente)
  const alertsRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  assert.equal(alertsRes.status, 200);
  assert.ok(alertsRes.body.success);
  const foundAlert = alertsRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.ok(foundAlert);
  assert.equal(foundAlert.pendingAffectedCount, 2);

  // Recepcionista consulta notificaciones individuales con datos completos para WhatsApp
  const notifsRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationWithTurnosId, trackingStatus: 'all' });
  assert.equal(notifsRes.status, 200);
  assert.equal(notifsRes.body.data.items.length, 2);
  assert.equal(notifsRes.body.data.summary.pendingCount, 2);
  assert.equal(notifsRes.body.data.summary.notifiedCount, 0);

  const [n1, n2] = notifsRes.body.data.items;
  assert.notEqual(n1.id, n2.id);
  assert.notEqual(n1.appointment_id, n2.appointment_id);
  assert.ok(n1.patient_phone);
  assert.ok(n1.kinesiologist_name);
  assert.equal(n1.date_display, '11/05/2027');
  assert.equal(n1.time_display, '10:00');
  assert.equal(n2.date_display, '12/05/2027');
  assert.equal(n2.time_display, '11:00');
  assert.equal(n1.cancellation_reason, 'Vacaciones del kinesiólogo');

  // Consultar turnos cancelados asociados a la vacación
  const affRes = await request(app)
    .post('/api/v1/vacations/affected-appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationWithTurnosId });
  assert.equal(affRes.status, 200);
  assert.equal(affRes.body.data.length, 2);
  assert.equal(affRes.body.data[0].status, 'cancelled');
  assert.equal(affRes.body.data[0].cancellation_reason, 'Vacaciones del kinesiólogo');

  // Verificar que los turnos cancelados siguen visibles como cancelados tanto en agenda como en portal paciente
  const agendaSearchRes = await request(app)
    .post('/api/v1/appointments/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      startDate: VAC_START_TURNS,
      endDate: VAC_END_TURNS
    });
  assert.equal(agendaSearchRes.status, 200);
  const cancelledInAgenda = agendaSearchRes.body.data.filter((a) => a.id === apptInside1Id || a.id === apptInside2Id);
  assert.equal(cancelledInAgenda.length, 2);
  assert.equal(cancelledInAgenda[0].status, 'cancelled');
  assert.equal(cancelledInAgenda[0].cancellation_reason, 'Vacaciones del kinesiólogo');

  const portalRes = await request(app)
    .post('/api/v1/patient-portal/my-appointments')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({ status: 'cancelled' });
  assert.equal(portalRes.status, 200);
  const cancelledInPortal = portalRes.body.data.filter((a) => a.id === apptInside1Id || a.id === apptInside2Id);
  assert.equal(cancelledInPortal.length, 2);
  assert.equal(cancelledInPortal[0].cancellation_reason, 'Vacaciones del kinesiólogo');
});

test('8. Seguimiento de notificaciones enviadas en recepción y bloqueo de reasignación automática', async () => {
  // Confirmar que la reasignación automática de turnos cancelados por vacaciones está bloqueada (400)
  const reassignRes = await request(app)
    .post('/api/v1/vacations/reassign-appointment')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      vacationId: vacationWithTurnosId,
      appointmentId: apptInside1Id,
      newKinesiologistId: otherKineId
    });
  assert.equal(reassignRes.status, 400);

  // Kinesiólogo y Paciente NO pueden consultar ni marcar notificaciones de recepción (403)
  const kineNotifsRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({});
  assert.equal(kineNotifsRes.status, 403);

  const patientNotifsRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({});
  assert.equal(patientNotifsRes.status, 403);

  // Obtener las 2 notificaciones pendientes
  const listRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationWithTurnosId, trackingStatus: 'pending_notification' });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.items.length, 2);
  const [notif1, notif2] = listRes.body.data.items;

  // Kinesiólogo no puede marcar como notificado (403)
  const kineMarkRes = await request(app)
    .post('/api/v1/vacations/mark-notification-sent')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ notificationId: notif1.id });
  assert.equal(kineMarkRes.status, 403);

  // Recepcionista marca la primera notificación como enviada al paciente
  const mark1Res = await request(app)
    .post('/api/v1/vacations/mark-notification-sent')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ notificationId: notif1.id });
  assert.equal(mark1Res.status, 200);
  assert.equal(mark1Res.body.data.tracking_status, 'notified');
  assert.equal(mark1Res.body.data.notified_by, 3);
  assert.ok(mark1Res.body.data.notified_at);

  // Comprobar que pendingAffectedCount en alertas ahora es 1
  const alertsRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  const alertItem = alertsRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.ok(alertItem);
  assert.equal(alertItem.pendingAffectedCount, 1);

  // Recepcionista marca la segunda notificación como enviada
  const mark2Res = await request(app)
    .post('/api/v1/vacations/mark-notification-sent')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ notificationId: notif2.id });
  assert.equal(mark2Res.status, 200);
  assert.equal(mark2Res.body.data.tracking_status, 'notified');

  // Alertas ya no debe mostrar esa vacación como pendiente de notificación
  const alertsAfterRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  const alertItemAfter = alertsAfterRes.body.data.find((a) => a.id === vacationWithTurnosId);
  assert.equal(alertItemAfter, undefined);

  // El resumen para esa vacación muestra 0 pendientes y 2 notificados
  const finalListRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationWithTurnosId, trackingStatus: 'notified' });
  assert.equal(finalListRes.status, 200);
  assert.equal(finalListRes.body.data.items.length, 2);
  assert.equal(finalListRes.body.data.summary.pendingCount, 0);
  assert.equal(finalListRes.body.data.summary.notifiedCount, 2);
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
});

// =========================================================================
// PRUEBAS DE GESTIÓN DE VACACIONES DESDE EL PERFIL DE ADMINISTRADOR
// =========================================================================
let adminCreatedVacId = null;
let adminVacFutureCancelId = null;
const adminTestAppointmentIds = [];
let workingDaysWindow = [];

async function loadUpcomingWorkingDays(count = 5) {
  const days = [];
  const base = new Date();
  for (let offset = 1; offset <= 14 && days.length < count; offset++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const evalRes = await holidayService.evaluateDate(dateStr, { enforceWindow: true });
    if (evalRes.available) {
      days.push(dateStr);
    }
  }
  return days;
}

test('10. Seguridad y permisos por rol en vacaciones (Admin, Kinesiólogo, Recepcionista, Paciente)', async () => {
  // Admin sin kinesiologistId debe ser rechazado (400) — nunca registra vacaciones propias
  const adminNoKinePreview = await request(app)
    .post('/api/v1/vacations/preview')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(adminNoKinePreview.status, 400);

  const adminNoKineCreate = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(adminNoKineCreate.status, 400);

  // Admin intentando registrarse a sí mismo (userId 1) debe ser rechazado (400)
  const adminSelfCreate = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ kinesiologistId: 1, startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(adminSelfCreate.status, 400);

  // Admin intentando registrar para recepcionista (userId 3) debe ser rechazado (400)
  const adminRecepCreate = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ kinesiologistId: 3, startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(adminRecepCreate.status, 400);

  // Kinesiólogo 2 intentando previsualizar o registrar vacaciones para otro kinesiólogo -> 403
  const kineCrossPreview = await request(app)
    .post('/api/v1/vacations/preview')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ kinesiologistId: otherKineId, startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(kineCrossPreview.status, 403);

  const kineCrossCreate = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ kinesiologistId: otherKineId, startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(kineCrossCreate.status, 403);

  // Recepcionista intentando crear o cancelar vacaciones -> 403
  const recepCreate = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ kinesiologistId: otherKineId, startDate: '2027-08-02', endDate: '2027-08-06' });
  assert.equal(recepCreate.status, 403);

  const recepCancel = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: vacationNoTurnosId, reason: 'Intento no autorizado' });
  assert.equal(recepCancel.status, 403);

  // Paciente intentando acceder al módulo de vacaciones -> 403
  const patientSearch = await request(app)
    .post('/api/v1/vacations/search')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({});
  assert.equal(patientSearch.status, 403);
});

test('11. Admin registra vacaciones en nombre de un kinesiólogo con turnos afectados, validaciones y notificaciones', async () => {
  const pool = getPool();
  workingDaysWindow = await loadUpcomingWorkingDays(5);
  assert.ok(workingDaysWindow.length >= 5, 'Debe haber al menos 5 días hábiles dentro de los próximos 14 días');

  const [, vacStart, vacEnd] = workingDaysWindow;

  // Limpiar posibles períodos/turnos previos en esas fechas para otherKineId o kine 2
  await pool.query('DELETE FROM kinesiologist_vacations WHERE kinesiologist_id IN (2, ?) AND end_date >= ? AND start_date <= ?', [
    otherKineId,
    workingDaysWindow[0],
    workingDaysWindow[4]
  ]);

  // Validaciones estándar (fecha pasada y fecha fin anterior a inicio)
  const pastRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ kinesiologistId: otherKineId, startDate: '2020-01-10', endDate: '2020-01-12' });
  assert.equal(pastRes.status, 400);

  const invOrderRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ kinesiologistId: otherKineId, startDate: vacEnd, endDate: vacStart });
  assert.equal(invOrderRes.status, 422);

  // Crear un turno asignado al segundo kinesiólogo dentro de [vacStart, vacEnd]
  const [apptRes] = await pool.query(`
    INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
    VALUES (?, ?, 1, ?, ?, 'confirmed', 'Turno afectado por vacacion admin', 3000, 'ARS', 1)
  `, [testPatientId, otherKineId, `${vacStart} 09:00:00`, `${vacStart} 09:45:00`]);
  const adminAffectedApptId = apptRes.insertId;
  adminTestAppointmentIds.push(adminAffectedApptId);

  // Previsualización por Admin para otherKineId
  const previewRes = await request(app)
    .post('/api/v1/vacations/preview')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      kinesiologistId: otherKineId,
      startDate: vacStart,
      endDate: vacEnd
    });
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.data.kinesiologistId, otherKineId);
  assert.equal(previewRes.body.data.affectedCount, 1);
  assert.equal(previewRes.body.data.hasConflicts, true);

  // Confirmar creación por Admin
  const createRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      kinesiologistId: otherKineId,
      startDate: vacStart,
      endDate: vacEnd,
      notes: 'Registrado por administración'
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.data.kinesiologistId, otherKineId);
  assert.equal(createRes.body.data.createdBy, 1);
  assert.equal(createRes.body.data.createdByRole, 'admin');
  assert.equal(createRes.body.data.affectedAppointmentsCount, 1);
  adminCreatedVacId = createRes.body.data.id;

  // Intentar registrar período superpuesto por admin -> 409
  const overlapAdminRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      kinesiologistId: otherKineId,
      startDate: vacEnd,
      endDate: workingDaysWindow[3]
    });
  assert.equal(overlapAdminRes.status, 409);

  // El turno existente debe quedar cancelado automáticamente manteniendo profesional y motivo
  const [apptCheck] = await pool.query(
    'SELECT status, kinesiologist_id, cancellation_reason, cancelled_by_vacation_id FROM appointments WHERE id = ?',
    [adminAffectedApptId]
  );
  assert.equal(apptCheck.length, 1);
  assert.equal(apptCheck[0].status, 'cancelled');
  assert.equal(apptCheck[0].kinesiologist_id, otherKineId);
  assert.equal(apptCheck[0].cancellation_reason, 'Vacaciones del kinesiólogo');
  assert.equal(apptCheck[0].cancelled_by_vacation_id, adminCreatedVacId);

  // Verificar mensaje de notificación específico para registro por Administrador
  const [kineRows] = await pool.query('SELECT name, last_name FROM users WHERE id = ?', [otherKineId]);
  const expectedFullName = `${kineRows[0].name} ${kineRows[0].last_name}`.trim();
  const [notifRows] = await pool.query(
    "SELECT title, message, metadata FROM notifications WHERE type = 'KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS' ORDER BY id DESC LIMIT 1"
  );
  assert.ok(notifRows.length > 0);
  assert.ok(notifRows[0].title.includes('Admin'));
  assert.ok(notifRows[0].message.includes(expectedFullName));
  assert.ok(notifRows[0].message.includes(vacStart));
  assert.ok(notifRows[0].message.includes(vacEnd));
  assert.ok(notifRows[0].message.includes('cancelado'));

  // Verificar notificación individual en vacation_cancellation_notifications con nombre de profesional
  const [vcnRows] = await pool.query(
    'SELECT * FROM vacation_cancellation_notifications WHERE vacation_id = ?',
    [adminCreatedVacId]
  );
  assert.equal(vcnRows.length, 1);
  assert.equal(vcnRows[0].kinesiologist_name, expectedFullName);
  assert.equal(vcnRows[0].tracking_status, 'pending_notification');
  assert.ok(vcnRows[0].whatsapp_message.includes(expectedFullName));
});

test('12. Disponibilidad bloqueada SOLO dentro del período [startDate, endDate] inclusive', async () => {
  const [dayBefore, vacStart, vacEnd, dayAfter] = workingDaysWindow;

  // Antes de startDate sigue disponible -> 201 Created
  const beforeVacRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: otherKineId,
      serviceId: 1,
      startTime: `${dayBefore} 10:00:00`,
      endTime: `${dayBefore} 10:45:00`,
      notes: 'Turno antes del inicio de vacaciones admin'
    });
  assert.equal(beforeVacRes.status, 201);
  adminTestAppointmentIds.push(beforeVacRes.body.data.id);

  // En startDate bloqueado -> 409
  const onStartRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: otherKineId,
      serviceId: 1,
      startTime: `${vacStart} 10:00:00`,
      endTime: `${vacStart} 10:45:00`,
      notes: 'Intento primer día de vacaciones'
    });
  assert.equal(onStartRes.status, 409);

  // En endDate bloqueado -> 409
  const onEndRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: otherKineId,
      serviceId: 1,
      startTime: `${vacEnd} 10:00:00`,
      endTime: `${vacEnd} 10:45:00`,
      notes: 'Intento último día de vacaciones'
    });
  assert.equal(onEndRes.status, 409);

  // Después de endDate vuelve a estar disponible -> 201 Created
  const afterVacRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: otherKineId,
      serviceId: 1,
      startTime: `${dayAfter} 10:00:00`,
      endTime: `${dayAfter} 10:45:00`,
      notes: 'Turno después de vacaciones admin'
    });
  assert.equal(afterVacRes.status, 201);
  adminTestAppointmentIds.push(afterVacRes.body.data.id);

  // Portal del paciente: sin slots disponibles durante las vacaciones, con slots fuera del período
  const slotsDuringRes = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({
      kinesiologistId: otherKineId,
      serviceId: 1,
      date: vacStart
    });
  assert.equal(slotsDuringRes.status, 200);
  assert.deepEqual(slotsDuringRes.body.data, []);

  const slotsAfterRes = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({
      kinesiologistId: otherKineId,
      serviceId: 1,
      date: dayAfter
    });
  assert.equal(slotsAfterRes.status, 200);
  assert.ok(Array.isArray(slotsAfterRes.body.data) && slotsAfterRes.body.data.length > 0);
});

test('13. Recepción visualiza notificación de vacación admin y la marca enviada; Admin cancela período futuro y restablece agenda', async () => {
  const [, , , , cancelTargetDay] = workingDaysWindow;

  // Alerta visible para recepción y admin con createdByRole === 'admin'
  const alertsRes = await request(app)
    .post('/api/v1/vacations/alerts')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});
  assert.equal(alertsRes.status, 200);
  const foundAlert = alertsRes.body.data.find((a) => a.id === adminCreatedVacId);
  assert.ok(foundAlert);
  assert.equal(foundAlert.createdByRole, 'admin');
  assert.equal(foundAlert.pendingAffectedCount, 1);

  // Kinesiólogo destinatario también ve su vacación creada por admin en su listado propio
  const kineOwnSearch = await request(app)
    .post('/api/v1/vacations/search')
    .set('Authorization', `Bearer ${otherKineToken}`)
    .send({});
  assert.equal(kineOwnSearch.status, 200);
  assert.ok(kineOwnSearch.body.data.some((v) => v.id === adminCreatedVacId && v.createdByRole === 'admin'));

  // Recepcionista consulta y marca notificado el turno cancelado por admin
  const notifsRes = await request(app)
    .post('/api/v1/vacations/cancellation-notifications')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ vacationId: adminCreatedVacId, trackingStatus: 'pending_notification' });
  assert.equal(notifsRes.status, 200);
  assert.equal(notifsRes.body.data.items.length, 1);

  const markRes = await request(app)
    .post('/api/v1/vacations/mark-notification-sent')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ notificationId: notifsRes.body.data.items[0].id });
  assert.equal(markRes.status, 200);
  assert.equal(markRes.body.data.tracking_status, 'notified');

  // Admin registra otro período futuro para kine 2 sin turnos y luego lo cancela restableciendo disponibilidad
  const futureRes = await request(app)
    .post('/api/v1/vacations/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      kinesiologistId: 2,
      startDate: cancelTargetDay,
      endDate: cancelTargetDay,
      notes: 'Período futuro cancelable por admin'
    });
  assert.equal(futureRes.status, 201);
  adminVacFutureCancelId = futureRes.body.data.id;

  const cancelByAdminRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      vacationId: adminVacFutureCancelId,
      reason: 'Reorganización de agenda administrativa'
    });
  assert.equal(cancelByAdminRes.status, 200);
  assert.equal(cancelByAdminRes.body.data.status, 'cancelled');

  // Tras cancelar, el Kinesiólogo 2 vuelve a tener disponibilidad el cancelTargetDay
  const restoredApptRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${cancelTargetDay} 10:00:00`,
      endTime: `${cancelTargetDay} 10:45:00`,
      notes: 'Turno tras cancelación admin'
    });
  assert.equal(restoredApptRes.status, 201);
  adminTestAppointmentIds.push(restoredApptRes.body.data.id);
});

const cancelExtraVacationIds = [];
const cancelExtraAppointmentIds = [];

test('14. Cancelación de vacaciones futuras con turnos ya cancelados: libera disponibilidad sin reactivar turnos ni duplicar notificaciones', async () => {
  const pool = getPool();
  const [notifCountBeforeRows] = await pool.query(
    'SELECT COUNT(*) as total FROM vacation_cancellation_notifications WHERE vacation_id = ?',
    [vacationWithTurnosId]
  );
  const notifCountBefore = Number(notifCountBeforeRows[0].total);
  assert.equal(notifCountBefore, 2);

  // Antes de cancelar, 2027-05-13 está bloqueado
  const slotsBlocked = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ kinesiologistId: 2, serviceId: 1, date: '2027-05-13' });
  assert.equal(slotsBlocked.status, 200);
  assert.deepEqual(slotsBlocked.body.data, []);

  // Cancelar vacaciones futuras con motivo explícito
  const cancelRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      vacationId: vacationWithTurnosId,
      reason: 'Reincorporación antes de mayo'
    });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.success, true);
  assert.equal(cancelRes.body.data.status, 'cancelled');
  assert.equal(cancelRes.body.data.wasInProgress, false);
  assert.equal(cancelRes.body.data.cancellationReason, 'Reincorporación antes de mayo');
  assert.equal(cancelRes.body.data.cancelledBy, 2);
  assert.ok(cancelRes.body.data.cancelledAt);
  assert.equal(cancelRes.body.data.effectiveEndDate, null);

  // Verificar que se conservaron notas originales, registro en BD y auditoría
  const [vacRows] = await pool.query(
    `SELECT status, notes, DATE_FORMAT(cancelled_at, '%Y-%m-%d %H:%i:%s') as cancelled_at,
            cancelled_by, cancellation_reason, effective_end_date
     FROM kinesiologist_vacations WHERE id = ?`,
    [vacationWithTurnosId]
  );
  assert.equal(vacRows.length, 1);
  assert.equal(vacRows[0].status, 'cancelled');
  assert.equal(vacRows[0].notes, 'Vacaciones de mayo con cancelación automática');
  assert.equal(vacRows[0].cancelled_by, 2);
  assert.equal(vacRows[0].cancellation_reason, 'Reincorporación antes de mayo');
  assert.equal(vacRows[0].effective_end_date, null);
  assert.ok(vacRows[0].cancelled_at);

  const [auditRows] = await pool.query(
    `SELECT action, user_id FROM audit_logs
     WHERE entity_type = 'kinesiologist_vacations' AND entity_id = ? AND action = 'KINESIOLOGIST_VACATION_CANCELLED'`,
    [String(vacationWithTurnosId)]
  );
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].user_id, 2);

  // Verificar que los turnos ya cancelados NO se reactivaron ni eliminaron
  const [apptRows] = await pool.query(
    'SELECT id, status, cancellation_reason, cancelled_by_vacation_id FROM appointments WHERE id IN (?, ?) ORDER BY id ASC',
    [apptInside1Id, apptInside2Id]
  );
  assert.equal(apptRows.length, 2);
  for (const row of apptRows) {
    assert.equal(row.status, 'cancelled');
    assert.equal(row.cancellation_reason, 'Vacaciones del kinesiólogo');
    assert.equal(row.cancelled_by_vacation_id, vacationWithTurnosId);
  }

  // Verificar que NO se generaron notificaciones duplicadas
  const [notifCountAfterRows] = await pool.query(
    'SELECT COUNT(*) as total FROM vacation_cancellation_notifications WHERE vacation_id = ?',
    [vacationWithTurnosId]
  );
  assert.equal(Number(notifCountAfterRows[0].total), notifCountBefore);

  // Disponibilidad restablecida dentro de la ventana reservable: probar también con adminCreatedVacId (que está en workingDaysWindow)
  const adminCancelRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      vacationId: adminCreatedVacId,
      reason: 'Cancelación administrativa de licencia futura'
    });
  assert.equal(adminCancelRes.status, 200);
  assert.equal(adminCancelRes.body.data.status, 'cancelled');
  assert.equal(adminCancelRes.body.data.cancelledBy, 1);

  const [, vacStart] = workingDaysWindow;
  const freedPortalSlots = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({ kinesiologistId: otherKineId, serviceId: 1, date: vacStart });
  assert.equal(freedPortalSlots.status, 200);
  assert.ok(Array.isArray(freedPortalSlots.body.data) && freedPortalSlots.body.data.length > 0);

  const freedCalendarRes = await request(app)
    .post('/api/v1/patient-portal/calendar-availability')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({ kinesiologistId: otherKineId });
  assert.equal(freedCalendarRes.status, 200);
  const dayEvalAfter = freedCalendarRes.body.data.days.find((d) => d.date === vacStart);
  assert.ok(dayEvalAfter && dayEvalAfter.available === true);

  const rebookRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: otherKineId,
      serviceId: 1,
      startTime: `${vacStart} 12:00:00`,
      endTime: `${vacStart} 12:45:00`,
      notes: 'Nuevo turno luego de cancelar vacaciones futuras'
    });
  assert.equal(rebookRes.status, 201);
  cancelExtraAppointmentIds.push(rebookRes.body.data.id);
});

test('15. Cancelación de vacaciones en curso: disponibilidad desde fecha de cancelación, historial previo conservado y sin reactivar turnos', async () => {
  const pool = getPool();
  const today = getClinicDateString(new Date());
  const yesterday = addCalendarDays(today, -1);
  const twoDaysAgo = addCalendarDays(today, -2);
  const futureWorkingDay = workingDaysWindow[3]; // Día hábil futuro dentro de ventana de 14 días

  // Crear vacación en curso [twoDaysAgo, futureWorkingDay] para kinesiologist 2
  const [vacInsert] = await pool.query(
    `INSERT INTO kinesiologist_vacations
       (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
     VALUES (2, ?, ?, 'active', 'Licencia en curso original', 1, 2)`,
    [twoDaysAgo, futureWorkingDay]
  );
  const activeVacationId = vacInsert.insertId;
  cancelExtraVacationIds.push(activeVacationId);

  // Simular turno que había sido cancelado automáticamente durante esas vacaciones en curso
  const [cancelledApptRes] = await pool.query(
    `INSERT INTO appointments
       (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, cancellation_reason, cancelled_by_vacation_id, agreed_price, currency, created_by)
     VALUES (?, 2, 1, ?, ?, 'cancelled', 'Turno cancelado por vacación en curso', 'Vacaciones del kinesiólogo', ?, 3000, 'ARS', 1)`,
    [testPatientId, `${yesterday} 10:00:00`, `${yesterday} 10:45:00`, activeVacationId]
  );
  const activeCancelledApptId = cancelledApptRes.insertId;
  cancelExtraAppointmentIds.push(activeCancelledApptId);

  // Verificar que mientras está en curso, bloquea disponibilidad en días restantes y hoy
  const calBlockedRes = await request(app)
    .post('/api/v1/appointments/calendar-availability')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ kinesiologistId: 2 });
  assert.equal(calBlockedRes.status, 200);
  const blockedDay = calBlockedRes.body.data.days.find((d) => d.date === futureWorkingDay);
  assert.ok(blockedDay && blockedDay.available === false && blockedDay.reasonCode === 'KINESIOLOGIST_VACATION');

  // Seguridad cruzada: otro kinesiólogo NO puede cancelar las vacaciones de kine 2 -> 403
  const forbiddenOtherKine = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${otherKineToken}`)
    .send({ vacationId: activeVacationId, reason: 'Intento cruzado no permitido' });
  assert.equal(forbiddenOtherKine.status, 403);

  // Kinesiólogo 2 cancela sus propias vacaciones en curso
  const cancelRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      vacationId: activeVacationId,
      reason: 'Alta médica anticipada'
    });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.success, true);
  assert.equal(cancelRes.body.data.status, 'cancelled');
  assert.equal(cancelRes.body.data.wasInProgress, true);
  assert.equal(cancelRes.body.data.freedFromDate, today);
  assert.equal(cancelRes.body.data.effectiveEndDate, yesterday);
  assert.equal(cancelRes.body.data.cancelledBy, 2);
  assert.equal(cancelRes.body.data.cancellationReason, 'Alta médica anticipada');

  // Verificar registro histórico completo en BD
  const [dbRows] = await pool.query(
    `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
            DATE_FORMAT(effective_end_date, '%Y-%m-%d') as effective_end_date,
            DATE_FORMAT(cancelled_at, '%Y-%m-%d %H:%i:%s') as cancelled_at,
            status, notes, cancelled_by, cancellation_reason
     FROM kinesiologist_vacations WHERE id = ?`,
    [activeVacationId]
  );
  assert.equal(dbRows[0].status, 'cancelled');
  assert.equal(dbRows[0].start_date, twoDaysAgo);
  assert.equal(dbRows[0].end_date, futureWorkingDay);
  assert.equal(dbRows[0].effective_end_date, yesterday);
  assert.equal(dbRows[0].notes, 'Licencia en curso original');
  assert.equal(dbRows[0].cancelled_by, 2);
  assert.equal(dbRows[0].cancellation_reason, 'Alta médica anticipada');
  assert.ok(dbRows[0].cancelled_at);

  // Verificar que el turno previo sigue cancelado (no reactivado ni eliminado)
  const [apptCheck] = await pool.query(
    'SELECT status, cancelled_by_vacation_id FROM appointments WHERE id = ?',
    [activeCancelledApptId]
  );
  assert.equal(apptCheck.length, 1);
  assert.equal(apptCheck[0].status, 'cancelled');
  assert.equal(apptCheck[0].cancelled_by_vacation_id, activeVacationId);

  // Verificar disponibilidad inmediata desde la fecha de cancelación en agenda, calendario y portal
  const calAfterRes = await request(app)
    .post('/api/v1/appointments/calendar-availability')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ kinesiologistId: 2 });
  assert.equal(calAfterRes.status, 200);
  const freedFutureDay = calAfterRes.body.data.days.find((d) => d.date === futureWorkingDay);
  assert.ok(freedFutureDay && freedFutureDay.available === true);

  const slotsAfterRes = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientUserToken}`)
    .send({ kinesiologistId: 2, serviceId: 1, date: futureWorkingDay });
  assert.equal(slotsAfterRes.status, 200);
  assert.ok(Array.isArray(slotsAfterRes.body.data) && slotsAfterRes.body.data.length > 0);

  const bookAfterRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${futureWorkingDay} 15:00:00`,
      endTime: `${futureWorkingDay} 15:45:00`,
      notes: 'Turno en fecha liberada tras cancelar vacación en curso'
    });
  assert.equal(bookAfterRes.status, 201);
  cancelExtraAppointmentIds.push(bookAfterRes.body.data.id);
});

test('16. Admin cancela vacaciones en curso de un kinesiólogo y bloqueo de re-cancelación / períodos finalizados', async () => {
  const pool = getPool();
  const today = getClinicDateString(new Date());
  const yesterday = addCalendarDays(today, -1);
  const fiveDaysAgo = addCalendarDays(today, -5);
  const futureWorkingDay = workingDaysWindow[4];

  // Vacación en curso para otherKineId (inicia hoy)
  const [activeTodayRes] = await pool.query(
    `INSERT INTO kinesiologist_vacations
       (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
     VALUES (?, ?, ?, 'active', 'Licencia iniciada hoy', 0, 1)`,
    [otherKineId, today, futureWorkingDay]
  );
  const activeTodayVacId = activeTodayRes.insertId;
  cancelExtraVacationIds.push(activeTodayVacId);

  const adminCancelActive = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ vacationId: activeTodayVacId, reason: 'Cancelado por admin el mismo día de inicio' });
  assert.equal(adminCancelActive.status, 200);
  assert.equal(adminCancelActive.body.data.status, 'cancelled');
  assert.equal(adminCancelActive.body.data.cancelledBy, 1);
  assert.equal(adminCancelActive.body.data.effectiveEndDate, null);

  // Re-cancelar una vacación ya cancelada -> 409 Conflict
  const doubleCancel = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ vacationId: activeTodayVacId, reason: 'Intento duplicado' });
  assert.equal(doubleCancel.status, 409);

  // Vacación ya finalizada (end_date < today) -> 400 BadRequest
  const [completedInsert] = await pool.query(
    `INSERT INTO kinesiologist_vacations
       (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
     VALUES (2, ?, ?, 'completed', 'Vacación pasada finalizada', 0, 2)`,
    [fiveDaysAgo, yesterday]
  );
  const completedVacId = completedInsert.insertId;
  cancelExtraVacationIds.push(completedVacId);

  const cancelCompletedRes = await request(app)
    .post('/api/v1/vacations/cancel')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ vacationId: completedVacId, reason: 'No debería permitirse' });
  assert.equal(cancelCompletedRes.status, 400);
});

test('17. Concurrencia simultánea al cancelar el mismo período: solo una petición tiene éxito y una sola entrada de auditoría', async () => {
  const pool = getPool();
  const concurrentDay = workingDaysWindow[2];

  const [concurrentInsert] = await pool.query(
    `INSERT INTO kinesiologist_vacations
       (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
     VALUES (2, ?, ?, 'scheduled', 'Prueba concurrencia cancelación', 0, 2)`,
    [concurrentDay, concurrentDay]
  );
  const concurrentVacId = concurrentInsert.insertId;
  cancelExtraVacationIds.push(concurrentVacId);

  // Lanzar cancelación simultánea por kinesiólogo y administrador al mismo tiempo
  const [resA, resB] = await Promise.all([
    request(app)
      .post('/api/v1/vacations/cancel')
      .set('Authorization', `Bearer ${kinesiologistToken}`)
      .send({ vacationId: concurrentVacId, reason: 'Cancelación A' }),
    request(app)
      .post('/api/v1/vacations/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vacationId: concurrentVacId, reason: 'Cancelación B' })
  ]);

  const statuses = [resA.status, resB.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);

  // Exactamente una entrada en audit_logs para esta cancelación
  const [auditRows] = await pool.query(
    `SELECT id, user_id FROM audit_logs
     WHERE entity_type = 'kinesiologist_vacations' AND entity_id = ? AND action = 'KINESIOLOGIST_VACATION_CANCELLED'`,
    [String(concurrentVacId)]
  );
  assert.equal(auditRows.length, 1);
});

test('18. Limpieza completa de datos de prueba', async () => {
  const pool = getPool();
  const allAppts = [
    apptBeforeId,
    apptInside1Id,
    apptInside2Id,
    apptAfterId,
    ...adminTestAppointmentIds,
    ...cancelExtraAppointmentIds
  ].filter(Boolean);
  if (allAppts.length > 0) {
    await pool.query('DELETE FROM appointments WHERE id IN (?)', [allAppts]);
  }
  const allVacations = [
    vacationNoTurnosId,
    vacationWithTurnosId,
    adminCreatedVacId,
    adminVacFutureCancelId,
    ...cancelExtraVacationIds
  ].filter(Boolean);
  if (allVacations.length > 0) {
    await pool.query("DELETE FROM audit_logs WHERE entity_type = 'kinesiologist_vacations' AND entity_id IN (?)", [
      allVacations.map((id) => String(id))
    ]);
    await pool.query('DELETE FROM kinesiologist_vacations WHERE id IN (?)', [allVacations]);
  }
  await pool.query("DELETE FROM notifications WHERE type IN ('KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS', 'APPOINTMENT_REASSIGNED')");
  if (createdOtherKine && otherKineId && otherKineId !== 2) {
    await pool.query('DELETE FROM users WHERE id = ?', [otherKineId]);
  }
});
