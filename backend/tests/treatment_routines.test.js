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
  // Obtener un paciente existente de la BD o crear uno de prueba si la base está limpia
  const patients = await query('SELECT id FROM patients WHERE is_active = 1 LIMIT 1');
  if (patients.length > 0) {
    testPatientId = patients[0].id;
  } else {
    const pDni = `TR-PAT-${Date.now().toString().slice(-8)}`;
    const pRes = await query(
      `INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, is_active)
       VALUES ('Paciente', 'Test Rutina', ?, '1990-01-01', '1122334455', 'paciente.rutina@test.com', 1)`,
      [pDni]
    );
    testPatientId = pRes.insertId;
  }

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

let managedRoutineId = null;
let otherRoutineId = null;
let routineEx1Id = null;
let routineEx2Id = null;
let addedRoutineEx3Id = null;
let otherRoutineExId = null;

test('Routines 9. Gestión individual: crear dos rutinas con ejercicios para probar edición, alta, baja y aislamiento', async () => {
  assert.ok(testTreatmentId);
  const exercises = await query('SELECT id, name FROM exercises WHERE is_active = 1 ORDER BY id ASC LIMIT 3');
  assert.ok(exercises.length >= 2);

  // Crear Rutina A (con 2 ejercicios)
  const resA = await request(app)
    .post('/api/v1/treatments/routines')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      treatmentId: testTreatmentId,
      name: 'Rutina A - Gestión Individual',
      status: 'active',
      exercises: [
        {
          exerciseId: exercises[0].id,
          sets: 3,
          repetitions: 10,
          restSeconds: 45,
          resistanceLoad: '2kg',
          customInstructions: 'Instrucción original 1',
          executionOrder: 1
        },
        {
          exerciseId: exercises[1].id,
          sets: 4,
          repetitions: 12,
          restSeconds: 60,
          resistanceLoad: 'Banda media',
          customInstructions: 'Instrucción original 2',
          executionOrder: 2
        }
      ]
    });

  assert.strictEqual(resA.status, 201);
  managedRoutineId = resA.body.data.id;
  assert.strictEqual(resA.body.data.exercises.length, 2);
  routineEx1Id = resA.body.data.exercises[0].id;
  routineEx2Id = resA.body.data.exercises[1].id;

  // Crear Rutina B (otra rutina para verificar aislamiento y rechazo de IDs cruzados)
  const resB = await request(app)
    .post('/api/v1/treatments/routines')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      treatmentId: testTreatmentId,
      name: 'Rutina B - Independiente',
      status: 'draft',
      exercises: [
        {
          exerciseId: exercises[0].id,
          sets: 2,
          repetitions: 8,
          restSeconds: 30,
          resistanceLoad: 'Peso corporal',
          customInstructions: 'Intacto en Rutina B',
          executionOrder: 1
        }
      ]
    });

  assert.strictEqual(resB.status, 201);
  otherRoutineId = resB.body.data.id;
  otherRoutineExId = resB.body.data.exercises[0].id;
});

test('Routines 10. Editar un ejercicio individual de una rutina con varios ejercicios sin alterar los demás ni recrear la rutina', async () => {
  assert.ok(managedRoutineId && routineEx1Id && routineEx2Id);

  const res = await request(app)
    .patch(`/api/v1/treatments/routines/${managedRoutineId}/exercises/${routineEx1Id}`)
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      name: 'Puente Glúteo Modificado en Rutina A',
      sets: 5,
      repetitions: 15,
      durationSeconds: 40,
      restSeconds: 90,
      resistanceLoad: 'Mancuerna 6kg',
      customInstructions: 'Pausa isométrica de 2s arriba'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  // El ID de la rutina NO cambia (no se recrea ni elimina la rutina)
  assert.strictEqual(res.body.data.id, managedRoutineId);
  assert.strictEqual(res.body.data.exercises.length, 2);

  const editedEx = res.body.data.exercises.find((e) => e.id === routineEx1Id);
  const untouchedEx = res.body.data.exercises.find((e) => e.id === routineEx2Id);

  assert.ok(editedEx);
  assert.strictEqual(editedEx.exercise_name, 'Puente Glúteo Modificado en Rutina A');
  assert.strictEqual(editedEx.sets, 5);
  assert.strictEqual(editedEx.repetitions, 15);
  assert.strictEqual(editedEx.duration_seconds, 40);
  assert.strictEqual(editedEx.rest_seconds, 90);
  assert.strictEqual(editedEx.resistance_load, 'Mancuerna 6kg');
  assert.strictEqual(editedEx.custom_instructions, 'Pausa isométrica de 2s arriba');

  // El segundo ejercicio permanece intacto
  assert.ok(untouchedEx);
  assert.strictEqual(untouchedEx.sets, 4);
  assert.strictEqual(untouchedEx.repetitions, 12);
  assert.strictEqual(untouchedEx.resistance_load, 'Banda media');
  assert.strictEqual(untouchedEx.custom_instructions, 'Instrucción original 2');
});

test('Routines 11. Agregar un nuevo ejercicio a una rutina ya existente manteniendo los anteriores y el orden', async () => {
  assert.ok(managedRoutineId);
  const exercises = await query('SELECT id FROM exercises WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  const targetCatalogExId = exercises[0].id;

  const res = await request(app)
    .post(`/api/v1/treatments/routines/${managedRoutineId}/exercises`)
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      exerciseId: targetCatalogExId,
      name: 'Plancha Lateral Progresiva',
      sets: 3,
      repetitions: 8,
      durationSeconds: 25,
      restSeconds: 45,
      bodySide: 'Derecho',
      resistanceLoad: 'Peso corporal',
      customInstructions: 'Alinear hombro, cadera y tobillo'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.id, managedRoutineId);
  assert.strictEqual(res.body.data.exercises.length, 3);

  const thirdEx = res.body.data.exercises[2];
  addedRoutineEx3Id = thirdEx.id;
  assert.strictEqual(thirdEx.exercise_name, 'Plancha Lateral Progresiva');
  assert.strictEqual(thirdEx.execution_order, 3);
  assert.strictEqual(thirdEx.duration_seconds, 25);
  assert.strictEqual(thirdEx.body_side, 'Derecho');
});

test('Routines 12. Rechazar modificación o eliminación de un ejercicio que pertenece a otra rutina (404) o por rol sin permisos (403)', async () => {
  assert.ok(managedRoutineId && otherRoutineExId);

  // Intentar modificar en managedRoutineId un ejercicio que pertenece a otherRoutineId
  const badUpdate = await request(app)
    .patch(`/api/v1/treatments/routines/${managedRoutineId}/exercises/${otherRoutineExId}`)
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ sets: 9 });

  assert.strictEqual(badUpdate.status, 404);
  assert.strictEqual(badUpdate.body.success, false);

  // Intentar eliminar en managedRoutineId un ejercicio que pertenece a otherRoutineId
  const badDelete = await request(app)
    .delete(`/api/v1/treatments/routines/${managedRoutineId}/exercises/${otherRoutineExId}`)
    .set('Authorization', `Bearer ${kinesiologistToken}`);

  assert.strictEqual(badDelete.status, 404);
  assert.strictEqual(badDelete.body.success, false);

  // Recepcionista intentando eliminar ejercicio recibe 403
  const forbiddenRes = await request(app)
    .delete(`/api/v1/treatments/routines/${managedRoutineId}/exercises/${routineEx2Id}`)
    .set('Authorization', `Bearer ${receptionistToken}`);

  assert.strictEqual(forbiddenRes.status, 403);
});

test('Routines 13. Eliminar un único ejercicio preserva los demás, actualiza el orden y conserva registros históricos y otras rutinas', async () => {
  assert.ok(managedRoutineId && routineEx1Id && routineEx2Id && addedRoutineEx3Id);

  // Insertar un log histórico asociado a routineEx2Id para comprobar que NO se pierde al eliminar el ejercicio de la rutina
  const [exRow] = await query('SELECT exercise_id FROM routine_exercises WHERE id = ?', [routineEx2Id]);
  const logInsert = await query(
    `INSERT INTO patient_exercise_logs
      (patient_id, user_id, routine_id, routine_exercise_id, exercise_id, completed_date, sets_completed, reps_completed, perceived_pain_level, patient_notes)
     VALUES (?, 2, ?, ?, ?, CURRENT_DATE, 4, 12, 2, 'Log histórico preservado')`,
    [testPatientId, managedRoutineId, routineEx2Id, exRow.exercise_id]
  );
  const historicalLogId = logInsert.insertId;

  // Eliminar únicamente el ejercicio #2 (routineEx2Id)
  const delRes = await request(app)
    .delete(`/api/v1/treatments/routines/${managedRoutineId}/exercises/${routineEx2Id}`)
    .set('Authorization', `Bearer ${kinesiologistToken}`);

  assert.strictEqual(delRes.status, 200);
  assert.strictEqual(delRes.body.success, true);
  assert.strictEqual(delRes.body.data.id, managedRoutineId);
  assert.strictEqual(delRes.body.data.exercises.length, 2);

  // Comprobar que quedan exactamente routineEx1Id (orden 1) y addedRoutineEx3Id (renormalizado a orden 2)
  const remaining = delRes.body.data.exercises;
  assert.strictEqual(remaining[0].id, routineEx1Id);
  assert.strictEqual(remaining[0].execution_order, 1);
  assert.strictEqual(remaining[0].exercise_name, 'Puente Glúteo Modificado en Rutina A');

  assert.strictEqual(remaining[1].id, addedRoutineEx3Id);
  assert.strictEqual(remaining[1].execution_order, 2);
  assert.strictEqual(remaining[1].exercise_name, 'Plancha Lateral Progresiva');

  // Comprobar persistencia al cerrar y volver a consultar el detalle de la rutina
  const detailRes = await request(app)
    .post('/api/v1/treatments/routines/detail')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ id: managedRoutineId });

  assert.strictEqual(detailRes.status, 200);
  assert.strictEqual(detailRes.body.data.exercises.length, 2);
  assert.strictEqual(detailRes.body.data.exercises[0].sets, 5);
  assert.strictEqual(detailRes.body.data.exercises[1].execution_order, 2);

  // Verificar que el registro histórico de cumplimiento sigue existiendo
  const logRows = await query('SELECT id, routine_id, routine_exercise_id, patient_notes FROM patient_exercise_logs WHERE id = ?', [historicalLogId]);
  assert.strictEqual(logRows.length, 1);
  assert.strictEqual(logRows[0].routine_id, managedRoutineId);
  assert.strictEqual(logRows[0].routine_exercise_id, null);
  assert.strictEqual(logRows[0].patient_notes, 'Log histórico preservado');

  // Verificar que la otra rutina (otherRoutineId) sigue intacta
  const otherDetail = await request(app)
    .post('/api/v1/treatments/routines/detail')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ id: otherRoutineId });

  assert.strictEqual(otherDetail.status, 200);
  assert.strictEqual(otherDetail.body.data.exercises.length, 1);
  assert.strictEqual(otherDetail.body.data.exercises[0].id, otherRoutineExId);
  assert.strictEqual(otherDetail.body.data.exercises[0].custom_instructions, 'Intacto en Rutina B');
});

test('Routines 14. Limpieza de datos de prueba', async () => {
  if (testTreatmentId) {
    await query('DELETE FROM treatments WHERE id = ?', [testTreatmentId]);
  }
  await query("DELETE FROM patients WHERE dni LIKE 'TR-PAT-%'");
});

