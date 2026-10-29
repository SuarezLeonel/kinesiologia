import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool, query } from '../src/config/database.js';

import { clinicalExercisesCatalog } from '../scripts/seed-exercises.js';

const kineToken = jwt.sign(
  { type: 'access', userId: 2, role: 'kinesiologist', email: 'carlos.kine@kinesiologia.com' },
  config.jwt.accessSecret,
  { expiresIn: '15m' }
);

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

test('Catálogo 90: El catálogo contiene al menos 90 ejercicios activos y completos', async () => {
  const [countRow] = await query('SELECT COUNT(*) as count FROM exercises WHERE is_active = 1');
  const count = Number(countRow.count);
  assert.ok(count >= 90, `Se esperaban al menos 90 ejercicios activos, se encontraron ${count}`);

  // Verificar que cada uno de los 90 ejercicios del catálogo clínico tenga instrucciones completas, precauciones y media_url nula
  for (const item of clinicalExercisesCatalog) {
    const rows = await query('SELECT media_url, instructions, contraindications FROM exercises WHERE name = ?', [item.name]);
    assert.ok(rows.length > 0, `El ejercicio "${item.name}" debe existir en la base de datos`);
    const ex = rows[0];
    assert.equal(ex.media_url, null, `El ejercicio "${item.name}" no debe tener URLs inventadas`);
    assert.ok(ex.instructions && ex.instructions.length > 20, `Instrucciones incompletas para "${item.name}"`);
    assert.ok(
      ex.contraindications && (ex.contraindications.toLowerCase().includes('demostra') || ex.contraindications.toLowerCase().includes('clínic')),
      `Falta advertencia clínica demostrativa en "${item.name}"`
    );
  }

});


test('Catálogo 90: POST /exercises/filter-options devuelve listas enriquecidas de filtros', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/filter-options')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({});

  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.ok(Array.isArray(data.bodyZones) && data.bodyZones.length >= 6);
  assert.ok(Array.isArray(data.categories) && data.categories.length >= 6);
  assert.ok(Array.isArray(data.therapeuticObjectives) && data.therapeuticObjectives.length >= 5);
  assert.ok(Array.isArray(data.equipmentOptions) && data.equipmentOptions.length >= 5);
  assert.deepEqual(data.difficultyLevels, ['Bajo', 'Medio', 'Alto']);
});

test('Catálogo 90: Búsqueda por texto libre mediante POST /exercises/search', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({ search: 'Chin-Tuck', limit: 10 });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.items.length >= 1);
  assert.ok(res.body.data.items.some(e => e.name.includes('Chin-Tuck')));
});

test('Catálogo 90: Filtrado por zona corporal (Columna Cervical)', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({ bodyZone: 'Columna Cervical', limit: 50 });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.items.length >= 8);
  for (const item of res.body.data.items) {
    assert.equal(item.bodyZone, 'Columna Cervical');
  }
});

test('Catálogo 90: Filtrado por nivel de dificultad (Alto)', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({ difficultyLevel: 'Alto', limit: 50 });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.items.length >= 5);
  for (const item of res.body.data.items) {
    assert.equal(item.difficultyLevel, 'Alto');
  }
});

test('Catálogo 90: Filtrado combinado (Hombro + Fortalecimiento + Medio)', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({ bodyZone: 'Hombro', category: 'Fortalecimiento', difficultyLevel: 'Medio', limit: 50 });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.items.length >= 2);
  for (const item of res.body.data.items) {
    assert.equal(item.bodyZone, 'Hombro');
    assert.equal(item.category, 'Fortalecimiento');
    assert.equal(item.difficultyLevel, 'Medio');
  }
});

test('Catálogo 90: Selección de ejercicios del catálogo para prescribir una rutina terapéutica', async () => {
  // Buscar 2 ejercicios del catálogo nuevo
  const searchRes = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({ search: 'Dead-Bug', limit: 1 });

  assert.equal(searchRes.status, 200);
  const deadBug = searchRes.body.data.items[0];
  assert.ok(deadBug, 'Debe encontrar el ejercicio Dead-Bug');

  // Obtener un paciente activo existente
  const patients = await query('SELECT id FROM patients WHERE is_active = 1 LIMIT 1');
  const patientId = patients[0] ? patients[0].id : 1;

  // Crear plan de tratamiento para asociar la rutina
  const treatResult = await query(
    `INSERT INTO treatments (patient_id, kinesiologist_id, title, diagnosis_summary, objectives, start_date, total_planned_sessions, status)
     VALUES (?, 2, 'Tratamiento Prueba Catálogo', 'Evaluación para prueba de prescripción clínica', 'Fortalecimiento de core y lumbo-pélvico', '2026-10-29', 8, 'active')`,
    [patientId]
  );
  const treatmentId = treatResult.insertId;

  // Prescribir rutina con el ejercicio seleccionado del catálogo
  const routineRes = await request(app)
    .post('/api/v1/treatments/routines')
    .set('Authorization', `Bearer ${kineToken}`)
    .send({
      treatmentId,
      name: 'Rutina de Core y Estabilización con Catálogo Clínico',
      description: 'Prescripción de prueba usando nuevo catálogo de ejercicios',
      status: 'active',
      validFrom: new Date().toISOString().slice(0, 10),
      notes: 'Monitorear control lumbopélvico',
      exercises: [
        {
          exerciseId: deadBug.id,
          sets: 3,
          repetitions: 10,
          durationSeconds: null,
          restSeconds: 45,
          weeklyFrequency: '3 veces por semana',
          bodySide: 'Bilateral',
          resistanceLoad: 'Peso corporal',
          customInstructions: 'Mantener contacto lumbar continuo con la colchoneta',
          executionOrder: 1
        }
      ]
    });

  assert.equal(routineRes.status, 201);
  assert.equal(routineRes.body.data.name, 'Rutina de Core y Estabilización con Catálogo Clínico');
  assert.equal(routineRes.body.data.exercises[0].exercise_id, deadBug.id);
  assert.equal(routineRes.body.data.exercises[0].exercise_name, deadBug.name);

  // Limpieza de datos de prueba
  await query('DELETE FROM routine_exercises WHERE routine_id = ?', [routineRes.body.data.id]);
  await query('DELETE FROM treatment_routines WHERE id = ?', [routineRes.body.data.id]);
  await query('DELETE FROM treatments WHERE id = ?', [treatmentId]);
});
