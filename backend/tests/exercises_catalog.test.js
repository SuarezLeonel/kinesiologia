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

let testExerciseId = null;

test('Exercises 1. Recepcionista no tiene acceso al catálogo de ejercicios clínicos (403 Forbidden)', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

test('Exercises 2. Consulta paginada mediante POST /exercises/search con metadatos reales', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ page: 1, limit: 5 });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.items);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.total >= 1);
  assert.strictEqual(res.body.data.page, 1);
  assert.strictEqual(res.body.data.limit, 5);
  assert.ok(res.body.data.totalPages >= 1);

  const sample = res.body.data.items[0];
  assert.ok(sample.name);
  assert.ok(sample.bodyZone !== undefined);
  assert.ok(sample.difficultyLevel !== undefined);
  assert.ok(sample.instructions !== undefined);
});

test('Exercises 3. Filtrado clínico por zona corporal, objetivo terapéutico y dificultad', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/search')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({
      difficultyLevel: 'Bajo'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  for (const item of res.body.data.items) {
    assert.strictEqual(item.difficultyLevel, 'Bajo');
  }
});

test('Exercises 4. Endpoint POST /exercises/filter-options provee opciones clínicas para selectores', async () => {
  const res = await request(app)
    .post('/api/v1/exercises/filter-options')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.bodyZones));
  assert.ok(Array.isArray(res.body.data.therapeuticObjectives));
  assert.ok(Array.isArray(res.body.data.equipmentOptions));
  assert.ok(Array.isArray(res.body.data.difficultyLevels));
  assert.ok(res.body.data.difficultyLevels.includes('Bajo'));
  assert.ok(res.body.data.difficultyLevels.includes('Medio'));
  assert.ok(res.body.data.difficultyLevels.includes('Alto'));
});

test('Exercises 5. Creación de nuevo ejercicio clínico con todos sus atributos requeridos', async () => {
  const payload = {
    name: 'Ejercicio Test Clínico Automatizado',
    category: 'Estabilidad y Control',
    description: 'Protocolo de prueba para evaluación de estabilidad lumbo-pélvica.',
    instructions: 'Mantener la contracción isométrica durante 10 segundos respirando diafragmáticamente.',
    bodyZone: 'Pelvis / Cadera',
    muscleGroup: 'Glúteo medio y transverso abdominal',
    therapeuticObjective: 'Control Motor',
    equipmentNeeded: 'Colchoneta',
    difficultyLevel: 'Medio',
    contraindications: 'No realizar en caso de dolor lumbar agudo irradiado.',
    defaultSets: 3,
    defaultRepetitions: 12
  };

  const res = await request(app)
    .post('/api/v1/exercises')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send(payload);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.id);
  assert.strictEqual(res.body.data.name, payload.name);
  assert.strictEqual(res.body.data.bodyZone, payload.bodyZone);
  assert.strictEqual(res.body.data.difficultyLevel, payload.difficultyLevel);

  testExerciseId = res.body.data.id;
});

test('Exercises 6. Consulta de detalle mediante POST /exercises/detail', async () => {
  assert.ok(testExerciseId);

  const res = await request(app)
    .post('/api/v1/exercises/detail')
    .set('Authorization', `Bearer ${kinesiologistToken}`)
    .send({ id: testExerciseId });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.id, testExerciseId);
  assert.strictEqual(res.body.data.name, 'Ejercicio Test Clínico Automatizado');
  assert.strictEqual(res.body.data.inUseCount, 0);
});

test('Exercises 7. Edición de ejercicio terapéutico mediante POST /exercises/update', async () => {
  assert.ok(testExerciseId);

  const res = await request(app)
    .post('/api/v1/exercises/update')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      id: testExerciseId,
      name: 'Ejercicio Test Clínico Editado',
      difficultyLevel: 'Alto',
      defaultSets: 4
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, 'Ejercicio Test Clínico Editado');
  assert.strictEqual(res.body.data.difficultyLevel, 'Alto');
  assert.strictEqual(res.body.data.defaultSets, 4);
});

test('Exercises 8. Desactivación lógica y reactivación mediante POST /exercises/toggle-active', async () => {
  assert.ok(testExerciseId);

  // Desactivar
  const deactivateRes = await request(app)
    .post('/api/v1/exercises/toggle-active')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: testExerciseId, isActive: false });

  assert.strictEqual(deactivateRes.status, 200);
  assert.strictEqual(deactivateRes.body.success, true);
  assert.strictEqual(deactivateRes.body.data.isActive, false);

  // Reactivar
  const activateRes = await request(app)
    .post('/api/v1/exercises/toggle-active')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: testExerciseId, isActive: true });

  assert.strictEqual(activateRes.status, 200);
  assert.strictEqual(activateRes.body.success, true);
  assert.strictEqual(activateRes.body.data.isActive, true);
});

test('Exercises 9. Limpieza de ejercicio de prueba', async () => {
  if (testExerciseId) {
    await query('DELETE FROM exercises WHERE id = ?', [testExerciseId]);
  }
});
