import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPool } from '../src/config/database.js';

test.after(async () => {
  const pool = getPool();
  try {
    const [testUsers] = await pool.query(
      "SELECT id FROM users WHERE email LIKE 'test.oauth.%' OR email LIKE 'takeover.check.%' OR email LIKE 'test.google.%'"
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
  assert.ok(step1.body.data.registrationToken, 'Debe devolver un registrationToken firmado');

  // Paso 2: Con registrationToken y datos de perfil (nombre, apellido, DNI, teléfono, obra social), finaliza el registro sin requerir tokens externos de un solo uso
  const step2 = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      registrationToken: step1.body.data.registrationToken,
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

  // Activar y marcar correo como verificado para simular cuenta confirmada existente
  const pool = getPool();
  await pool.query('UPDATE users SET is_active = 1, email_verified_at = CURRENT_TIMESTAMP WHERE email = ?', [uniqueEmail]);

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

test('OAuth 5. Bridge Callback /auth/oauth/callback redirige adecuadamente a Expo Go y APK nativo', async () => {
  // Caso A: Expo Go (exp://)
  const expoState = Buffer.from(JSON.stringify({
    returnUrl: 'exp://192.168.0.145:8081',
    appState: 'client_csrf_123',
    provider: 'google'
  })).toString('base64url');

  const resExpo = await request(app)
    .get('/api/v1/auth/oauth/callback')
    .query({ code: 'mock_code_abc', state: expoState });

  assert.strictEqual(resExpo.status, 200);
  assert.match(resExpo.text, new RegExp(`exp:\\/\\/192\\.168\\.0\\.145:8081\\?code=mock_code_abc&amp;state=${expoState}`));

  // Caso B: Standalone APK (kinesiologia://)
  const apkState = Buffer.from(JSON.stringify({
    returnUrl: 'kinesiologia://oauth-callback',
    appState: 'client_csrf_456',
    provider: 'github'
  })).toString('base64url');

  const resApk = await request(app)
    .get('/api/v1/auth/oauth/callback')
    .query({ code: 'mock_code_xyz', state: apkState });

  assert.strictEqual(resApk.status, 200);
  assert.match(resApk.text, new RegExp(`kinesiologia:\\/\\/oauth-callback\\?code=mock_code_xyz&amp;state=${apkState}`));

  // Caso C: Protección contra Open Redirect (dominios externos sospechosos)
  const badState = Buffer.from(JSON.stringify({
    returnUrl: 'https://evil-phishing-site.com',
    appState: 'bad_state'
  })).toString('base64url');

  const resBad = await request(app)
    .get('/api/v1/auth/oauth/callback')
    .query({ code: 'mock_code_bad', state: badState });

  assert.strictEqual(resBad.status, 200);
  // Debe degradar a localhost seguro
  assert.match(resBad.text, /http:\/\/localhost:8081/);
});

test('OAuth 6. Usuario con cuenta vinculada con Google inicia sesión directamente sin solicitar contraseña', async () => {
  const pool = getPool();
  const googleEmail = `test.google.linked.${Date.now()}@kinesiologia.com`;
  const deterministicSub = `google_${crypto.createHash('sha256').update(googleEmail).digest('hex').slice(0, 24)}`;

  // Crear usuario paciente
  const [userRes] = await pool.query(
    `INSERT INTO users (role_id, name, last_name, dni, email, password_hash, is_active, email_verified_at)
     VALUES (4, 'Lucía', 'GoogleLinked', ?, ?, 'dummy_hash_random_google', 1, CURRENT_TIMESTAMP)`,
    [`DNI-G-${Date.now().toString().slice(-6)}`, googleEmail]
  );
  const userId = userRes.insertId;

  // Vincular cuenta en social_accounts con su sub inmutable
  await pool.query(
    'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
    [userId, 'google', deterministicSub]
  );

  // Iniciar sesión con Google
  const res = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: googleEmail
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  // Verificar que NO solicita confirmación con contraseña ni completar perfil
  assert.strictEqual(res.body.data.requiresLinkingConfirmation, undefined);
  assert.strictEqual(res.body.data.requiresProfileCompletion, undefined);
  // Verificar que emite tokens directamente
  assert.ok(res.body.data.tokens.accessToken, 'Debe emitir accessToken');
  assert.ok(res.body.data.tokens.refreshToken, 'Debe emitir refreshToken');
  assert.strictEqual(res.body.data.user.email, googleEmail);
  assert.strictEqual(res.body.data.user.role, 'patient');
});

test('OAuth 7. Usuario de Google vinculado no puede autenticarse si la cuenta está inactiva / suspendida (401)', async () => {
  const pool = getPool();
  const inactiveEmail = `test.google.inactive.${Date.now()}@kinesiologia.com`;
  const deterministicSub = `google_${crypto.createHash('sha256').update(inactiveEmail).digest('hex').slice(0, 24)}`;

  const [userRes] = await pool.query(
    `INSERT INTO users (role_id, name, last_name, dni, email, password_hash, is_active, email_verified_at)
     VALUES (4, 'Inactivo', 'GoogleUser', ?, ?, 'dummy_hash', 0, CURRENT_TIMESTAMP)`,
    [`DNI-GI-${Date.now().toString().slice(-6)}`, inactiveEmail]
  );
  const userId = userRes.insertId;

  await pool.query(
    'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
    [userId, 'google', deterministicSub]
  );

  const res = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: inactiveEmail
    });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error.message, /inactiva o suspendida/i);
});

test('OAuth 8. Administrador con cuenta vinculada con Google inicia sesión sin generar fichas de pacientes ficticias', async () => {
  const pool = getPool();
  const adminEmail = `test.oauth.admin.${Date.now()}@kinesiologia.com`;
  const deterministicSub = `google_${crypto.createHash('sha256').update(adminEmail).digest('hex').slice(0, 24)}`;

  const [adminUser] = await pool.query(
    `INSERT INTO users (role_id, name, last_name, dni, email, password_hash, is_active, email_verified_at)
     VALUES (1, 'Admin', 'Kinesio', ?, ?, 'dummy_hash', 1, CURRENT_TIMESTAMP)`,
    [`DNI-ADM-${Date.now().toString().slice(-6)}`, adminEmail]
  );
  const adminId = adminUser.insertId;

  await pool.query(
    'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
    [adminId, 'google', deterministicSub]
  );

  const res = await request(app)
    .post('/api/v1/auth/social')
    .send({
      provider: 'google',
      idToken: `oauth_sim_google_${Date.now()}`,
      confirmedEmail: adminEmail
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.user.role, 'admin');
  assert.strictEqual(res.body.data.patientId, null, 'El administrador no debe tener patientId asignado');

  // Verificar que NO se haya insertado un paciente ficticio en patients
  const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [adminId]);
  assert.strictEqual(patients.length, 0, 'No debe existir registro en patients para el rol admin');
});
