/**
 * @file gmailApiSender.js
 * @description Envío de correos mediante la API REST de Gmail (HTTPS, puerto 443).
 * Permite enviar desde una cuenta Gmail sin dominio propio y sin usar puertos SMTP,
 * que los hostings gratuitos como Render bloquean. Usa un refresh token OAuth 2.0
 * con el scope `https://www.googleapis.com/auth/gmail.send` (solo envío, sin lectura).
 */

import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const REQUEST_TIMEOUT_MS = 8000;

let cachedAccessToken = null;
let cachedExpiresAt = 0;

/**
 * Indica si las credenciales de Gmail API están completas.
 * @returns {boolean}
 */
export function isGmailApiConfigured() {
  const { clientId, clientSecret, refreshToken, sender } = config.email.gmail;
  return Boolean(clientId && clientSecret && refreshToken && sender);
}

/**
 * Obtiene un access token válido canjeando el refresh token (con caché hasta su vencimiento).
 * @returns {Promise<string>} Access token de Google.
 * @throws {Error} Si Google rechaza el refresh token o las credenciales.
 */
async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const { clientId, clientSecret, refreshToken } = config.email.gmail;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Gmail OAuth rechazó el refresh token: ${data.error_description || data.error || res.status}`);
  }

  cachedAccessToken = data.access_token;
  cachedExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

/**
 * Construye el mensaje MIME (RFC 822) codificado en base64url, formato requerido por Gmail API.
 * @param {{ to: string, subject: string, text: string, html: string }} message
 * @returns {Promise<string>} Mensaje raw en base64url.
 */
export async function buildRawMessage({ to, subject, text, html }) {
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const info = await composer.sendMail({
    from: `"KinesioGestión" <${config.email.gmail.sender}>`,
    to,
    subject,
    text,
    html
  });
  return info.message.toString('base64url');
}

/**
 * Envía un correo a través de la API de Gmail.
 * @param {{ to: string, subject: string, text: string, html: string }} message
 * @returns {Promise<{ success: true, messageId: string }>}
 * @throws {Error} Si la autenticación o el envío fallan.
 */
export async function sendWithGmailApi(message) {
  const accessToken = await getAccessToken();
  const raw = await buildRawMessage(message);

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gmail API respondió ${res.status}: ${data?.error?.message || 'error desconocido'}`);
  }
  return { success: true, messageId: data.id };
}

