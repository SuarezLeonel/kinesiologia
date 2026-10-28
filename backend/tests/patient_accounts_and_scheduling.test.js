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

// Helper para tokens
function makeToken(payload) {
  return jwt.sign(
    { type: 'access', ...payload },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );
}

const adminToken = makeToken({ userId: 1, role: 'admin', email: 'admin@kinesiologia.com' });
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });
const kinesiologistToken = makeToken({ userId: 2, role: 'kinesiologist', email: 'lucas.kine@kinesiologia.com' });

const timestamp = Date.now();

let createdPatientId = null;
let createdPatientEmail = `test.paciente.${timestamp}@example.com`;
let createdPatientDni = `DNI-${timestamp.toString().slice(-8)}`;
let createdAppointmentId = null;
let patientUserId = null;
let patientAuthToken = null;

test('1. Recepcionista crea ficha administrativa sin crear cuenta de usuario ni contraseña', async () => {
  const res = await request(app)
    .post('/api/v1/patients/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      firstName: 'Juan',
      lastName: 'Pérez Test',
      dni: createdPatientDni,
      email: createdPatientEmail,
      phone: '+5491112345678',
      birthDate: '1990-05-15',
      address: 'Av. Corrientes 1234',
      emergencyContact: 'María Pérez (Madre) +5491198765432'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id, 'Debe devolver el ID de la ficha creada');
  createdPatientId = res.body.data.id;

  // Verificamos en DB que user_id sea NULL
  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, user_id FROM patients WHERE id = ?', [createdPatientId]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].user_id, null, 'La ficha debe crearse sin cuenta de usuario asociada');

  // Comprobar detección de duplicados
  const checkRes = await request(app)
    .post('/api/v1/patients/check-duplicate')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ dni: createdPatientDni, email: createdPatientEmail });

  assert.strictEqual(checkRes.status, 200);
  assert.strictEqual(checkRes.body.data.isDuplicate, true);
  assert.ok(checkRes.body.data.existingPatient);
  assert.strictEqual(checkRes.body.data.existingPatient.id, createdPatientId);
});

test('2. Recepcionista reserva turno para paciente sin cuenta y registra snapshot de precio acordado', async () => {
  assert.ok(createdPatientId, 'Se requiere patientId previo');

  // Usamos el servicio 1 (Evaluación Kine Inicial, default_price = 15000.00)
  const startTime = '2027-11-10T10:00:00.000Z';
  const endTime = '2027-11-10T11:00:00.000Z';

  const res = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: createdPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime,
      endTime,
      notes: 'Turno de prueba sin cuenta'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id);
  createdAppointmentId = res.body.data.id;

  // 8. Precio guardado en turno coincide con default_price del servicio al reservar
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT agreed_price, currency FROM appointments WHERE id = ?',
    [createdAppointmentId]
  );
  assert.strictEqual(rows.length, 1);
  assert.ok(Number(rows[0].agreed_price) > 0, 'Debe tener precio acordado guardado');
  assert.strictEqual(rows[0].currency, 'ARS');
});

test('3. Paciente con ficha previa se registra con email coincidente y se vincula automáticamente (Caso A)', async () => {
  const registerRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Juan',
      lastName: 'Pérez Test',
      email: createdPatientEmail,
      password: 'Password123!',
      phone: '+5491112345678'
    });

  assert.strictEqual(registerRes.status, 201);
  assert.strictEqual(registerRes.body.success, true);
  assert.strictEqual(registerRes.body.data.linkedToExistingPatient, true, 'Debe vincularse a la ficha existente');
  assert.strictEqual(registerRes.body.data.patientId, createdPatientId);
  assert.strictEqual(registerRes.body.data.user.role, 'patient');

  patientUserId = registerRes.body.data.user.id;
  patientAuthToken = registerRes.body.data.tokens.accessToken;

  // Comprobar que en la base de datos la ficha ahora tiene user_id
  const pool = getPool();
  const [rows] = await pool.execute('SELECT user_id FROM patients WHERE id = ?', [createdPatientId]);
  assert.strictEqual(rows[0].user_id, patientUserId);
});

test('4. Una cuenta no puede apropiarse de una ficha vinculada a otra persona', async () => {
  // Intentar registrar otro usuario con el mismo email debe fallar por cuenta duplicada
  const duplicateRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Intruso',
      lastName: 'Hacker',
      email: createdPatientEmail,
      password: 'Password123!'
    });

  assert.strictEqual(duplicateRes.status, 409);
  assert.strictEqual(duplicateRes.body.success, false);
});

test('5. Paciente sin ficha previa puede registrarse y se crea su ficha vinculada (Caso B)', async () => {
  const newEmail = `nuevo.paciente.${timestamp}@example.com`;
  const res = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Carla',
      lastName: 'Gómez',
      email: newEmail,
      password: 'Password123!',
      dni: `DNI-${(timestamp + 1).toString().slice(-8)}`,
      phone: '+5491133334444'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.linkedToExistingPatient, false);
  assert.ok(res.body.data.patientId, 'Debe crear una ficha vinculada');

  // Limpiar
  const pool = getPool();
  await pool.execute('DELETE FROM patients WHERE id = ?', [res.body.data.patientId]);
  await pool.execute('DELETE FROM users WHERE id = ?', [res.body.data.user.id]);
});

test('6. Paciente autenticado solo puede consultar sus propios turnos en el portal', async () => {
  assert.ok(patientAuthToken, 'Se requiere token de paciente');

  const res = await request(app)
    .post('/api/v1/patient-portal/my-appointments')
    .set('Authorization', `Bearer ${patientAuthToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  const appointments = Array.isArray(res.body.data) ? res.body.data : res.body.data.appointments;
  assert.ok(Array.isArray(appointments));
  
  // Todos los turnos devueltos deben ser estrictamente del createdPatientId
  for (const appt of appointments) {
    assert.strictEqual(appt.patient_id, createdPatientId);
  }
});

test('7. No se pueden reservar horarios incompatibles de forma simultánea (409 Conflict)', async () => {
  // Intentar crear turno en el mismo rango de createdAppointmentId para el mismo kinesiólogo (ID 2)
  const startTime = '2027-11-10T10:15:00.000Z';
  const endTime = '2027-11-10T10:45:00.000Z';

  const res = await request(app)
    .post('/api/v1/appointments/create')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: createdPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime,
      endTime
    });

  assert.strictEqual(res.status, 409, 'Debe rechazar con 409 por superposición de turnos');
  assert.strictEqual(res.body.success, false);
});

test('8. Portal del paciente: Consulta de catálogo y cálculo de slots disponibles', async () => {
  const catalogRes = await request(app)
    .post('/api/v1/patient-portal/catalog')
    .set('Authorization', `Bearer ${patientAuthToken}`)
    .send({});

  assert.strictEqual(catalogRes.status, 200);
  assert.strictEqual(catalogRes.body.success, true);
  assert.ok(catalogRes.body.data.services.length > 0);
  assert.ok(catalogRes.body.data.professionals.length > 0);

  // Consultar slots disponibles
  const slotsRes = await request(app)
    .post('/api/v1/patient-portal/available-slots')
    .set('Authorization', `Bearer ${patientAuthToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: '2027-11-11'
    });

  assert.strictEqual(slotsRes.status, 200);
  assert.strictEqual(slotsRes.body.success, true);
  const slots = Array.isArray(slotsRes.body.data) ? slotsRes.body.data : slotsRes.body.data.slots;
  assert.ok(Array.isArray(slots));
});

test('9. Cancelación de turno por paciente respeta reglas y no permite cancelar turnos de otros (403 Forbidden)', async () => {
  // Registrar un segundo paciente real
  const secondPatientEmail = `otro.paciente.${timestamp}@example.com`;
  const regRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Segundo',
      lastName: 'Paciente',
      email: secondPatientEmail,
      password: 'Password123!',
      phone: '+5491144445555'
    });
  assert.strictEqual(regRes.status, 201);
  const otherPatientToken = regRes.body.data.tokens.accessToken;
  const otherUserId = regRes.body.data.user.id;
  const otherPatientId = regRes.body.data.patientId;

  // Intento de cancelar el turno de createdPatientId usando la cuenta del segundo paciente
  const unauthorizedRes = await request(app)
    .post('/api/v1/patient-portal/cancel-appointment')
    .set('Authorization', `Bearer ${otherPatientToken}`)
    .send({
      appointmentId: createdAppointmentId,
      reason: 'No puedo asistir'
    });

  assert.strictEqual(unauthorizedRes.status, 403, 'Debe devolver 403 Forbidden al intentar cancelar turnos ajenos');
  assert.strictEqual(unauthorizedRes.body.success, false);

  // Limpiar segundo paciente
  const pool = getPool();
  await pool.execute('DELETE FROM patients WHERE id = ?', [otherPatientId]);
  await pool.execute('DELETE FROM users WHERE id = ?', [otherUserId]);
});

test('10. Solicitud de reprogramación registra estado pending y mantiene intacto el turno original', async () => {
  const newStart = '2027-11-12T15:00:00.000Z';
  const newEnd = '2027-11-12T16:00:00.000Z';

  const res = await request(app)
    .post('/api/v1/patient-portal/request-reschedule')
    .set('Authorization', `Bearer ${patientAuthToken}`)
    .send({
      appointmentId: createdAppointmentId,
      requestedStartTime: newStart,
      requestedEndTime: newEnd,
      reason: 'Cambio de turno en el trabajo'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.status, 'pending');

  // Verificar que el turno original mantiene su horario anterior
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT start_time FROM appointments WHERE id = ?',
    [createdAppointmentId]
  );
  const origDate = new Date(rows[0].start_time);
  assert.strictEqual(origDate.getFullYear(), 2027);
  assert.strictEqual(origDate.getMonth(), 10);
  assert.strictEqual(origDate.getDate(), 10);
});

test('11. Personal autorizado (Recepcionista) aprueba reprogramación y actualiza el turno de forma atómica', async () => {
  // Buscar la solicitud pendiente
  const listRes = await request(app)
    .post('/api/v1/appointments/reschedule-requests')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ status: 'pending' });

  assert.strictEqual(listRes.status, 200);
  const requests = Array.isArray(listRes.body.data) ? listRes.body.data : listRes.body.data.requests;
  assert.ok(requests.length > 0);
  const targetRequest = requests.find(r => r.appointment_id === createdAppointmentId);
  assert.ok(targetRequest, 'Debe encontrar la solicitud');

  // Aprobar
  const approveRes = await request(app)
    .post('/api/v1/appointments/reschedule-requests/respond')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      requestId: targetRequest.id,
      action: 'approve',
      responseNotes: 'Aprobado por recepción'
    });

  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveRes.body.success, true);

  // Verificar que el turno original ahora tiene el nuevo horario
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT start_time FROM appointments WHERE id = ?',
    [createdAppointmentId]
  );
  const updatedDate = new Date(rows[0].start_time);
  assert.strictEqual(updatedDate.getFullYear(), 2027);
  assert.strictEqual(updatedDate.getMonth(), 10); // Noviembre
  assert.strictEqual(updatedDate.getDate(), 12);
});

test('12. Pacientes no pueden acceder a endpoints administrativos o clínicos del personal (403 Forbidden)', async () => {
  const staffEndpoints = [
    { url: '/api/v1/patients/search', body: {} },
    { url: '/api/v1/clinical-records/search', body: {} },
    { url: '/api/v1/payments/search', body: {} },
    { url: '/api/v1/users/search', body: {} }
  ];

  for (const ep of staffEndpoints) {
    const res = await request(app)
      .post(ep.url)
      .set('Authorization', `Bearer ${patientAuthToken}`)
      .send(ep.body);

    assert.strictEqual(
      res.status,
      403,
      `El paciente no debe tener acceso a ${ep.url} (esperado 403 Forbidden)`
    );
  }
});

test('13. Registro público solo otorga rol patient y no permite escalar privilegios', async () => {
  const rogueEmail = `rogue.${timestamp}@example.com`;
  const res = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      firstName: 'Malicioso',
      lastName: 'Usuario',
      email: rogueEmail,
      password: 'Password123!',
      role: 'admin' // Intento de inyectar admin
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.user.role, 'patient', 'El rol asignado siempre debe ser patient');

  // Limpiar
  const pool = getPool();
  await pool.execute('DELETE FROM patients WHERE id = ?', [res.body.data.patientId]);
  await pool.execute('DELETE FROM users WHERE id = ?', [res.body.data.user.id]);
});

test('14. Respuestas de error y endpoints nunca exponen contraseñas ni tokens en el cuerpo', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/my-profile')
    .set('Authorization', `Bearer ${patientAuthToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  const profile = res.body.data.profile || res.body.data;
  assert.strictEqual(profile.password, undefined);
  assert.strictEqual(profile.password_hash, undefined);
  assert.strictEqual(profile.refresh_token, undefined);
});

test('15. Limpieza de datos de prueba', async () => {
  const pool = getPool();
  if (createdAppointmentId) {
    await pool.execute('DELETE FROM appointment_reschedule_requests WHERE appointment_id = ?', [createdAppointmentId]);
    await pool.execute('DELETE FROM appointments WHERE id = ?', [createdAppointmentId]);
  }
  if (createdPatientId) {
    await pool.execute('DELETE FROM notifications WHERE patient_id = ?', [createdPatientId]);
    await pool.execute('DELETE FROM patients WHERE id = ?', [createdPatientId]);
  }
  if (patientUserId) {
    await pool.execute('DELETE FROM users WHERE id = ?', [patientUserId]);
  }
  assert.ok(true);
});
