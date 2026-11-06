/**
 * @file emailService.js
 * @description Servicio unificado de despacho de correos electrónicos transaccionales para KinesioGestión.
 * Opera exclusivamente mediante HTTPS sobre puerto 443 sin utilizar Nodemailer ni SMTP, garantizando
 * máxima compatibilidad con entornos cloud (Render, Vercel) donde los puertos SMTP tradicionales (25, 465, 587)
 * se encuentran bloqueados.
 *
 * Estrategia de proveedores (Patrón Adaptador desacoplado):
 * 1. Google Apps Script Web App (Primario): Despacho gratuito desde cuenta personal de Gmail (@gmail.com)
 *    sin necesidad de dominio propio ni configuración de registros DNS.
 * 2. Resend API HTTP (Alternativo / Migración futura): Despacho profesional mediante API REST HTTPS.
 * 3. Brevo API HTTP (Alternativo / Migración futura): Despacho transaccional mediante API REST HTTPS.
 * 4. Mock en memoria: Entornos de testing automatizado (NODE_ENV=test o NODE_TEST_CONTEXT) sin llamadas externas.
 *
 * Seguridad:
 * - Los códigos de verificación, tokens y contraseñas jamás se imprimen en logs.
 * - Toda la lógica de autenticación, generación y expiración de códigos reside en Node.js y MySQL.
 */

import { config } from '../config/env.js';
import { isAppsScriptConfigured, sendWithAppsScript } from './appsScriptSender.js';

/**
 * Sanitiza una dirección de correo para auditoría segura sin exponer datos sensibles.
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
 * Servicio unificado de correos electrónicos.
 */
class EmailService {
  /**
   * Envía un correo genérico utilizando el proveedor configurado de mayor prioridad.
   * @param {Object} options
   * @param {string} options.to - Destinatario.
   * @param {string} options.subject - Asunto.
   * @param {string} [options.text] - Contenido en texto plano.
   * @param {string} [options.html] - Contenido HTML.
   * @param {string} [options.fromName='KinesioGestión'] - Nombre del remitente.
   * @returns {Promise<{ success: boolean, messageId?: string, provider?: string, error?: string }>}
   */
  async sendEmail({ to, subject, text, html, fromName = 'KinesioGestión' }) {
    const isAutomatedTest = config.nodeEnv === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
    const maskedTo = maskEmail(to);

    // 0. Mock seguro para pruebas automatizadas (sin tráfico de red saliente)
    if (isAutomatedTest) {
      return {
        success: true,
        messageId: `test-mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        provider: 'test-mock'
      };
    }

    // 1. Proveedor Primario: Google Apps Script Web App (HTTPS 443)
    if (isAppsScriptConfigured()) {
      try {
        const result = await sendWithAppsScript({ to, subject, text, html, fromName });
        return {
          success: true,
          messageId: result.messageId,
          provider: 'apps-script'
        };
      } catch (err) {
        console.error(`[EMAIL ERROR] Fallo en proveedor Google Apps Script para ${maskedTo}:`, err.message);
        // Si falló Apps Script y no hay proveedor de respaldo configurado, retornar error
        if (!config.email.resendApiKey && !config.email.brevoApiKey) {
          return { success: false, error: err.message, provider: 'apps-script' };
        }
        console.warn('[EMAIL] Intentando proveedor alternativo de respaldo...');
      }
    }

    // 2. Proveedor Secundario / Alternativo: Resend API (HTTPS 443)
    if (config.email.resendApiKey) {
      try {
        const fromSender = config.email.resendFrom || 'KinesioGestión <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.email.resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromSender,
            to: [to],
            subject,
            text: text || '',
            html: html || text || ''
          }),
          signal: AbortSignal.timeout(config.email.appsScript?.timeoutMs || 8000)
        });

        const resData = await response.json().catch(() => ({}));
        if (response.ok && resData?.id) {
          console.log(`[EMAIL] Correo enviado exitosamente vía Resend API a ${maskedTo}`);
          return { success: true, messageId: resData.id, provider: 'resend' };
        }
        console.warn(`[EMAIL] Fallo reportado por Resend API para ${maskedTo}:`, resData?.message || response.statusText);
      } catch (resendErr) {
        console.warn(`[EMAIL] Error de conexión con Resend API para ${maskedTo}:`, resendErr.message);
      }
    }

    // 3. Proveedor Secundario / Alternativo: Brevo API (HTTPS 443)
    if (config.email.brevoApiKey) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': config.email.brevoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: fromName, email: 'no-reply@kinesiologia.com' },
            to: [{ email: to }],
            subject,
            textContent: text || '',
            htmlContent: html || text || ''
          }),
          signal: AbortSignal.timeout(config.email.appsScript?.timeoutMs || 8000)
        });

        const resData = await response.json().catch(() => ({}));
        if (response.ok && (resData?.messageId || resData?.messageIds)) {
          console.log(`[EMAIL] Correo enviado exitosamente vía Brevo API a ${maskedTo}`);
          return {
            success: true,
            messageId: resData.messageId || resData.messageIds?.[0],
            provider: 'brevo'
          };
        }
        console.warn(`[EMAIL] Fallo reportado por Brevo API para ${maskedTo}:`, resData?.message || response.statusText);
      } catch (brevoErr) {
        console.warn(`[EMAIL] Error de conexión con Brevo API para ${maskedTo}:`, brevoErr.message);
      }
    }

    // 4. Si ningún proveedor está configurado o todos fallaron
    const errorMsg = 'No hay proveedor de correo disponible o configurado. Verifique APPS_SCRIPT_URL y APPS_SCRIPT_SECRET en backend/.env';
    console.error(`[EMAIL ERROR] Despacho no completado para ${maskedTo}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg
    };
  }

  /**
   * Envía el correo con el código de recuperación de contraseña de 6 dígitos.
   * La generación, almacenamiento en base de datos y validación de expiración residen en auth/service.js.
   * @param {Object} params
   * @param {string} params.to - Dirección de correo electrónico del usuario.
   * @param {string} [params.name='Usuario'] - Nombre del usuario destinatario.
   * @param {string} params.resetCode - Código numérico de 6 dígitos.
   * @returns {Promise<{ success: boolean, messageId?: string, provider?: string, error?: string }>}
   */
  async sendPasswordResetEmail({ to, name = 'Usuario', resetCode }) {
    if (!resetCode) {
      throw new Error('El código de recuperación es obligatorio para enviar el correo');
    }

    const subject = 'KinesioGestión — Código de recuperación de cuenta';
    const text = `Hola ${name},\n\nHa solicitado restablecer su contraseña de acceso a KinesioGestión.\n\nSu código de verificación es: ${resetCode}\n\nEste código es de un solo uso y vencerá en 15 minutos.\n\nSi no ha solicitado este cambio, ignore este mensaje.\n\nEquipo KinesioGestión.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px; background-color: #FFFFFF;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 8px; background-color: #E8F0EC; color: #537C68; font-weight: bold; font-size: 18px; text-align: center; border: 1px solid #C4D9CD;">KG</div>
          <h2 style="margin: 12px 0 4px 0; color: #1D211E; font-size: 20px;">KinesioGestión</h2>
          <p style="margin: 0; color: #64748B; font-size: 13px;">Sistema Integral de Consultorio</p>
        </div>

        <div style="padding: 20px; background-color: #F8FAFC; border-radius: 6px; border: 1px solid #EDF2F7; margin-bottom: 20px;">
          <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px;">Estimado/a <strong>${name}</strong>,</p>
          <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 22px;">
            Hemos recibido una solicitud para restablecer la contraseña de su cuenta en KinesioGestión. Utilice el siguiente código de verificación de 6 dígitos en la aplicación:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; padding: 12px 24px; background-color: #E8F0EC; border: 2px dashed #537C68; border-radius: 8px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #537C68;">
              ${resetCode}
            </div>
          </div>

          <p style="margin: 0 0 8px 0; color: #64748B; font-size: 12px; text-align: center;">
            Este código expirará en <strong>15 minutos</strong> y puede utilizarse una sola vez.
          </p>
        </div>

        <p style="margin: 0 0 16px 0; color: #94A3B8; font-size: 12px; line-height: 18px;">
          Si usted no realizó esta solicitud, puede desestimar este mensaje de forma segura. Su contraseña actual no ha sido modificada.
        </p>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 24px; text-align: center; color: #94A3B8; font-size: 11px;">
          KinesioGestión — Sistema Seguro de Gestión Clínica y Administrativa
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      fromName: 'KinesioGestión'
    });
  }

  /**
   * Envía el correo de verificación de cuenta con enlace de un solo uso y botón destacado.
   * Diseñado respetando la identidad visual médica y botánica de KinesioGestión.
   * @param {Object} params
   * @param {string} params.to - Destinatario.
   * @param {string} [params.name='Usuario'] - Nombre del usuario.
   * @param {string} params.verificationUrl - URL completa de verificación generada por el backend.
   * @returns {Promise<{ success: boolean, messageId?: string, provider?: string, error?: string }>}
   */
  async sendAccountVerificationEmail({ to, name = 'Usuario', verificationUrl }) {
    if (!verificationUrl) {
      throw new Error('La URL de verificación es obligatoria para enviar el correo');
    }

    const subject = 'KinesioGestión — Verificación de correo electrónico';
    const text = `Hola ${name},\n\nGracias por registrarte en KinesioGestión.\n\nPara activar tu cuenta y acceder al portal, por favor verificá tu dirección de correo electrónico ingresando al siguiente enlace:\n\n${verificationUrl}\n\nEste enlace de verificación es de un solo uso y vencerá en 30 minutos.\n\nSi no solicitaste crear una cuenta en KinesioGestión, podés ignorar este correo de forma segura. La cuenta no será activada.\n\nEquipo KinesioGestión.`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #F1F5F9;">
          <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 10px; background-color: #E8F0EC; color: #537C68; font-weight: bold; font-size: 20px; text-align: center; border: 1px solid #C4D9CD;">KG</div>
          <h1 style="margin: 12px 0 4px 0; color: #0F172A; font-size: 22px; font-weight: 700;">KinesioGestión</h1>
          <p style="margin: 0; color: #64748B; font-size: 13px;">Sistema Integral de Gestión Clínica y Consultorio</p>
        </div>

        <div style="padding: 24px; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 20px;">
          <p style="margin: 0 0 14px 0; color: #1E293B; font-size: 15px;">Hola <strong>${name}</strong>,</p>
          <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 22px;">
            Hemos recibido una solicitud para crear una cuenta con esta dirección de correo electrónico en <strong>KinesioGestión</strong>.
          </p>
          <p style="margin: 0 0 24px 0; color: #334155; font-size: 14px; line-height: 22px;">
            Para completar tu registro, proteger la seguridad de tu información de salud y habilitar el acceso a tu portal de turnos y tratamientos, es necesario que verifiques tu correo presionando el siguiente botón:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #0D9488; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(13, 148, 136, 0.3);">
              Verificar mi cuenta
            </a>
          </div>

          <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px 14px; margin-top: 16px; text-align: center;">
            <p style="margin: 0; color: #166534; font-size: 12px;">
              Este enlace es de <strong>un solo uso</strong> y vence en <strong>30 minutos</strong>.
            </p>
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 0 8px;">
          <p style="margin: 0 0 6px 0; color: #64748B; font-size: 12px;">
            Si el botón no funciona, copiá y pegá el siguiente enlace directamente en tu navegador:
          </p>
          <p style="margin: 0; word-break: break-all; font-size: 12px; color: #0D9488;">
            <a href="${verificationUrl}" style="color: #0D9488; text-decoration: underline;">${verificationUrl}</a>
          </p>
        </div>

        <div style="padding: 12px 14px; background-color: #F8FAFC; border-left: 3px solid #94A3B8; border-radius: 0 6px 6px 0; margin-bottom: 20px;">
          <p style="margin: 0; color: #64748B; font-size: 12px; line-height: 18px;">
            <strong>Aviso de seguridad:</strong> Si no solicitaste registrarte en KinesioGestión, podés desestimar este mensaje de forma segura. La cuenta no será activada ni se podrá acceder a ninguna funcionalidad.
          </p>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 24px; text-align: center; color: #94A3B8; font-size: 11px;">
          KinesioGestión — Sistema Seguro de Gestión Clínica y Administrativa
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      fromName: 'KinesioGestión'
    });
  }
}

export const emailService = new EmailService();
