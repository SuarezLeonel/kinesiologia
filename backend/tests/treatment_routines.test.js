import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool, query } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

const adminToken = jwt.sign(
  { type: 'access', userId: 1, role: 'admin', email: 'admin@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

const kinesiologistToken = jwt.sign(
  { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

const receptionistToken = jwt.sign(
  { type: 'access', userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

let testPatientId = null;
let testTreatmentId = null;
let testRoutineId = null;
let newVersionRoutineId = null;

test('Routines 1. Recepcionista no puede consultar ni prescribir rutinas terapéuticas (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/treatments/routines/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

test('Routines 2. Preparar paciente y crear plan de tratamiento para asociar rutinas', async () => {
  // Obtener un paciente existente de la BD
  const patients = await query('SELECT id FROM patients WHERE is_active = 1 LIMIT 1');
  assert.ok(patients.length > 0, 'Debe existir al menos un paciente para la prueba');
  testPatientId = patients[0].id;

  const res = await request(app)
    .post('/api/v1/treatments')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      patientId: testPatientId,
      title: 'Plan Integral de Columna y Cadera Test',
      diagnosisSummary: 'Lumbalgia mecánica crónica con déficit de control motor',
      objectives: 'Restaurar movilidad lumbar y potenciar fuerza en glúteo medio',
      totalPlannedSessions: 12,
      startDate: new Date().toISOString().slice(0, 10)
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id);
  testTreatmentId = res.body.data.id;
});

test('Routines 3. Kinesiólogo prescribe una nueva rutina con ejercicios y parámetros específicos', async () => {
  assert.ok(testTreatmentId);

  // Obtener 2 ejercicios activos del catálogo
  const exercises = await query('SELECT id FROM exercises WHERE is_active = 1 ORDER BY id ASC LIMIT 2');
  assert.ok(exercises.length >= 2, 'Deben existir al menos 2 ejercicios activos en el catálogo');

  const payload = {
    treatmentId: testTreatmentId,
    name: 'Fase 1: Control Motor y Movilidad',
    description: 'Rutina inicial de activación y descompresión lumbopélvica',
    status: 'active',
    validFrom: new Date().toISOString().slice(0, 10),
    notes: 'Realizar después de una caminata suave de calentamiento',
    exercises: [
      {
        exerciseId: exercises[0].id,
        sets: 3,
        repetitions: 12,
        durationSeconds: null,
        restSeconds: 45,
        weeklyFrequency: '3 veces por semana',
        bodySide: 'Bilateral',
        resistanceLoad: 'Peso corporal',
        customInstructions: 'Mantener pelvis neutra sin arquear la zona lumbar',
        executionOrder: 1
      },
      {
        exerciseId: exercises[1].id,
        sets: 4,
        repetitions: 10,
        durationSeconds: 30,
        restSeconds: 60,
        weeklyFrequency: '3 veces por semana',
        bodySide: 'Izquierdo',
        resistanceLoad: 'Banda elástica amarilla',
        customInstructions: 'Foco en la estabilidad rotacional',
        executionOrder: 2
      }
    ]
  };

  const res = await request(app)
    .post('/api/v1/treatments/routines')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send(payload);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id);
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(res.body.data.is_current, 1);
  assert.strictEqual(res.body.data.status, 'active');
  assert.strictEqual(res.body.data.exercises.length, 2);

  // Verificar parámetros del primer ejercicio
  const ex1 = res.body.data.exercises[0];
  assert.strictEqual(ex1.exercise_id, exercises[0].id);
  assert.strictEqual(ex1.sets, 3);
  assert.strictEqual(ex1.repetitions, 12);
  assert.strictEqual(ex1.execution_order, 1);
  assert.strictEqual(ex1.body_side, 'Bilateral');

  // Verificar segundo ejercicio
  const ex2 = res.body.data.exercises[1];
  assert.strictEqual(ex2.exercise_id, exercises[1].id);
  assert.strictEqual(ex2.body_side, 'Izquierdo');
  assert.strictEqual(ex2.resistance_load, 'Banda elástica amarilla');
  assert.strictEqual(ex2.execution_order, 2);

  testRoutineId = res.body.data.id;
});

test('Routines 4. Consulta de rutinas por plan de tratamiento y paciente', async () => {
  assert.ok(testTreatmentId);

  const res = await request(app)
    .post('/api/v1/treatments/routines/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ treatmentId: testTreatmentId });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 1);

  const found = res.body.data.find((r) => r.id === testRoutineId);
  assert.ok(found);
  assert.strictEqual(found.exercises_count, 2);
  assert.strictEqual(found.is_current, 1);
});

test('Routines 5. Edición de rutina activa crea nueva versión clínica (version 2) y archiva la versión original', async () => {
  assert.ok(testRoutineId);

  const exercises = await query('SELECT id FROM exercises WHERE is_active = 1 ORDER BY id ASC LIMIT 2');

  const updatePayload = {
    id: testRoutineId,
    name: 'Fase 1: Control Motor Avanzado',
    description: 'Progresión con mayor volumen de repeticiones',
    changeReason: 'Excelente tolerancia en primera semana de tratamiento',
    exercises: [
      {
        exerciseId: exercises[0].id,
        sets: 4,
        repetitions: 15, // incrementado
        restSeconds: 45,
        weeklyFrequency: '4 veces por semana',
        bodySide: 'Bilateral',
        customInstructions: 'Incremento de repeticiones sin fatiga',
        executionOrder: 1
      }
    ]
  };

  const res = await request(app)
    .post('/api/v1/treatments/routines/update')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send(updatePayload);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id);
  assert.notStrictEqual(res.body.data.id, testRoutineId); // Debe ser un nuevo registro de versión
  assert.strictEqual(res.body.data.version, 2);
  assert.strictEqual(res.body.data.parent_routine_id, testRoutineId);
  assert.strictEqual(res.body.data.is_current, 1);
  assert.strictEqual(res.body.data.exercises.length, 1);
  assert.strictEqual(res.body.data.exercises[0].sets, 4);
  assert.strictEqual(res.body.data.exercises[0].repetitions, 15);

  newVersionRoutineId = res.body.data.id;

  // Verificar que la versión original sigue existiendo pero como archivada y no vigente
  const original = await query('SELECT id, status, is_current, version FROM treatment_routines WHERE id = ?', [testRoutineId]);
  assert.strictEqual(original[0].status, 'archived');
  assert.strictEqual(original[0].is_current, 0);
  assert.strictEqual(original[0].version, 1);
});

test('Routines 6. Consulta de detalle de rutina incluye historial de versiones asociadas', async () => {
  assert.ok(newVersionRoutineId);

  const res = await request(app)
    .post('/api/v1/treatments/routines/detail')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ id: newVersionRoutineId });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.versions);
  assert.ok(Array.isArray(res.body.data.versions));
  assert.ok(res.body.data.versions.length >= 2); // versión 1 y versión 2
});

test('Routines 7. Cambio de estado de rutina a finalizada (completed)', async () => {
  assert.ok(newVersionRoutineId);

  const res = await request(app)
    .post('/api/v1/treatments/routines/status')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      id: newVersionRoutineId,
      status: 'completed'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.status, 'completed');
  assert.strictEqual(res.body.data.is_current, 0);
});

test('Routines 8. Transaccionalidad: rechazar rutina si un ejercicio no existe en catálogo', async () => {
  assert.ok(testTreatmentId);

  const invalidPayload = {
    treatmentId: testTreatmentId,
    name: 'Rutina con Ejercicio Inválido',
    exercises: [
      {
        exerciseId: 9999999, // no existe
        sets: 3,
        repetitions: 10
      }
    ]
  };

  const res = await request(app)
    .post('/api/v1/treatments/routines')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send(invalidPayload);

  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.success, false);

  // Verificar que no se creó ninguna rutina huérfana
  const orphan = await query('SELECT id FROM treatment_routines WHERE name = ?', ['Rutina con Ejercicio Inválido']);
  assert.strictEqual(orphan.length, 0);
});

test('Routines 9. Limpieza de datos de prueba', async () => {
  if (testTreatmentId) {
    await query('DELETE FROM treatments WHERE id = ?', [testTreatmentId]);
  }
});

