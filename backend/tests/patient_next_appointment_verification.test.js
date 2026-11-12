import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool } from '../src/config/database.js';
import { holidayService } from '../src/services/holidayService.js';

function makeToken(payload) {
  return jwt.sign(
    { type: 'access', ...payload },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
}

const adminToken = makeToken({ userId: 1, role: 'admin', email: 'admin@kinesiologia.com' });
const timestamp = Date.now();
const testEmail = `patient.flow.${timestamp}@example.com`;
const testDni = `DNI${timestamp.toString().slice(-8)}`;

let validBookingDate1 = null;
let validBookingDate2 = null;

async function ensureValidBookingDates() {
  if (validBookingDate1 && validBookingDate2) return;
  const cal = await holidayService.getCalendarAvailability({});
  const futureAvailable = cal.days.filter((d) => d.available && d.date > cal.minDate);
  validBookingDate1 = futureAvailable[0]?.date || cal.firstAvailableDate;
  validBookingDate2 = futureAvailable[1]?.date || futureAvailable[0]?.date || cal.firstAvailableDate;
}

let patientUserId = null;
let patientId = null;
let patientToken = null;
let appt1Id = null;
let appt2Id = null;

test.after(async () => {
  const pool = getPool();
  if (patientId) {
    await pool.execute('DELETE FROM appointments WHERE patient_id = ?', [patientId]);
    await pool.execute('DELETE FROM patients WHERE id = ?', [patientId]);
  }
  if (patientUserId) {
    await pool.execute('DELETE FROM users WHERE id = ?', [patientUserId]);
  }
  await pool.end();
});

test('1. Setup paciente: Registro, activación y token de paciente', async () => {
  await ensureValidBookingDates();
  const regRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Elena',
      lastName: 'Turnos',
      email: testEmail,
      password: 'Password123!',
      dni: testDni,
      phone: '+5491122334455'
    });

  assert.strictEqual(regRes.status, 201);
  patientUserId = regRes.body.data.user.id;
  patientId = regRes.body.data.patientId;

  // Activar email para login
  const pool = getPool();
  await pool.execute('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, is_active = 1 WHERE id = ?', [patientUserId]);

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: testEmail,
      password: 'Password123!'
    });
  assert.strictEqual(loginRes.status, 200);
  patientToken = loginRes.body.data.accessToken;
  assert.ok(patientToken);
});

test('2. Paciente sin turnos: Dashboard retorna nextAppointment null', async () => {
  const dashRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  assert.strictEqual(dashRes.body.success, true);
  assert.strictEqual(dashRes.body.data.nextAppointment, null, 'nextAppointment debe ser null cuando no hay turnos futuros');
});

test('3. Administrador asigna turno futuro: Aparece en nextAppointment con fecha, hora, kine, servicio y estado', async () => {
  const startTime = `${validBookingDate2} 15:00:00`;
  const endTime = `${validBookingDate2} 15:45:00`;

  const createRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime,
      endTime,
      notes: 'Turno inicial asignado por admin'
    });

  assert.strictEqual(createRes.status, 201);
  appt1Id = createRes.body.data.id;

  // Paciente consulta su dashboard sin cerrar sesión
  const dashRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  const nextAppt = dashRes.body.data.nextAppointment;
  assert.ok(nextAppt, 'Debe existir nextAppointment');
  assert.strictEqual(nextAppt.id, appt1Id);
  assert.ok(nextAppt.start_time, 'Debe incluir start_time');
  assert.ok(nextAppt.service_name, 'Debe incluir service_name');
  assert.ok(nextAppt.status, 'Debe incluir status');
  assert.ok(nextAppt.kinesiologist_name || nextAppt.kinesiologist_last_name, 'Debe incluir profesional');
});

test('4. Administrador asigna un segundo turno más temprano: nextAppointment prioriza el cronológicamente más próximo', async () => {
  const earlierStartTime = `${validBookingDate1} 09:00:00`;
  const earlierEndTime = `${validBookingDate1} 09:45:00`;

  const createRes = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      patientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: earlierStartTime,
      endTime: earlierEndTime,
      notes: 'Turno más cercano'
    });

  assert.strictEqual(createRes.status, 201);
  appt2Id = createRes.body.data.id;

  const dashRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  const nextAppt = dashRes.body.data.nextAppointment;
  assert.ok(nextAppt);
  assert.strictEqual(nextAppt.id, appt2Id, 'El turno más próximo cronológicamente debe ser el mostrado');
});

test('5. Administrador cancela el turno más próximo: El dashboard muestra el turno siguiente automáticamente', async () => {
  const cancelRes = await request(app)
    .patch(`/api/v1/appointments/${appt2Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'cancelled',
      notes: 'Cancelado por solicitud médica'
    });

  assert.strictEqual(cancelRes.status, 200);

  const dashRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  const nextAppt = dashRes.body.data.nextAppointment;
  assert.ok(nextAppt);
  assert.strictEqual(nextAppt.id, appt1Id, 'El turno cancelado no debe aparecer, debe mostrar appt1');
  assert.notStrictEqual(nextAppt.status, 'cancelled');
});

test('6. Administrador reprograma el turno restante: El nuevo horario se refleja en el portal', async () => {
  const updatedStartTime = `${validBookingDate2} 17:00:00`;
  const updatedEndTime = `${validBookingDate2} 17:45:00`;

  const updateRes = await request(app)
    .patch(`/api/v1/appointments/${appt1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      startTime: updatedStartTime,
      endTime: updatedEndTime,
      notes: 'Horario modificado por administración'
    });

  assert.strictEqual(updateRes.status, 200);

  const dashRes = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({});

  assert.strictEqual(dashRes.status, 200);
  const nextAppt = dashRes.body.data.nextAppointment;
  assert.ok(nextAppt);
  assert.strictEqual(nextAppt.id, appt1Id);
  const d = new Date(nextAppt.start_time);
  const argTime = d.toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false
  });
  assert.ok(
    argTime.includes('17:00') || String(nextAppt.start_time).includes('17:00') || String(nextAppt.start_time).includes('20:00'),
    `La hora modificada debe verse reflejada (recibido: ${nextAppt.start_time}, hora AR: ${argTime})`
  );
});
