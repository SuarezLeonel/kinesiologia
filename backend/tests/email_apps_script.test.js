import test from 'node:test';
import assert from 'node:assert/strict';
import { isAppsScriptConfigured, sendWithAppsScript } from '../src/services/appsScriptSender.js';
import { emailService } from '../src/services/emailService.js';
import { config } from '../src/config/env.js';

test('AppsScript 1. Validación de entradas rechaza destinatarios o asuntos inválidos', async () => {
  // Destinatario no válido
  await assert.rejects(
    async () => {
      await sendWithAppsScript({
        to: 'no-es-un-email',
        subject: 'Asunto prueba',
        text: 'Cuerpo de prueba'
      });
    },
    /Dirección de correo destinatario inválida/
  );

  // Asunto vacío
  await assert.rejects(
    async () => {
      await sendWithAppsScript({
        to: 'paciente@test.com',
        subject: '',
        text: 'Cuerpo de prueba'
      });
    },
    /El asunto del correo es obligatorio/
  );

  // Cuerpo vacío
  await assert.rejects(
    async () => {
      await sendWithAppsScript({
        to: 'paciente@test.com',
        subject: 'Asunto de prueba',
        text: '',
        html: ''
      });
    },
    /El mensaje debe contener texto plano o contenido HTML/
  );
});

test('AppsScript 1b. Rechazo inmediato si falta la configuración de Apps Script en variables de entorno', async () => {
  const originalUrl = config.email.appsScript.url;
  const originalSecret = config.email.appsScript.secret;

  config.email.appsScript.url = null;
  config.email.appsScript.secret = null;

  try {
    assert.strictEqual(isAppsScriptConfigured(), false);
    await assert.rejects(
      async () => {
        await sendWithAppsScript({
          to: 'usuario@example.com',
          subject: 'Asunto válido',
          text: 'Texto válido'
        });
      },
      /Google Apps Script no está configurado/
    );
  } finally {
    config.email.appsScript.url = originalUrl;
    config.email.appsScript.secret = originalSecret;
  }
});

test('AppsScript 2. Despacho exitoso procesa respuesta confirmada de la Web App', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = config.email.appsScript.url;
  const originalSecret = config.email.appsScript.secret;

  // Configurar credenciales simuladas
  config.email.appsScript.url = 'https://script.google.com/macros/s/AKfycb_test/exec';
  config.email.appsScript.secret = 'secreto_seguro_para_pruebas_unitarias_32caracteres';

  try {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: true,
          messageId: 'gas-mock-12345',
          remainingQuota: 95
        })
      };
    };

    const result = await sendWithAppsScript({
      to: 'paciente.kine@example.com',
      subject: 'Turno confirmado',
      text: 'Tu turno ha sido agendado.',
      fromName: 'KinesioGestión'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'gas-mock-12345');
    assert.strictEqual(result.remainingQuota, 95);
    assert.strictEqual(result.provider, 'apps-script');

    // Comprobar que el secreto y datos se transmitieron correctamente
    assert.strictEqual(capturedBody.secret, 'secreto_seguro_para_pruebas_unitarias_32caracteres');
    assert.strictEqual(capturedBody.to, 'paciente.kine@example.com');
    assert.strictEqual(capturedBody.subject, 'Turno confirmado');
    assert.strictEqual(capturedBody.fromName, 'KinesioGestión');
  } finally {
    globalThis.fetch = originalFetch;
    config.email.appsScript.url = originalUrl;
    config.email.appsScript.secret = originalSecret;
  }
});

test('AppsScript 3. Rechazo estricto si la Web App no confirma el envío (success: false)', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = config.email.appsScript.url;
  const originalSecret = config.email.appsScript.secret;

  config.email.appsScript.url = 'https://script.google.com/macros/s/AKfycb_test/exec';
  config.email.appsScript.secret = 'secreto_seguro_para_pruebas_unitarias_32caracteres';

  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: false,
        error: 'No autorizado: secreto compartido inválido',
        code: 'UNAUTHORIZED'
      })
    });

    await assert.rejects(
      async () => {
        await sendWithAppsScript({
          to: 'usuario@example.com',
          subject: 'Asunto',
          text: 'Texto'
        });
      },
      (err) => {
        assert.match(err.message, /secreto compartido inválido/);
        assert.strictEqual(err.isNonRetryable, true);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    config.email.appsScript.url = originalUrl;
    config.email.appsScript.secret = originalSecret;
  }
});

test('AppsScript 4. Manejo y detención inmediata ante cuota diaria agotada (QUOTA_EXCEEDED)', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = config.email.appsScript.url;
  const originalSecret = config.email.appsScript.secret;

  config.email.appsScript.url = 'https://script.google.com/macros/s/AKfycb_test/exec';
  config.email.appsScript.secret = 'secreto_seguro_para_pruebas_unitarias_32caracteres';

  try {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: false,
          error: 'Cuota diaria de envío de Gmail agotada',
          code: 'QUOTA_EXCEEDED',
          remainingQuota: 0
        })
      };
    };

    await assert.rejects(
      async () => {
        await sendWithAppsScript({
          to: 'usuario@example.com',
          subject: 'Asunto',
          text: 'Texto'
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'QUOTA_EXCEEDED');
        assert.strictEqual(err.isNonRetryable, true);
        return true;
      }
    );

    // Cuota agotada NO debe reintentar: exactamente 1 llamada
    assert.strictEqual(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    config.email.appsScript.url = originalUrl;
    config.email.appsScript.secret = originalSecret;
  }
});

test('AppsScript 5. Reintentos acotados ante fallo de red: máximo 2 intentos', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = config.email.appsScript.url;
  const originalSecret = config.email.appsScript.secret;

  config.email.appsScript.url = 'https://script.google.com/macros/s/AKfycb_test/exec';
  config.email.appsScript.secret = 'secreto_seguro_para_pruebas_unitarias_32caracteres';

  try {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      throw new Error('Network timeout simulado en socket');
    };

    await assert.rejects(
      async () => {
        await sendWithAppsScript({
          to: 'usuario@example.com',
          subject: 'Asunto',
          text: 'Texto'
        });
      },
      /Network timeout simulado en socket/
    );

    // Debe haber intentado exactamente 2 veces (1 inicial + 1 reintento) y detenerse
    assert.strictEqual(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    config.email.appsScript.url = originalUrl;
    config.email.appsScript.secret = originalSecret;
  }
});

test('EmailService 6. Mock seguro en entorno de testing automatizado', async () => {
  const result = await emailService.sendPasswordResetEmail({
    to: 'destinatario.test@kinesiologia.com',
    name: 'Paciente Test',
    resetCode: '123456'
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.provider, 'test-mock');
  assert.match(result.messageId, /^test-mock-/);
});
