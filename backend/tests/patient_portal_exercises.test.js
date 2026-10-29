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
      "SELECT id FROM users WHERE email LIKE 'paciente.portal.%@test.com'"
    );
    if (testUsers.length > 0) {
      const ids = testUsers.map(u => u.id);
      const [testPatients] = await pool.query(
        "SELECT id FROM patients WHERE user_id IN (?)",
        [ids]
      );
      if (testPatients.length > 0) {
        const pIds = testPatients.map(p => p.id);
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
    console.error('Cleanup error in patient_portal_exercises.test.js:', e);
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

const kinesiologistToken = makeToken({ userId: 2, role: 'kinesiologist', email: 'lucas.kine@kinesiologia.com' });
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });

let patientAUserId = null;
let patientAPatientId = null;
let patientAToken = null;

let patientBUserId = null;
let patientBPatientId = null;
let patientBToken = null;

let patientATreatmentId = null;
let patientARoutineId = null;
let patientARoutineExerciseId = null;
let sampleExerciseId = null;

test('0. Setup: Preparar pacientes A y B con rutinas y ejercicios para pruebas clínicas', async () => {
  const ts = Date.now();

  // 1. Obtener o insertar un ejercicio del catálogo
  let exRows = await query('SELECT id FROM exercises WHERE is_active = 1 LIMIT 1');
  if (exRows.length === 0) {
    const exRes = await query(`
      INSERT INTO exercises (name, category, body_zone, difficulty_level, instructions)
      VALUES ('Puente de glúteos portal test', 'Fortalecimiento', 'Cadera y pelvis', 'Principiante', 'Elevar cadera con control')
    `);
    sampleExerciseId = exRes.insertId;
  } else {
    sampleExerciseId = exRows[0].id;
  }

  // 2. Crear usuario y ficha de Paciente A
  const uARes = await query(`
    INSERT INTO users (role_id, email, password_hash, name, last_name, is_active)
    VALUES (4, 'paciente.portal.a.${ts}@test.com', 'hash_test', 'PacienteA', 'Test', 1)
  `);
  patientAUserId = uARes.insertId;
  const pARes = await query(`
    INSERT INTO patients (user_id, first_name, last_name, dni, email, birth_date, phone, is_active)
    VALUES (?, 'PacienteA', 'Test', 'DNI-A-${ts}', 'paciente.portal.a.${ts}@test.com', '1990-01-01', '+5491100000001', 1)
  `, [patientAUserId]);
  patientAPatientId = pARes.insertId;

  patientAToken = makeToken({ userId: patientAUserId, role: 'patient', email: `paciente.portal.a.${ts}@test.com` });

  // 3. Crear usuario y ficha de Paciente B
  const uBRes = await query(`
    INSERT INTO users (role_id, email, password_hash, name, last_name, is_active)
    VALUES (4, 'paciente.portal.b.${ts}@test.com', 'hash_test', 'PacienteB', 'Test', 1)
  `);
  patientBUserId = uBRes.insertId;
  const pBRes = await query(`
    INSERT INTO patients (user_id, first_name, last_name, dni, email, birth_date, phone, is_active)
    VALUES (?, 'PacienteB', 'Test', 'DNI-B-${ts}', 'paciente.portal.b.${ts}@test.com', '1992-02-02', '+5491100000002', 1)
  `, [patientBUserId]);
  patientBPatientId = pBRes.insertId;

  patientBToken = makeToken({ userId: patientBUserId, role: 'patient', email: `paciente.portal.b.${ts}@test.com` });

  // 4. Crear tratamiento y rutina activa para Paciente A prescrita por kinesiólogo (ID 2)
  const tRes = await query(`
    INSERT INTO treatments (patient_id, kinesiologist_id, title, diagnosis_summary, objectives, start_date, status)
    VALUES (?, 2, 'Tratamiento Lumbalgia Paciente A', 'Lumbalgia mecánica', 'Disminuir dolor', CURRENT_DATE, 'active')
  `, [patientAPatientId]);
  patientATreatmentId = tRes.insertId;

  const rRes = await query(`
    INSERT INTO treatment_routines (
      treatment_id, patient_id, kinesiologist_id, name, description,
      status, version, is_current, valid_from, valid_until, notes
    )
    VALUES (?, ?, 2, 'Rutina Fase 1: Descompresión y Core', 'Ejercicios diarios matutinos', 'active', 1, 1, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), 'Mantener respiración fluida')
  `, [patientATreatmentId, patientAPatientId]);
  patientARoutineId = rRes.insertId;

  // 5. Vincular ejercicio a la rutina de Paciente A
  const reRes = await query(`
    INSERT INTO routine_exercises (
      routine_id, exercise_id, sets, repetitions, rest_seconds,
      weekly_frequency, body_side, resistance_load, custom_instructions, execution_order
    )
    VALUES (?, ?, 3, 12, 45, 'Diario', 'Bilateral', 'Peso corporal', 'No arquear columna lumbar en la subida', 1)
  `, [patientARoutineId, sampleExerciseId]);
  patientARoutineExerciseId = reRes.insertId;

  assert.ok(patientARoutineExerciseId > 0, 'Configuración inicial completada con éxito');
});

test('Portal Ejercicios 1. Recepcionista no puede acceder a las rutinas de pacientes (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/my-routines')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});

  assert.strictEqual(res.status, 403);
});

test('Portal Ejercicios 2. Paciente A consulta sus rutinas asignadas y sus ejercicios en orden', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/my-routines')
    .set('Authorization', `Bearer ${patientAToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.strictEqual(res.body.data.length, 1);

  const routine = res.body.data[0];
  assert.strictEqual(routine.id, patientARoutineId);
  assert.strictEqual(routine.name, 'Rutina Fase 1: Descompresión y Core');
  assert.strictEqual(routine.is_current, 1);
  assert.strictEqual(routine.exercises_count, 1);
  assert.ok(Array.isArray(routine.exercises));
  assert.strictEqual(routine.exercises.length, 1);

  const ex = routine.exercises[0];
  assert.strictEqual(ex.routine_exercise_id, patientARoutineExerciseId);
  assert.strictEqual(ex.sets, 3);
  assert.strictEqual(ex.repetitions, 12);
  assert.strictEqual(ex.rest_seconds, 45);
  assert.strictEqual(ex.weekly_frequency, 'Diario');
  assert.strictEqual(ex.custom_instructions, 'No arquear columna lumbar en la subida');
  assert.strictEqual(ex.execution_order, 1);
});

test('Portal Ejercicios 3. Dashboard del Paciente A muestra su rutina activa vigente', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientAToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.activeRoutine, 'Debe incluir la rutina activa');
  assert.strictEqual(res.body.data.activeRoutine.id, patientARoutineId);
  assert.strictEqual(res.body.data.activeRoutine.name, 'Rutina Fase 1: Descompresión y Core');
  assert.strictEqual(res.body.data.activeRoutine.exercises_count, 1);
  assert.strictEqual(res.body.data.activeRoutine.completed_today_count, 0);
});

test('Portal Ejercicios 4. Aislamiento y Seguridad: Paciente B NO puede registrar cumplimiento en rutina de Paciente A (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/log-exercise')
    .set('Authorization', `Bearer ${patientBToken}`)
    .send({
      routineExerciseId: patientARoutineExerciseId,
      setsCompleted: 3,
      repsCompleted: 12,
      perceivedPainLevel: 2,
      patientNotes: 'Intento malicioso desde otra cuenta'
    });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

test('Portal Ejercicios 5. Paciente A registra cumplimiento de su ejercicio con parámetros y escala de dolor', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/log-exercise')
    .set('Authorization', `Bearer ${patientAToken}`)
    .send({
      routineExerciseId: patientARoutineExerciseId,
      setsCompleted: 3,
      repsCompleted: 12,
      perceivedPainLevel: 1,
      patientNotes: 'Pude completar todas las repeticiones sin molestia lumbar'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id > 0);
  assert.strictEqual(res.body.data.routineExerciseId, patientARoutineExerciseId);
});

test('Portal Ejercicios 6. El registro de cumplimiento NO modifica la prescripción médica profesional', async () => {
  const reRows = await query('SELECT sets, repetitions, custom_instructions FROM routine_exercises WHERE id = ?', [patientARoutineExerciseId]);
  assert.strictEqual(reRows.length, 1);
  assert.strictEqual(reRows[0].sets, 3, 'Los sets prescritos por el kinesiólogo permanecen intactos');
  assert.strictEqual(reRows[0].repetitions, 12, 'Las repeticiones prescritas permanecen intactas');
  assert.strictEqual(reRows[0].custom_instructions, 'No arquear columna lumbar en la subida');
});

test('Portal Ejercicios 7. Dashboard refleja ahora que el ejercicio fue completado hoy', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/dashboard')
    .set('Authorization', `Bearer ${patientAToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.activeRoutine.completed_today_count, 1);
});

test('Portal Ejercicios 8. Paciente A consulta su historial de cumplimiento terapéutico', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/my-exercise-logs')
    .set('Authorization', `Bearer ${patientAToken}`)
    .send({
      routineId: patientARoutineId
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.strictEqual(res.body.data.length, 1);

  const log = res.body.data[0];
  assert.strictEqual(log.routine_id, patientARoutineId);
  assert.strictEqual(log.routine_exercise_id, patientARoutineExerciseId);
  assert.strictEqual(log.sets_completed, 3);
  assert.strictEqual(log.reps_completed, 12);
  assert.strictEqual(log.perceived_pain_level, 1);
  assert.strictEqual(log.patient_notes, 'Pude completar todas las repeticiones sin molestia lumbar');
  assert.ok(log.exercise_name);
});

test('Portal Ejercicios 9. Paciente B sin rutinas obtiene listado vacío sin errores ni inventos', async () => {
  const res = await request(app)
    .post('/api/v1/patient-portal/my-routines')
    .set('Authorization', `Bearer ${patientBToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.deepStrictEqual(res.body.data, []);
});
