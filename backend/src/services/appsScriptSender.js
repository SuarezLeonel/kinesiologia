/**
 * @file appsScriptSender.js
 * @description Módulo de despacho de correos electrónicos mediante Google Apps Script Web App.
 * Permite enviar correos utilizando la cuota gratuita de una cuenta personal de Gmail
 * a través de MailApp.sendEmail(), comunicándose mediante HTTPS (puerto 443) sin requerir SMTP
 * ni Nodemailer, eludiendo los bloqueos de puertos salientes de plataformas cloud como Render.
 *
 * Características:
 * - Autenticación entre backend y Web App mediante secreto compartido (APPS_SCRIPT_SECRET).
 * - Validación estricta de solicitud y respuesta (no asume éxito sin confirmación explícita).
 * - Manejo de control de cuotas diarias de Gmail (MailApp.getRemainingDailyQuota()).
 * - Reintentos acotados (máximo 1 reintento ante fallos transitorios de red, sin bucles infinitos).
 * - Trazabilidad segura: no expone secretos, tokens ni códigos de verificación en logs.
 */

import { config } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 2; // 1 intento inicial + máximo 1 reintento ante error transitorio de red
const RETRY_DELAY_MS = 1000;

/**
 * Sanitiza una dirección de correo para incluirla de forma segura en logs de auditoría sin exponer datos personales.
 * Ejemplo: carlos.kine@kinesiologia.com -> ca***@kinesiologia.com
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'desconocido';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

/**
 * Espera una cantidad determinada de milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Comprueba si el proveedor Google Apps Script cuenta con sus variables de entorno configuradas.
 * @returns {boolean}
 */
export function isAppsScriptConfigured() {
  const url = config.email.appsScript?.url;
  const secret = config.email.appsScript?.secret;
  return Boolean(url && typeof url === 'string' && secret && typeof secret === 'string');
}

/**
 * Valida los parámetros del mensaje antes del envío.
 * @param {Object} message
 * @param {string} message.to
 * @param {string} message.subject
 * @param {string} [message.text]
 * @param {string} [message.html]
 * @throws {Error} Si algún campo obligatorio es inválido.
 */
function validateMessagePayload({ to, subject, text, html }) {
  if (!to || typeof to !== 'string' || !EMAIL_REGEX.test(to.trim())) {
    throw new Error('Dirección de correo destinatario inválida');
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    throw new Error('El asunto del correo es obligatorio');
  }
  if ((!text || typeof text !== 'string') && (!html || typeof html !== 'string')) {
    throw new Error('El mensaje debe contener texto plano o contenido HTML');
  }
}

/**
 * Ejecuta el envío de un correo mediante la Web App de Google Apps Script.
 * @param {Object} options
 * @param {string} options.to - Correo del destinatario.
 * @param {string} options.subject - Asunto del correo.
 * @param {string} [options.text] - Cuerpo en texto plano.
 * @param {string} [options.html] - Cuerpo en HTML.
 * @param {string} [options.fromName='KinesioGestión'] - Nombre del remitente mostrado en Gmail.
 * @returns {Promise<{ success: true, messageId: string, remainingQuota?: number, provider: 'apps-script' }>}
 * @throws {Error} Si el envío no puede completarse tras los intentos permitidos o la respuesta es inválida.
 */
export async function sendWithAppsScript({ to, subject, text, html, fromName = 'KinesioGestión' }) {
  // 1. Validación previa de la solicitud en Node.js
  validateMessagePayload({ to, subject, text, html });

  const url = config.email.appsScript?.url;
  const secret = config.email.appsScript?.secret;
  const timeoutMs = config.email.appsScript?.timeoutMs || 10000;

  if (!url || !secret) {
    throw new Error('Google Apps Script no está configurado (faltan APPS_SCRIPT_URL o APPS_SCRIPT_SECRET)');
  }

  const payload = {
    secret,
    to: to.trim(),
    subject: subject.trim(),
    body: text || '',
    htmlBody: html || text || '',
    fromName
  };

  const maskedTo = maskEmail(to);
  let lastError = null;

  // 2. Ejecución con reintentos acotados (máximo 1 reintento ante errores de red)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow', // Crucial: Google Apps Script redirige respuestas POST (302 -> echo)
        signal: AbortSignal.timeout(timeoutMs)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        throw new Error(`Google Apps Script devolvió una respuesta no válida (HTTP ${response.status})`);
      }

      // 3. Verificación estricta de confirmación: NUNCA asumir éxito si no hay confirmación explícita
      if (!response.ok || !responseData || typeof responseData !== 'object' || responseData.success !== true) {
        const errorCode = responseData?.code || 'APPS_SCRIPT_ERROR';
        const errorMessage = responseData?.error || `Fallo reportado por Apps Script (HTTP ${response.status})`;

        // Manejo específico de cuota agotada
        if (errorCode === 'QUOTA_EXCEEDED' || response.status === 429) {
          console.warn(`[EMAIL] Cuota diaria de Gmail agotada en Google Apps Script para destinatario ${maskedTo}`);
          const quotaError = new Error('Cuota diaria de envío de Gmail agotada en Apps Script');
          quotaError.code = 'QUOTA_EXCEEDED';
          quotaError.isNonRetryable = true;
          throw quotaError;
        }

        // Errores de autorización / cliente no deben reintentarse
        if (response.status === 401 || response.status === 403 || response.status === 422
            || errorCode === 'UNAUTHORIZED' || errorCode === 'BAD_REQUEST' || errorCode === 'INVALID_RECIPIENT' || errorCode === 'MISSING_SUBJECT') {
          const clientError = new Error(errorMessage);
          clientError.code = errorCode;
          clientError.isNonRetryable = true;
          throw clientError;
        }

        throw new Error(errorMessage);
      }

      // Registro de éxito sin exponer secretos ni contenido del correo
      const quotaInfo = typeof responseData.remainingQuota === 'number'
        ? ` (cuota restante estimada: ${responseData.remainingQuota})`
        : '';
      console.log(`[EMAIL] Correo enviado exitosamente vía Apps Script a ${maskedTo}${quotaInfo}`);

      return {
        success: true,
        messageId: responseData.messageId || `apps-script-${Date.now()}`,
        remainingQuota: responseData.remainingQuota,
        provider: 'apps-script'
      };
    } catch (err) {
      lastError = err;

      // Si el error fue marcado como no reintentable (cuota, secreto inválido, validación), fallar de inmediato
      if (err.isNonRetryable || attempt >= MAX_ATTEMPTS) {
        break;
      }

      console.warn(`[EMAIL] Advertencia: intento ${attempt}/${MAX_ATTEMPTS} falló al conectar con Apps Script (${err.message}). Reintentando en ${RETRY_DELAY_MS}ms...`);
      await wait(RETRY_DELAY_MS);
    }
  }

  // Si se agotaron los intentos permitidos, propagar el error controlado
  console.error(`[EMAIL ERROR] No se pudo enviar correo a ${maskedTo} vía Apps Script: ${lastError?.message}`);
  throw lastError;
}
