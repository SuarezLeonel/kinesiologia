import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPool } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  await pool.end();
});

test('OAuth 1. Endpoint /auth/oauth-config devuelve configuración pública y nunca expone secretos', async () => {
  const res = await request(app)
    .post('/api/v1/auth/oauth-config')
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  const data = res.body.data;

  assert.ok(data.google, 'Debe incluir configuración de Google');
  assert.ok(data.microsoft, 'Debe incluir configuración de Microsoft');
  assert.ok(data.facebook, 'Debe incluir configuración de Facebook');

  // Verificar que NO se expongan variables secretas
  assert.strictEqual(data.google.clientSecret, undefined, 'No debe exponer clientSecret de Google');
  assert.strictEqual(data.microsoft.clientSecret, undefined, 'No debe exponer clientSecret de Microsoft');
  assert.strictEqual(data.facebook.appSecret, undefined, 'No debe exponer appSecret de Facebook');
});

test('OAuth 2. Validación de entradas en /auth/social rechaza cuerpo vacío sin tokens (422)', async () => {
  const res = await request(app)
    .post('/api/v1/auth/social')
    .send({ provider: 'google' });

  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
});

test('OAuth 3. Registro social crea exclusivamente rol de paciente', async () => {
  const testEmail = `test.oauth.patient.${Date.now()}@kinesiologia.com`;
  const res = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: testEmail
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.tokens.accessToken, 'Debe emitir accessToken');
  assert.strictEqual(res.body.data.user.role, 'patient', 'Debe asignar exclusivamente rol patient');
  assert.notStrictEqual(res.body.data.user.role, 'admin', 'Nunca debe otorgar rol admin');
});

test('OAuth 4. Protección contra Account Takeover: no auto-vincula usuarios existentes con contraseña', async () => {
  // 1. Crear usuario con correo y contraseña vía registro de paciente
  const uniqueEmail = `takeover.check.${Date.now()}@kinesiologia.com`;
  const regRes = await request(app)
    .post('/api/v1/auth/register-patient')
    .send({
      email: uniqueEmail,
      password: 'StrongPassword123!',
      firstName: 'Marcos',
      lastName: 'Prueba',
      dni: `99${Date.now().toString().slice(-6)}`
    });
  assert.strictEqual(regRes.status, 201);

  // 2. Intentar autenticar con cuenta social sin contraseña
  const socialRes = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'microsoft',
      idToken: `oauth_sim_ms_${Date.now()}`,
      confirmedEmail: uniqueEmail
    });

  // Debe exigir confirmación explícita con contraseña
  assert.strictEqual(socialRes.status, 200);
  assert.strictEqual(socialRes.body.data.requiresLinkingConfirmation, true);
  assert.strictEqual(socialRes.body.data.email, uniqueEmail);

  // 3. Probar vinculación con contraseña incorrecta (rechaza 401)
  const badPassRes = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'microsoft',
      idToken: `oauth_sim_ms_${Date.now()}`,
      confirmedEmail: uniqueEmail,
      existingPassword: 'WrongPassword999!'
    });
  assert.strictEqual(badPassRes.status, 401);

  // 4. Probar vinculación con contraseña correcta (éxito y vinculación en social_accounts)
  const goodPassRes = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'microsoft',
      idToken: `oauth_sim_ms_${Date.now()}`,
      confirmedEmail: uniqueEmail,
      existingPassword: 'StrongPassword123!'
    });
  assert.strictEqual(goodPassRes.status, 200);
  assert.ok(goodPassRes.body.data.tokens.accessToken, 'Debe emitir accessToken tras vinculación');
});
