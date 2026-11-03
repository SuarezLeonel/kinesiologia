# Integración de Envío de Correos con Google Apps Script (Web App)

Este documento detalla el procedimiento para configurar el despacho de correos electrónicos transaccionales de **KinesioGestión** (códigos de recuperación de contraseña y notificaciones) utilizando tu cuenta personal de Gmail (`@gmail.com`) a través de **Google Apps Script Web App**.

---

## 1. ¿Por qué Google Apps Script y no Resend / Brevo / SMTP?

1. **Sin necesidad de dominio propio ni DNS:**
   Servicios como Resend o Brevo exigen ser dueño de un dominio web (`tudominio.com`) y configurar registros DNS (SPF, DKIM, DMARC, MX). Si intentas colocar una dirección `@gmail.com` como remitente en sus paneles de dominios, la rechazan (como se evidencia en el panel de Resend).
2. **Elusión del bloqueo de puertos SMTP en la nube:**
   Plataformas cloud como Render bloquean los puertos SMTP salientes (`25`, `465`, `587`) en sus planes gratuitos. Google Apps Script expone un endpoint seguro **HTTPS en el puerto 443**, el cual nunca es bloqueado.
3. **Uso de la cuota oficial de Gmail:**
   Las cuentas personales de Gmail disponen de **100 correos diarios gratuitos** a través del servicio nativo `MailApp.sendEmail()`, más que suficiente para el uso operativo de un consultorio kinesiológico.
4. **Desacoplamiento total:**
   El backend de KinesioGestión se comunica con la Web App mediante un módulo independiente (`appsScriptSender.js`). En el futuro, si el consultorio adquiere un dominio web comercial, es posible activar Resend o Brevo simplemente cargando las variables de entorno sin modificar una sola línea de código de autenticación ni de base de datos.

---

## 2. Código de la Web App en Google Apps Script

Copia y pega el siguiente código en el editor de Google Apps Script:

```javascript
/**
 * KinesioGestión — Despachador de correos mediante Google Apps Script
 * Endpoint seguro HTTPS (puerto 443) para el backend de KinesioGestión.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Esperar hasta 10 segundos para evitar condiciones de carrera simultáneas
  var hasLock = lock.tryLock(10000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        error: 'Cuerpo de la solicitud vacío o inválido',
        code: 'BAD_REQUEST'
      });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        success: false,
        error: 'JSON malformado en la solicitud',
        code: 'MALFORMED_JSON'
      });
    }

    // 1. Verificación del secreto compartido configurado en Script Properties
    var scriptProps = PropertiesService.getScriptProperties();
    var expectedSecret = scriptProps.getProperty('SHARED_SECRET');

    if (!expectedSecret || !data.secret || data.secret !== expectedSecret) {
      return jsonResponse({
        success: false,
        error: 'No autorizado: secreto compartido inválido o no configurado',
        code: 'UNAUTHORIZED'
      });
    }

    // 2. Control de cuota diaria disponible en la cuenta de Gmail
    var remainingQuota = MailApp.getRemainingDailyQuota();
    if (remainingQuota <= 0) {
      return jsonResponse({
        success: false,
        error: 'Cuota diaria de envío de Gmail agotada (límite de 100 correos/día alcanzado)',
        code: 'QUOTA_EXCEEDED',
        remainingQuota: 0
      });
    }

    // 3. Validación de campos obligatorios
    if (!data.to || typeof data.to !== 'string' || data.to.indexOf('@') === -1) {
      return jsonResponse({
        success: false,
        error: 'Dirección de correo destinatario inválida',
        code: 'INVALID_RECIPIENT'
      });
    }

    if (!data.subject || typeof data.subject !== 'string') {
      return jsonResponse({
        success: false,
        error: 'El asunto del correo es obligatorio',
        code: 'MISSING_SUBJECT'
      });
    }

    var bodyText = data.body || '';
    var htmlContent = data.htmlBody || bodyText;
    var senderName = data.fromName || 'KinesioGestión';

    // 4. Envío nativo mediante MailApp
    MailApp.sendEmail({
      to: data.to.trim(),
      subject: data.subject.trim(),
      body: bodyText,
      htmlBody: htmlContent,
      name: senderName
    });

    // 5. Retornar confirmación con cuota restante estimada
    return jsonResponse({
      success: true,
      messageId: 'gas-' + new Date().getTime(),
      remainingQuota: MailApp.getRemainingDailyQuota()
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error interno en Apps Script: ' + err.toString(),
      code: 'INTERNAL_ERROR'
    });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

// Endpoint de comprobación de salud (Health check para navegadores)
function doGet(e) {
  var remainingQuota = MailApp.getRemainingDailyQuota();
  return jsonResponse({
    status: 'online',
    service: 'KinesioGestión Email Dispatcher',
    remainingDailyQuota: remainingQuota,
    timestamp: new Date().toISOString()
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 3. Guía Paso a Paso de Configuración

### Paso 1: Crear el proyecto en Google Apps Script
1. Abre tu navegador e ingresa con tu cuenta personal de Gmail a: **[https://script.google.com](https://script.google.com)**.
2. Haz clic en el botón superior izquierdo **"Nuevo proyecto"** (New project).
3. Renombra el proyecto arriba a la izquierda: de *"Proyecto sin título"* a **"KinesioGestión Email Sender"**.
4. Borra el código por defecto del archivo `Código.gs` y **pega el código completo** de la sección 2.
5. Guarda los cambios presionando `Ctrl + S` o el icono de disco.

---

### Paso 2: Configurar el Secreto Compartido (`SHARED_SECRET`)
Para evitar que personas ajenas puedan invocar tu script para enviar correos sin autorización, la Web App valida un secreto compartido.

1. En el menú vertical izquierdo de Apps Script, haz clic en el icono de engranaje **"Configuración del proyecto"** (Project Settings).
2. Desplázate hacia abajo hasta la sección **"Propiedades de la secuencia de comandos"** (Script Properties).
3. Haz clic en **"Agregar propiedad de la secuencia de comandos"** (Add script property):
   - **Propiedad (Name):** `SHARED_SECRET`
   - **Valor (Value):** Escribe una clave secreta larga y aleatoria (mínimo 32 caracteres).  
     *(Puedes generar una ejecutando en tu terminal: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)*
4. Haz clic en **"Guardar propiedades de la secuencia de comandos"**.

---

### Paso 3: Implementar como Aplicación Web (Web App)
1. En la esquina superior derecha, haz clic en el botón azul **"Implementar"** (Deploy) > **"Nueva implementación"** (New deployment).
2. En la ventana emergente, haz clic en el icono de engranaje a la izquierda de *"Seleccionar tipo"* y elige **"Aplicación web"** (Web app).
3. Completa los campos exactamente de la siguiente manera:
   - **Descripción:** `KinesioGestión v1`
   - **Ejecutar como (Execute as):** `Yo (<tu_correo>@gmail.com)` *(¡Fundamental para que envíe desde tu Gmail!)*
   - **Quién tiene acceso (Who has access):** `Cualquiera` (Anyone).  
     *(Nota: Cualquier petición sin el `SHARED_SECRET` en su cuerpo será inmediatamente rechazada).*
4. Haz clic en el botón inferior **"Implementar"** (Deploy).

---

### Paso 4: Autorizar Permisos de Gmail
1. Al implementar por primera vez, Google te mostrará la ventana: **"Se requiere autorización"** (Authorization required).
2. Haz clic en **"Revisar permisos"** (Review permissions).
3. Selecciona tu cuenta de Gmail.
4. Google mostrará una advertencia de seguridad: *"Google no ha verificado esta aplicación"* (es normal porque es tu propio script personal).
5. Haz clic en el enlace pequeño abajo que dice **"Configuración avanzada"** (Advanced).
6. Haz clic en **"Ir a KinesioGestión Email Sender (no seguro)"**.
7. En la pantalla de permisos que solicita enviar correos en tu nombre, haz clic en **"Permitir"** (Allow).
8. Google completará el despliegue y te mostrará la **URL de la aplicación web**. Tendrá un formato similar a:
   ```
   https://script.google.com/macros/s/AKfycbxYz1234567890abcdef.../exec
   ```
9. **Copia esta URL**. Esta será tu variable `APPS_SCRIPT_URL`.

---

### Paso 5: Cómo Actualizar el Script en el Futuro (Importante)
Si en algún momento editas el código en `Código.gs`, para que los cambios surtan efecto en la Web App debes crear una nueva versión de la implementación:
1. Haz clic en **"Implementar"** > **"Administrar implementaciones"** (Manage deployments).
2. Selecciona la implementación activa y haz clic en el icono del **lápiz (Editar)** arriba a la derecha.
3. En el selector desplegable **"Versión"**, selecciona **"Nueva versión"** (New version).
4. Haz clic en **"Implementar"**.  
   *(La URL de la aplicación web se mantiene exactamente igual).*

---

## 4. Configurar las Variables de Entorno en el Backend

### En local (`backend/.env`):
Agrega o actualiza las siguientes líneas en tu archivo `backend/.env`:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb...tu_url.../exec
APPS_SCRIPT_SECRET=tu_secreto_configurado_en_shared_secret
APPS_SCRIPT_TIMEOUT_MS=10000
```

### En producción (Render):
1. Ingresa a tu panel en **[https://dashboard.render.com](https://dashboard.render.com)**.
2. Selecciona tu Web Service `kinesiologia-backend`.
3. Ve a la pestaña **"Environment"**.
4. Agrega o actualiza:
   - `APPS_SCRIPT_URL`: pega la URL `/exec` de tu Apps Script.
   - `APPS_SCRIPT_SECRET`: el mismo valor asignado en `SHARED_SECRET`.
5. Haz clic en **"Save changes"**. Render reiniciará la API automáticamente con las nuevas variables.

---

## 5. Prueba de Envío Real

Para verificar de forma interactiva y real que la integración funciona de punta a punta, ejecuta desde la raíz del proyecto:

```bash
node backend/scripts/test_email_apps_script.js tu_correo@gmail.com
```

El script ejecutará:
1. Comprobación del endpoint y cuota diaria disponible (`doGet`).
2. Despacho de un correo de prueba formal con diseño de KinesioGestión (`doPost`).
3. Verificación de la respuesta con confirmación explícita (`success: true`) y cuota restante.

