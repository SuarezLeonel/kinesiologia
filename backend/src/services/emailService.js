import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    if (config.nodeEnv === 'test') {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return this.transporter;
    }

    const transportTimeouts = {
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000
    };

    if (config.email.host && config.email.user && config.email.pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure,
          auth: {
            user: config.email.user.trim(),
            pass: String(config.email.pass).replace(/\s+/g, '')
          },
          ...transportTimeouts
        });
        return this.transporter;
      } catch (err) {
        console.warn('[EMAIL] Fallo al instanciar transporter SMTP:', err.message);
      }
    }

    // Si no hay configuración SMTP, crear cuenta de prueba en Ethereal con timeout
    try {
      const testAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ethereal test account timeout (3000ms)')), 3000))
      ]);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        ...transportTimeouts
      });
      return this.transporter;
    } catch {
      // Fallback a transporter JSON en caso de no haber conexión saliente
      this.transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      return this.transporter;
    }
  }

  async sendPasswordResetEmail({ to, name = 'Usuario', resetCode, resetToken }) {
    try {
      const resetLink = `${config.email.appUrl}/?resetToken=${encodeURIComponent(resetToken || '')}`;

      const mailOptions = {
        from: config.email.from,
        to,
        subject: `KinesioGestión — Código de recuperación: ${resetCode}`,
        text: `Hola ${name},\n\nHa solicitado restablecer su contraseña de acceso a KinesioGestión.\n\nSu código de verificación es: ${resetCode}\n\nEste código es de un solo uso y vencerá en 15 minutos.\n\nSi no ha solicitado este cambio, ignore este mensaje.\n\nEquipo KinesioGestión.`,
        html: `
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
        `
      };

      // 1. Envío por API HTTP (Resend) si está configurado (Puerto 443 - HTTPS estándar, nunca bloqueado en Render)
      if (config.email.resendApiKey && config.nodeEnv !== 'test') {
        try {
          // Resend en cuentas de prueba exige enviar desde onboarding@resend.dev a menos que se configure un dominio propio verificado
          const fromSender = config.email.resendFrom
            || (config.email.from && config.email.from.includes('@resend.dev') ? config.email.from : 'KinesioGestión <onboarding@resend.dev>');

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.email.resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: fromSender,
              to: [to],
              subject: mailOptions.subject,
              text: mailOptions.text,
              html: mailOptions.html
            }),
            signal: AbortSignal.timeout(6000)
          });
          const resData = await res.json().catch(() => ({}));
          if (res.ok) {
            console.log('[EMAIL] Correo enviado exitosamente vía Resend API (id:', resData.id, ')');
            return { success: true, messageId: resData.id };
          }
          console.warn('[EMAIL] Fallo al enviar con Resend API:', resData);
        } catch (apiErr) {
          console.warn('[EMAIL] Error de conexión con Resend API:', apiErr.message);
        }
      }

      // 2. Envío por API HTTP (Brevo) si está configurado (Puerto 443)
      if (config.email.brevoApiKey && config.nodeEnv !== 'test') {
        try {
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': config.email.brevoApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sender: { name: 'KinesioGestión', email: config.email.user || 'no-reply@kinesiologia.com' },
              to: [{ email: to, name }],
              subject: mailOptions.subject,
              textContent: mailOptions.text,
              htmlContent: mailOptions.html
            }),
            signal: AbortSignal.timeout(6000)
          });
          const resData = await res.json().catch(() => ({}));
          if (res.ok) {
            console.log('[EMAIL] Correo enviado exitosamente vía Brevo API (id:', resData.messageId, ')');
            return { success: true, messageId: resData.messageId };
          }
          console.warn('[EMAIL] Fallo al enviar con Brevo API:', resData);
        } catch (apiErr) {
          console.warn('[EMAIL] Error de conexión con Brevo API:', apiErr.message);
        }
      }

      // 3. Envío SMTP tradicional (Nodemailer / Gmail)
      const transporter = await this.getTransporter();

      const info = await Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP sendMail timeout (5000ms excedido)')), 5000))
      ]);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined
      };
    } catch (error) {
      console.error('[EMAIL ERROR] Fallo al enviar correo:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const emailService = new EmailService();
