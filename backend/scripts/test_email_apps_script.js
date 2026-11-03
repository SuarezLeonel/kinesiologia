/**
 * @file test_email_apps_script.js
 * @description Script interactivo de verificación en vivo para el despachador de correos
 * de Google Apps Script Web App.
 *
 * Uso:
 *   node backend/scripts/test_email_apps_script.js [destinatario@correo.com]
 *
 * Ejemplo:
 *   node backend/scripts/test_email_apps_script.js leonelsuarezmiranda@gmail.com
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { isAppsScriptConfigured, sendWithAppsScript } from '../src/services/appsScriptSender.js';

async function main() {
  console.log('====================================================');
  console.log(' KinesioGestión — Verificación de Google Apps Script');
  console.log('====================================================\n');

  if (!isAppsScriptConfigured()) {
    console.error('❌ ERROR: APPS_SCRIPT_URL o APPS_SCRIPT_SECRET no están definidos en backend/.env');
    console.error('   Sigue los pasos en docs/GOOGLE_APPS_SCRIPT.md para desplegar la Web App.');
    process.exit(1);
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const targetEmail = process.argv[2]?.trim() || process.env.EMAIL_TEST_RECIPIENT || 'leonelsuarezmiranda@gmail.com';

  console.log('1. Verificando estado y cuota diaria de la Web App...');
  console.log(`   URL: ${scriptUrl.slice(0, 45)}...`);

  try {
    const healthRes = await fetch(scriptUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (healthRes.ok) {
      const healthData = await healthRes.json().catch(() => null);
      if (healthData && healthData.status === 'online') {
        console.log('   ✅ Web App responde correctamente (Status: online)');
        console.log(`   📊 Cuota diaria restante de Gmail: ${healthData.remainingDailyQuota ?? 'No disponible'} correos\n`);
      } else {
        console.warn('   ⚠️ Web App respondió pero no devolvió el formato esperado:', healthData);
      }
    } else {
      console.warn(`   ⚠️ GET respondió con HTTP ${healthRes.status}. Procediendo con la prueba POST...`);
    }
  } catch (healthErr) {
    console.warn(`   ⚠️ No se pudo consultar el estado GET (${healthErr.message}). Procediendo con POST...`);
  }

  console.log(`2. Enviando correo de prueba a: ${targetEmail}`);
  console.log('   Enviando mediante MailApp.sendEmail() a través de HTTPS (puerto 443)...');

  const testSubject = `KinesioGestión — Verificación de Envío [${new Date().toLocaleTimeString('es-AR')}]`;
  const testText = `¡Hola!\n\nEste es un mensaje de comprobación exitoso del sistema de correos de KinesioGestión.\n\nFecha y hora: ${new Date().toLocaleString('es-AR')}\nProveedor: Google Apps Script Web App (HTTPS / MailApp)\n\nEl sistema se encuentra listo para el envío de códigos de recuperación y notificaciones.`;
  const testHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #C4D9CD; border-radius: 8px; background-color: #FFFFFF;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 8px; background-color: #E8F0EC; color: #537C68; font-weight: bold; font-size: 18px; text-align: center; border: 1px solid #C4D9CD;">KG</div>
        <h2 style="margin: 10px 0 4px 0; color: #1D211E; font-size: 20px;">KinesioGestión</h2>
        <p style="margin: 0; color: #537C68; font-size: 13px; font-weight: 600;">Verificación de Conexión Exitosa</p>
      </div>

      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 18px; margin-bottom: 18px;">
        <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;">
          Este correo confirma que la integración de <strong>Google Apps Script Web App</strong> con el backend de <strong>KinesioGestión</strong> está operando correctamente.
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 20px;">
          <li><strong>Protocolo:</strong> HTTPS sobre puerto 443 (Compatible con Render)</li>
          <li><strong>Motor de envío:</strong> Google MailApp nativo</li>
          <li><strong>Autenticación:</strong> Secreto compartido (SHARED_SECRET)</li>
          <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</li>
        </ul>
      </div>

      <p style="margin: 0; color: #94A3B8; font-size: 11px; text-align: center;">
        KinesioGestión — Sistema Seguro de Gestión Integral de Consultorio
      </p>
    </div>
  `;

  try {
    const result = await sendWithAppsScript({
      to: targetEmail,
      subject: testSubject,
      text: testText,
      html: testHtml,
      fromName: 'KinesioGestión'
    });

    console.log('\n====================================================');
    console.log(' 🎉 ¡ENVÍO EXITOSO!');
    console.log('====================================================');
    console.log(` ✔️ Message ID: ${result.messageId}`);
    if (typeof result.remainingQuota === 'number') {
      console.log(` ✔️ Cuota restante de Gmail: ${result.remainingQuota} correos hoy`);
    }
    console.log(` ✔️ Proveedor activo: ${result.provider}`);
    console.log(`\nRevisa la bandeja de entrada (o Spam) de ${targetEmail}.`);
    process.exit(0);
  } catch (err) {
    console.log('\n====================================================');
    console.log(' ❌ FALLO EN LA PRUEBA');
    console.log('====================================================');
    console.error(` Error: ${err.message}`);
    if (err.code) console.error(` Código: ${err.code}`);
    console.log('\nAcciones recomendadas:');
    console.log(' 1. Verifica que APPS_SCRIPT_SECRET coincida con SHARED_SECRET en Google Apps Script.');
    console.log(' 2. Verifica que la Web App esté desplegada con "Acceso: Cualquiera".');
    console.log(' 3. Si modificaste el script, crea una "Nueva versión" en Administrar implementaciones.');
    process.exit(1);
  }
}

main();
