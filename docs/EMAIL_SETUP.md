# Configuración de envío de emails con Gmail API

Permite enviar los códigos de recuperación de contraseña **desde una cuenta Gmail, sin dominio propio**,
usando HTTPS (puerto 443). Es necesario en hostings gratuitos como Render, que bloquean los puertos SMTP.

Orden de prioridad del backend: **Gmail API → Resend → Brevo → SMTP**. Se usa la primera opción configurada;
si falla, se prueba la siguiente.

## 1. Habilitar la API de Gmail
1. Entrar a [Google Cloud Console](https://console.cloud.google.com/) y elegir el proyecto de la app.
2. **APIs y servicios → Biblioteca →** buscar **Gmail API → Habilitar**.

## 2. Pantalla de consentimiento OAuth
1. **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Si el estado es **"Testing"**, pasarlo a **"In production"** (botón *Publish app*).
   Si queda en *Testing*, el refresh token **vence a los 7 días** y los emails dejan de enviarse.
3. Al ser un scope sensible, Google mostrará "app no verificada" al autorizar. Es esperable: solo la usa el propietario de la cuenta.

## 3. Credenciales OAuth dedicadas
1. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**, nombre `kinesio-gmail`.
2. En **URI de redireccionamiento autorizados** agregar exactamente: `https://developers.google.com/oauthplayground`
3. Guardar el **Client ID** y el **Client secret**.

> Se recomienda crear un cliente nuevo y no modificar el usado para el login social.

## 4. Obtener el refresh token (una sola vez)
1. Abrir [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Engranaje (arriba a la derecha) → marcar **Use your own OAuth credentials** → pegar Client ID y Client secret.
3. En el paso 1, en el cuadro *"Input your own scopes"* escribir `https://www.googleapis.com/auth/gmail.send` y **Authorize APIs**.
4. Iniciar sesión con la cuenta Gmail remitente y aceptar (en la advertencia, *Avanzado → Continuar*).
5. Paso 2: **Exchange authorization code for tokens** y copiar el **Refresh token**.

## 5. Variables de entorno (Render → Environment)
| Variable | Valor |
| :--- | :--- |
| `GMAIL_CLIENT_ID` | Client ID del paso 3 |
| `GMAIL_CLIENT_SECRET` | Client secret del paso 3 |
| `GMAIL_REFRESH_TOKEN` | Refresh token del paso 4 |
| `GMAIL_SENDER` | Cuenta Gmail remitente (ej. `usuario@gmail.com`) |

Después de guardar, Render redespliega solo. En los logs aparece `[EMAIL] Correo enviado exitosamente vía Gmail API`.

## Notas
- Límite de Gmail: unos 500 envíos por día para cuentas personales.
- El scope `gmail.send` solo permite **enviar**; no puede leer ni borrar correos.
- Si el refresh token se revoca, el log mostrará `Gmail OAuth rechazó el refresh token`; repetir el paso 4.

