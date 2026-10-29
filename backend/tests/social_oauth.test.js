import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPool } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  try {
    const [testUsers] = await pool.query(
      "SELECT id FROM users WHERE email LIKE 'test.oauth.patient.%' OR email LIKE 'takeover.check.%'"
    );
    if (testUsers.length > 0) {
      const ids = testUsers.map(u => u.id);
      await pool.query("DELETE FROM social_accounts WHERE user_id IN (?)", [ids]);
      await pool.query("DELETE FROM auth_refresh_tokens WHERE user_id IN (?)", [ids]);
      await pool.query("DELETE FROM audit_logs WHERE user_id IN (?)", [ids]);
      await pool.query("DELETE FROM patients WHERE user_id IN (?)", [ids]);
      await pool.query("DELETE FROM users WHERE id IN (?)", [ids]);
    }
  } catch (e) {
    console.error('Cleanup error in social_oauth.test.js:', e);
  }
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
  assert.ok(data.github, 'Debe incluir configuración de GitHub');
  assert.ok(data.facebook, 'Debe incluir configuración de Facebook');

  // Verificar que NO se expongan variables secretas
  assert.strictEqual(data.google.clientSecret, undefined, 'No debe exponer clientSecret de Google');
  assert.strictEqual(data.github.clientSecret, undefined, 'No debe exponer clientSecret de GitHub');
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

test('OAuth 3. Registro social nuevo solicita datos de perfil y crea exclusivamente rol de paciente', async () => {
  const testEmail = `test.oauth.patient.${Date.now()}@kinesiologia.com`;
  
  // Paso 1: Sin datos de perfil, solicita completar nombre y apellido
  const step1 = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: testEmail
    });

  assert.strictEqual(step1.status, 200);
  assert.strictEqual(step1.body.success, true);
  assert.strictEqual(step1.body.data.requiresProfileCompletion, true);

  // Paso 2: Con datos de perfil (nombre, apellido, DNI, teléfono, obra social), finaliza el registro
  const step2 = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: testEmail,
      firstName: 'Lucía',
      lastName: 'Gómez',
      dni: `DNI-${Date.now().toString().slice(-6)}`,
      phone: '1122334455',
      birthDate: '1995-04-10',
      insuranceProvider: 'OSDE',
      insuranceNumber: '1234567801'
    });

  assert.strictEqual(step2.status, 200);
  assert.strictEqual(step2.body.success, true);
  assert.ok(step2.body.data.tokens.accessToken, 'Debe emitir accessToken');
  assert.strictEqual(step2.body.data.user.role, 'patient', 'Debe asignar exclusivamente rol patient');
  assert.notStrictEqual(step2.body.data.user.role, 'admin', 'Nunca debe otorgar rol admin');

  // Verificar que la ficha clínica contenga la obra social y el número de afiliado
  const pool = getPool();
  const [patientRows] = await pool.query('SELECT address FROM patients WHERE id = ?', [step2.body.data.patientId]);
  assert.strictEqual(patientRows[0].address, 'OSDE - 1234567801', 'Debe guardar obra social y número de credencial');
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
      provider: 'github',
      code: `oauth_sim_github_${Date.now()}`,
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
      provider: 'github',
      code: `oauth_sim_github_${Date.now()}`,
      confirmedEmail: uniqueEmail,
      existingPassword: 'WrongPassword999!'
    });
  assert.strictEqual(badPassRes.status, 401);

  // 4. Probar vinculación con contraseña correcta (éxito y vinculación en social_accounts)
  const goodPassRes = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'github',
      code: `oauth_sim_github_${Date.now()}`,
      confirmedEmail: uniqueEmail,
      existingPassword: 'StrongPassword123!'
    });
  assert.strictEqual(goodPassRes.status, 200);
  assert.ok(goodPassRes.body.data.tokens.accessToken, 'Debe emitir accessToken tras vinculación');
});
