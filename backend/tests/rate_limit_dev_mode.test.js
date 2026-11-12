import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app.js';
import { createRateLimiter, isRateLimitDevelopmentMode } from '../src/middlewares/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previous;
      }
    });
}

function createMiddlewareTestApp() {
  const testApp = express();
  testApp.use(express.json());

  const habitualLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    preserveInDevelopment: false,
    message: 'Límite habitual alcanzado'
  });

  const bruteForceLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    preserveInDevelopment: true,
    message: 'Límite de fuerza bruta alcanzado'
  });

  testApp.post('/habitual', habitualLimiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  testApp.post('/brute-force', bruteForceLimiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return testApp;
}

test('1. isRateLimitDevelopmentMode solo se activa con NODE_ENV=development', async () => {
  await withNodeEnv('development', () => {
    assert.equal(isRateLimitDevelopmentMode(), true);
  });

  await withNodeEnv('production', () => {
    assert.equal(isRateLimitDevelopmentMode(), false);
  });

  await withNodeEnv(undefined, () => {
    assert.equal(isRateLimitDevelopmentMode(), false);
  });

  await withNodeEnv('', () => {
    assert.equal(isRateLimitDevelopmentMode(), false);
  });
});

test('2. NODE_ENV=development desactiva límite habitual y mantiene protección contra fuerza bruta', async () => {
  await withNodeEnv('development', async () => {
    const testApp = createMiddlewareTestApp();

    // Operaciones habituales: sin bloqueo 429 ni headers de límite
    for (let i = 0; i < 6; i++) {
      const res = await request(testApp).post('/habitual').send({});
      assert.equal(res.status, 200);
      assert.equal(res.headers['ratelimit-limit'], undefined);
    }

    // Rutas críticas de fuerza bruta: siguen limitadas tras max=2
    const ok1 = await request(testApp).post('/brute-force').send({});
    const ok2 = await request(testApp).post('/brute-force').send({});
    const blocked3 = await request(testApp).post('/brute-force').send({});

    assert.equal(ok1.status, 200);
    assert.equal(ok2.status, 200);
    assert.equal(blocked3.status, 429);
    assert.equal(blocked3.body.error.code, 'TOO_MANY_REQUESTS');
  });
});

test('3. NODE_ENV=production y NODE_ENV indefinido aplican comportamiento seguro de producción', async () => {
  for (const envMode of ['production', undefined]) {
    await withNodeEnv(envMode, async () => {
      const testApp = createMiddlewareTestApp();

      const h1 = await request(testApp).post('/habitual').send({});
      const h2 = await request(testApp).post('/habitual').send({});
      const h3 = await request(testApp).post('/habitual').send({});

      assert.equal(h1.status, 200);
      assert.equal(h2.status, 200);
      assert.equal(h3.status, 429);
      assert.equal(h3.body.error.code, 'TOO_MANY_REQUESTS');

      const b1 = await request(testApp).post('/brute-force').send({});
      const b2 = await request(testApp).post('/brute-force').send({});
      const b3 = await request(testApp).post('/brute-force').send({});

      assert.equal(b1.status, 200);
      assert.equal(b2.status, 200);
      assert.equal(b3.status, 429);
    });
  }
});

test('4. App real: endpoints habituales omiten rate limit en development y lo aplican en production/undefined', async () => {
  // En desarrollo: /services/search y /auth/register no reciben RateLimit global ni de registro
  await withNodeEnv('development', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/services/search').send({});
      assert.equal(res.status, 401); // Autenticación intacta, sin 429 ni RateLimit headers
      assert.equal(res.headers['ratelimit-limit'], undefined);
    }

    const regRes = await request(app).post('/api/v1/auth/register').send({});
    assert.equal(regRes.status, 422);
    assert.equal(regRes.headers['ratelimit-limit'], undefined);

    // Login y recuperación mantienen RateLimit activo incluso en development
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'devcheck@test.com' });
    assert.equal(loginRes.status, 422);
    assert.ok(loginRes.headers['ratelimit-limit']);

    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'invalid-email' });
    assert.equal(forgotRes.status, 422);
    assert.ok(forgotRes.headers['ratelimit-limit']);
  });

  // En producción y cuando NODE_ENV no está definido: limitador global activo (5000)
  for (const envMode of ['production', undefined]) {
    await withNodeEnv(envMode, async () => {
      const res = await request(app).post('/api/v1/services/search').send({});
      assert.equal(res.status, 401);
      assert.equal(res.headers['ratelimit-limit'], '5000');
    });
  }
});

test('5. E2E sin NODE_TEST_CONTEXT: límites reales de login/recuperación activos en development y globales activos en production', () => {
  const script = `
    import assert from 'node:assert/strict';
    import request from 'supertest';
    import { app } from './src/app.js';

    const mode = process.env.TEST_MODE;

    // Endpoints de negocio habituales no deben devolver 429 en desarrollo (ni en prod bajo 5000)
    for (let i = 0; i < 25; i++) {
      const srv = await request(app).post('/api/v1/services/search').send({});
      assert.equal(srv.status, 401);
      if (mode === 'development') {
        assert.equal(srv.headers['ratelimit-limit'], undefined);
      } else {
        assert.equal(srv.headers['ratelimit-limit'], '5000');
      }
    }

    // /register: sin 429 en development tras >20 intentos; bloqueado en 429 al intento 21 en production
    let regStatuses = [];
    for (let i = 0; i < 21; i++) {
      const r = await request(app).post('/api/v1/auth/register').send({});
      regStatuses.push(r.status);
    }
    if (mode === 'development') {
      assert.ok(regStatuses.every((s) => s === 422), 'En desarrollo /register no debe bloquearse con 429');
    } else {
      assert.equal(regStatuses[19], 422);
      assert.equal(regStatuses[20], 429);
    }

    // /login: mantiene bloqueo de fuerza bruta (429 al intento 11) tanto en development como en production
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/api/v1/auth/login').send({ email: 'brute@example.com' });
      assert.equal(r.status, 422);
    }
    const blockedLogin = await request(app).post('/api/v1/auth/login').send({ email: 'brute@example.com' });
    assert.equal(blockedLogin.status, 429);

    // /forgot-password: mantiene bloqueo (429 al intento 21) tanto en development como en production
    for (let i = 0; i < 20; i++) {
      const r = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'not-an-email' });
      assert.equal(r.status, 422);
    }
    const blockedForgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'not-an-email' });
    assert.equal(blockedForgot.status, 429);

    // /reset-password: mantiene bloqueo (429 al intento 16) tanto en development como en production
    for (let i = 0; i < 15; i++) {
      const r = await request(app).post('/api/v1/auth/reset-password').send({ email: 'reset@example.com' });
      assert.equal(r.status, 422);
    }
    const blockedReset = await request(app).post('/api/v1/auth/reset-password').send({ email: 'reset@example.com' });
    assert.equal(blockedReset.status, 429);

    process.exit(0);
  `;

  for (const mode of ['development', 'production']) {
    const childEnv = {
      ...process.env,
      NODE_ENV: mode,
      TEST_MODE: mode,
      CORS_ORIGIN: 'http://localhost:8081'
    };
    delete childEnv.NODE_TEST_CONTEXT;

    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: backendDir,
      env: childEnv,
      stdio: 'pipe'
    });
  }
});
