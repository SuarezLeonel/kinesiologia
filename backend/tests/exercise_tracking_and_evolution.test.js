import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool, query } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  try {
    const [testUsers] = await pool.query(
      "SELECT id FROM users WHERE email LIKE 'paciente.tracking.%@test.com'"
    );
    if (testUsers.length > 0) {
      const ids = testUsers.map(u => u.id);
      const [testPatients] = await pool.query(
        "SELECT id FROM patients WHERE user_id IN (?)",
        [ids]
      );
      if (testPatients.length > 0) {
        const pIds = testPatients.map(p => p.id);
        await pool.query("DELETE FROM session_exercise_executions WHERE routine_id IN (SELECT id FROM treatment_routines WHERE patient_id IN (?)) OR treatment_id IN (SELECT id FROM treatments WHERE patient_id IN (?))", [pIds, pIds]);
        await pool.query("DELETE FROM treatment_sessions WHERE treatment_id IN (SELECT id FROM treatments WHERE patient_id IN (?))", [pIds]);
        await pool.query("DELETE FROM patient_exercise_logs WHERE patient_id IN (?)", [pIds]);
        await pool.query("DELETE FROM routine_exercises WHERE routine_id IN (SELECT id FROM treatment_routines WHERE patient_id IN (?))", [pIds]);
        await pool.query("UPDATE treatment_routines SET parent_routine_id = NULL WHERE patient_id IN (?)", [pIds]);
        await pool.query("DELETE FROM treatment_routines WHERE patient_id IN (?)", [pIds]);
        await pool.query("DELETE FROM treatments WHERE patient_id IN (?)", [pIds]);
        await pool.query("DELETE FROM patients WHERE id IN (?)", [pIds]);
      }
      await pool.query("DELETE FROM auth_refresh_tokens WHERE user_id IN (?)", [ids]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [ids]);
    }
  } catch (e) {
    console.error('Cleanup error in exercise_tracking_and_evolution.test.js:', e);
  }
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
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });

let testPatientUserId = null;
let testPatientId = null;
let patientToken = null;
let testTreatmentId = null;
let testRoutineId = null;
let testRoutineExerciseId = null;
let sampleExerciseId = null;
let testSessionId = null;

test('0. Setup: Crear paciente, tratamiento, rutina y catálogo para pruebas de seguimiento', async () => {
  const ts = Date.now();

  // 1. Catálogo de ejercicio
  let exRows = await query('SELECT id FROM exercises WHERE is_active = 1 LIMIT 1');
  if (exRows.length === 0) {
    const exRes = await query(`
      INSERT INTO exercises (name, category, body_zone, difficulty_level, instructions)
      VALUES ('Sentadilla búlgara guiada test', 'Fuerza', 'Miembro inferior', 'Intermedio', 'Bajar cadera controlada')
    `);
    sampleExerciseId = exRes.insertId;
  } else {
    sampleExerciseId = exRows[0].id;
  }

  // 2. Paciente con usuario
  const uRes = await query(`
    INSERT INTO users (role_id, email, password_hash, name, last_name, is_active)
    VALUES (4, 'paciente.tracking.${ts}@test.com', 'hash_test', 'Juan', 'Tracking', 1)
  `);
  testPatientUserId = uRes.insertId;

  const pRes = await query(`
    INSERT INTO patients (user_id, first_name, last_name, dni, email, birth_date, phone, is_active)
    VALUES (?, 'Juan', 'Tracking', 'DNI-TR-${ts}', 'paciente.tracking.${ts}@test.com', '1988-04-12', '+5491122334455', 1)
  `, [testPatientUserId]);
  testPatientId = pRes.insertId;

  patientToken = makeToken({ userId: testPatientUserId, role: 'patient', email: `paciente.tracking.${ts}@test.com` });

  // 3. Tratamiento creado por kinesiólogo
  const tRes = await query(`
    INSERT INTO treatments (patient_id, kinesiologist_id, title, diagnosis_summary, objectives, start_date, status)
    VALUES (?, 2, 'Rehabilitación de Rodilla Derecha', 'Tendinopatía rotuliana', 'Restablecer tolerancia a la carga excéntrica', CURRENT_DATE, 'active')
  `, [testPatientId]);
  testTreatmentId = tRes.insertId;

  // 4. Rutina activa prescrita
  const rRes = await query(`
    INSERT INTO treatment_routines (
      treatment_id, patient_id, kinesiologist_id, name, description,
      status, version, is_current, valid_from, valid_until, notes
    )
    VALUES (?, ?, 2, 'Rutina Excéntrica Fase 1', 'Fuerza isométrica y excéntrica', 'active', 1, 1, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 21 DAY), 'Realizar lento y con control')
  `, [testTreatmentId, testPatientId]);
  testRoutineId = rRes.insertId;

  // 5. Ejercicio en la rutina
  const reRes = await query(`
    INSERT INTO routine_exercises (
      routine_id, exercise_id, sets, repetitions, rest_seconds,
      weekly_frequency, body_side, resistance_load, custom_instructions, execution_order
    )
    VALUES (?, ?, 3, 10, 60, '3 veces/semana', 'Derecho', 'Mancuerna 4kg', 'Descenso en 3 segundos', 1)
  `, [testRoutineId, sampleExerciseId]);
  testRoutineExerciseId = reRes.insertId;

  assert.ok(testRoutineExerciseId > 0);
});

test('Seguimiento 1. Recepcionista bloqueada para registrar sesiones clínicas y consultar tracking (403 Forbidden)', async () => {
  const sessionRes = await request(app)
    .post('/api/v1/treatments/sessions')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      treatmentId: testTreatmentId,
      sessionNumber: 1,
      sessionDate: '2026-10-29 09:00:00',
      performedProcedures: 'Intento recepcionista',
      patientEvolution: 'Sin autorización'
    });
  assert.strictEqual(sessionRes.status, 403);

  const trackingRes = await request(app)
    .post('/api/v1/treatments/patient-tracking')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: testPatientId
    });
  assert.strictEqual(trackingRes.status, 403);
});

test('Seguimiento 2. Paciente no puede acceder al tracking profesional interno (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/treatments/patient-tracking')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({
      patientId: testPatientId
    });
  assert.strictEqual(res.status, 403);
});

test('Seguimiento 3. Kinesiólogo registra sesión clínica con ejecución de ejercicios supervisados y observaciones', async () => {
  const res = await request(app)
    .post('/api/v1/treatments/sessions')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      treatmentId: testTreatmentId,
      sessionNumber: 1,
      sessionDate: '2026-10-29 10:00:00',
      performedProcedures: 'Terapia manual fascial y progresión de ejercicios con feedback visual',
      patientEvolution: 'Tolera carga excéntrica con dolor 2/10 en flexión profunda',
      painLevelReported: 2,
      observations: 'Buena alineación femoropatelar durante toda la sesión',
      routineId: testRoutineId,
      exercises: [
        {
          exerciseId: sampleExerciseId,
          routineExerciseId: testRoutineExerciseId,
          setsCompleted: 3,
          repsCompleted: 10,
          resistanceLoad: 'Mancuerna 4kg',
          toleranceLevel: 'Buena',
          painLevelReported: 2,
          clinicalObservations: 'Sin compensación en tronco ni valgo dinámico de rodilla',
          futureModificationsSuggested: 'Aumentar a 6kg si mantiene analgesia 48hs'
        }
      ]
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id > 0);
  testSessionId = res.body.data.id;
});

test('Seguimiento 4. Consulta de sesiones de tratamiento incluye ejercicios ejecutados y tolerancia', async () => {
  const res = await request(app)
    .post('/api/v1/treatments/sessions/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      treatmentId: testTreatmentId
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.strictEqual(res.body.data.length, 1);

  const session = res.body.data[0];
  assert.strictEqual(session.session_number, 1);
  assert.strictEqual(session.pain_level_reported, 2);
  assert.ok(Array.isArray(session.exercises));
  assert.strictEqual(session.exercises.length, 1);

  const ex = session.exercises[0];
  assert.strictEqual(ex.exercise_id, sampleExerciseId);
  assert.strictEqual(ex.sets_completed, 3);
  assert.strictEqual(ex.reps_completed, 10);
  assert.strictEqual(ex.tolerance_level, 'Buena');
  assert.strictEqual(ex.clinical_observations, 'Sin compensación en tronco ni valgo dinámico de rodilla');
  assert.strictEqual(ex.future_modifications_suggested, 'Aumentar a 6kg si mantiene analgesia 48hs');
});

test('Seguimiento 5. Paciente registra cumplimiento autónomo en el portal (hogar)', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/log-exercise')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({
      routineExerciseId: testRoutineExerciseId,
      setsCompleted: 3,
      repsCompleted: 10,
      perceivedPainLevel: 1,
      patientNotes: 'Realizado en casa sin dolor residual'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
});

test('Seguimiento 6. Consulta integral de expediente de evolución y seguimiento del paciente', async () => {
  const res = await request(app)
    .post('/api/v1/treatments/patient-tracking')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatientId
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  const data = res.body.data;
  assert.ok(data.patient);
  assert.strictEqual(data.patient.id, testPatientId);

  // 1. Prescripciones y rutinas
  assert.ok(Array.isArray(data.routines));
  assert.strictEqual(data.routines.length, 1);
  assert.strictEqual(data.routines[0].id, testRoutineId);
  assert.strictEqual(data.routines[0].exercises.length, 1);
  assert.strictEqual(data.routines[0].exercises[0].resistance_load, 'Mancuerna 4kg');

  // 2. Cumplimiento informado por el paciente (separado)
  assert.ok(Array.isArray(data.patientReportedLogs));
  assert.strictEqual(data.patientReportedLogs.length, 1);
  assert.strictEqual(data.patientReportedLogs[0].patient_notes, 'Realizado en casa sin dolor residual');
  assert.strictEqual(data.patientReportedLogs[0].perceived_pain_level, 1);

  // 3. Ejecución profesional en consultorio (separado)
  assert.ok(Array.isArray(data.professionalSessions));
  assert.strictEqual(data.professionalSessions.length, 1);
  assert.strictEqual(data.professionalSessions[0].executedExercises.length, 1);
  assert.strictEqual(data.professionalSessions[0].executedExercises[0].tolerance_level, 'Buena');
  assert.strictEqual(data.professionalSessions[0].executedExercises[0].clinical_observations, 'Sin compensación en tronco ni valgo dinámico de rodilla');

  // 4. Métricas factuales
  assert.strictEqual(data.summaryMetrics.totalRoutinesPrescribed, 1);
  assert.strictEqual(data.summaryMetrics.currentRoutinesCount, 1);
  assert.strictEqual(data.summaryMetrics.totalPatientLogsReported, 1);
  assert.strictEqual(data.summaryMetrics.totalProfessionalSessionsConducted, 1);
  assert.strictEqual(data.summaryMetrics.totalExercisesExecutedInClinic, 1);
});

test('Seguimiento 7. Historial inmutable: Modificar prescripción crea nueva versión y preserva sesiones pasadas', async () => {
  // Crear nueva versión clínica de la rutina con carga aumentada a 6kg
  const updateRes = await request(app)
    .post('/api/v1/treatments/routines/update')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      id: testRoutineId,
      name: 'Rutina Excéntrica Fase 2 (Progresión de Carga)',
      changeReason: 'Excelente tolerancia en sesión 1, se incrementa sobrecarga a 6kg',
      status: 'active',
      exercises: [
        {
          exerciseId: sampleExerciseId,
          sets: 3,
          repetitions: 10,
          restSeconds: 60,
          weeklyFrequency: '3 veces/semana',
          bodySide: 'Derecho',
          resistanceLoad: 'Mancuerna 6kg',
          customInstructions: 'Descenso en 3 segundos con 6kg',
          executionOrder: 1
        }
      ]
    });

  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.data.version, 2);

  // Consultar tracking nuevamente
  const res = await request(app)
    .post('/api/v1/treatments/patient-tracking')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatientId
    });

  assert.strictEqual(res.status, 200);
  const data = res.body.data;

  // Verificamos que existen ambas versiones clínicas (v1 archivada y v2 vigente)
  assert.strictEqual(data.routines.length, 2);
  const currentRoutine = data.routines.find(r => r.is_current === 1);
  const archivedRoutine = data.routines.find(r => r.is_current === 0);

  assert.strictEqual(currentRoutine.version, 2);
  assert.strictEqual(currentRoutine.exercises[0].resistance_load, 'Mancuerna 6kg');
  assert.strictEqual(archivedRoutine.version, 1);
  assert.strictEqual(archivedRoutine.exercises[0].resistance_load, 'Mancuerna 4kg');

  // Las sesiones y ejecuciones pasadas registradas en sesión 1 permanecen completamente intactas
  assert.strictEqual(data.professionalSessions.length, 1);
  assert.strictEqual(data.professionalSessions[0].executedExercises[0].resistance_load, 'Mancuerna 4kg');
  assert.strictEqual(data.professionalSessions[0].executedExercises[0].tolerance_level, 'Buena');
});

