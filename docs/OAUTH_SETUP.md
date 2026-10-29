# Guía de Configuración de Proveedores OAuth 2.0 / OpenID Connect

En **KinesioGestión**, la autenticación con proveedores externos (**Google**, **Microsoft** y **Facebook**) está completamente implementada mediante protocolos estándar de la industria (OAuth 2.0 y OpenID Connect), utilizando validación criptográfica en el servidor (backend) y la biblioteca oficial de Expo (`expo-auth-session` / `expo-web-browser`) en el cliente.

Esta guía detalla paso a paso cómo dar de alta las aplicaciones en las consolas de cada proveedor, obtener las credenciales y configurarlas en el sistema.

---

## 1. URIs de Redirección del Proyecto

Al configurar cada proveedor en sus respectivas consolas, debes ingresar exactamente los siguientes URIs de redirección:

| Entorno / Plataforma | URI de Redirección Autorizado |
| :--- | :--- |
| **Web Local (Desarrollo)** | `http://localhost:8081` |
| **Móvil (Expo Go)** | `https://auth.expo.io/@leoboca12/kinesiologia-app` |
| **Móvil (Build Nativo APK/IPA)** | `kinesiologia://` |
| **Producción Web** | `https://tu-dominio.com` *(reemplazar por el dominio real al desplegar)* |

---

## 2. Google Cloud Console (Google Login)

Google utiliza OAuth 2.0 y OpenID Connect para emitir tokens de identidad (`id_token`) con firma criptográfica que el backend de KinesioGestión valida automáticamente contra los endpoints oficiales de Google.

### Pasos de Configuración:

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (o selecciona uno existente) llamado por ejemplo `KinesioGestion`.
3. Ve a **APIs y servicios** > **Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo** > Clic en **Crear**.
   - Nombre de la aplicación: `KinesioGestión`.
   - Correo electrónico de asistencia y datos de contacto del programador: ingresa tu correo.
   - En la sección **Permisos (Scopes)**, agrega:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Guarda los cambios (en fase de prueba puedes agregar los correos de prueba que usarás).
4. Ve a **APIs y servicios** > **Credenciales**:
   - Clic en **+ Crear credenciales** > **ID de cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `KinesioGestión Web & Móvil`.
   - **Orígenes de JavaScript autorizados**:
     - `http://localhost:8081`
     - `https://auth.expo.io`
   - **URIs de redireccionamiento autorizados**:
     - `http://localhost:8081`
     - `https://auth.expo.io/@leoboca12/kinesiologia-app`
   - Clic en **Crear**.
5. Copia el **ID de cliente** (Client ID) y el **Secreto de cliente** (Client Secret).

### Variables de Entorno para Google:
En `backend/.env`:
```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```
*(Opcional en `frontend/.env` si deseas precargar el Client ID en el bundle)*:
```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

---

## 3. GitHub Developer Settings (GitHub Login)

GitHub utiliza OAuth 2.0 estándar con intercambio de código de autorización y validación segura en el backend contra la API oficial de GitHub (`https://api.github.com/user` y `https://api.github.com/user/emails`).

### Pasos de Configuración:

1. Ingresa a [GitHub Developer Settings - OAuth Apps](https://github.com/settings/developers).
2. Haz clic en **New OAuth App** (o **Register a new application**).
3. Completa los campos:
   - **Application name**: `KinesioGestión`.
   - **Homepage URL**: `http://localhost:8081`.
   - **Application description**: `Sistema de Gestión para Consultorio de Kinesiología y Fisioterapia`.
   - **Authorization callback URL**: `http://localhost:8081` (para desarrollo web local).
4. Haz clic en **Register application**.
5. Copia el **Client ID**.
6. En la sección **Client secrets**, haz clic en **Generate a new client secret** y copia el valor generado.

### Variables de Entorno para GitHub:
En `backend/.env`:
```env
GITHUB_CLIENT_ID=Ov23lidJ8hmMaK5scQk8
GITHUB_CLIENT_SECRET=9bd55a12cf34aa1282ea59137165d8880425da6d
```
En `frontend/.env`:
```env
EXPO_PUBLIC_GITHUB_CLIENT_ID=Ov23lidJ8hmMaK5scQk8
```

---

## 4. Meta for Developers (Facebook Login)

Facebook Login utiliza OAuth 2.0 y Meta Graph API con verificación criptográfica en backend (`appsecret_proof` y `debug_token`).

### Pasos de Configuración:

1. Ingresa a [Meta for Developers](https://developers.facebook.com/).
2. Inicia sesión y ve a **Mis apps** > **Crear app**.
3. Selecciona el caso de uso: **Permitir a las personas iniciar sesión con su cuenta de Facebook**.
4. Asigna un nombre (ej. `KinesioGestión App`) e ingresa tu correo de contacto comercial.
5. En el panel de control de la app, busca el producto **Inicio de sesión con Facebook para el negocio / web** y haz clic en **Configuración**:
   - En **Configuración de inicio de sesión con Facebook**:
     - **URIs de redireccionamiento de OAuth válidos**:
       - `http://localhost:8081`
       - `https://auth.expo.io/@leoboca12/kinesiologia-app`
     - Guarda los cambios.
6. Ve a **Configuración de la app** > **Básica**:
   - Copia el **Identificador de la app** (App ID).
   - Haz clic en **Mostrar** y copia la **Clave secreta de la app** (App Secret).
   - En **Casos de uso** > **Inicio de sesión con Facebook**, asegúrate de que los permisos concedidos incluyan `public_profile` y `email`.

### Variables de Entorno para Facebook:
En `backend/.env`:
```env
FACEBOOK_APP_ID=xxxxxxxxxxxxxxx
FACEBOOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
*(Opcional en `frontend/.env`)*:
```env
EXPO_PUBLIC_FACEBOOK_APP_ID=xxxxxxxxxxxxxxx
```

---

## 5. Reglas de Seguridad y Vinculación en KinesioGestión

El sistema aplica estrictas reglas de negocio y seguridad en el backend para proteger las cuentas de los usuarios:

1. **Restricción de Rol en Registro Público:**
   - Todo usuario que se registre por primera vez mediante Google, Microsoft o Facebook recibe **estrictamente el rol de paciente (`patient`)**.
   - Bajo ninguna circunstancia un registro externo puede otorgar privilegios de administrador, kinesiólogo o recepcionista.
2. **Protección contra Apropiación de Cuenta (Account Takeover):**
   - Si una persona intenta ingresar con un proveedor social cuyo correo ya está registrado en el sistema con contraseña tradicional, **el sistema NO vincula la cuenta automáticamente**.
   - En su lugar, el sistema solicita de forma segura que el usuario ingrese la contraseña actual de su cuenta para confirmar explícitamente su identidad antes de enlazar el proveedor social.
3. **Manejo de Permisos Restringidos (ej. Facebook sin correo):**
   - Si el usuario rechaza conceder el permiso de correo electrónico en Facebook, la aplicación muestra una pantalla para que ingrese su correo y lo verifique antes de habilitar la cuenta.
4. **Integridad de Fichas Médicas:**
   - La tabla de cuentas de acceso (`users`) y la tabla de fichas clínicas (`patients`) se mantienen separadas.
   - Las fichas clínicas existentes no se duplican y sólo se asocian tras verificar fehacientemente la identidad del paciente.

