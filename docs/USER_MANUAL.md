# Manual de Usuario, Instalación y Documentación de API — KinesioGestión

**Sistema Móvil y Web de Gestión Integral para Consultorios de Kinesiología y Fisioterapia**  
Versión: 2.0 (Producción)

---

## Índice General

1. [Guía de Instalación y Configuración del Entorno](#1-guía-de-instalación-y-configuración-del-entorno)
   - [1.1 Requisitos Previos del Sistema](#11-requisitos-previos-del-sistema)
   - [1.2 Clonación y Estructura del Proyecto](#12-clonación-y-estructura-del-proyecto)
   - [1.3 Configuración y Puesta en Marcha del Backend](#13-configuración-y-puesta-en-marcha-del-backend)
   - [1.4 Configuración y Ejecución de la Base de Datos](#14-configuración-y-ejecución-de-la-base-de-datos)
   - [1.5 Configuración y Puesta en Marcha del Frontend](#15-configuración-y-puesta-en-marcha-del-frontend)
   - [1.6 Verificación de Calidad y Pruebas Automatizadas](#16-verificación-de-calidad-y-pruebas-automatizadas)
2. [Manual Operativo de Usuario](#2-manual-operativo-de-usuario)
   - [2.1 Matriz de Roles y Control de Acceso (RBAC)](#21-matriz-de-roles-y-control-de-acceso-rbac)
   - [2.2 Perfil: Administrador (Admin)](#22-perfil-administrador-admin)
   - [2.3 Perfil: Kinesiólogo (Profesional Clínico)](#23-perfil-kinesiólogo-profesional-clínico)
   - [2.4 Perfil: Recepcionista (Personal Administrativo)](#24-perfil-recepcionista-personal-administrativo)
   - [2.5 Perfil: Paciente (Portal de Autogestión y Home Care)](#25-perfil-paciente-portal-de-autogestión-y-home-care)
   - [2.6 Credenciales de Demostración](#26-credenciales-de-demostración)
3. [Documentación Técnica de la API REST](#3-documentación-técnica-de-la-api-rest)
   - [3.1 Reglas Arquitectónicas y Estándares HTTP](#31-reglas-arquitectónicas-y-estándares-http)
   - [3.2 Esquema Global de Respuestas y Errores](#32-esquema-global-de-respuestas-y-errores)
   - [3.3 Autenticación y Seguridad JWT](#33-autenticación-y-seguridad-jwt)
   - [3.4 Endpoints: Autenticación y Sesión (`/auth`)](#34-endpoints-autenticación-y-sesión-auth)
   - [3.5 Endpoints: Padrón de Pacientes (`/patients`)](#35-endpoints-padrón-de-pacientes-patients)
   - [3.6 Endpoints: Agenda y Turnos (`/appointments`)](#36-endpoints-agenda-y-turnos-appointments)
   - [3.7 Endpoints: Historias Clínicas y PDF (`/clinical-records`)](#37-endpoints-historias-clínicas-y-pdf-clinical-records)
   - [3.8 Endpoints: Tratamientos, Rutinas y Sesiones (`/treatments`)](#38-endpoints-tratamientos-rutinas-y-sesiones-treatments)
   - [3.9 Endpoints: Portal del Paciente Home Care (`/patient-portal`)](#39-endpoints-portal-del-paciente-home-care-patient-portal)
   - [3.10 Endpoints: Catálogo de Ejercicios (`/exercises`)](#310-endpoints-catálogo-de-ejercicios-exercises)
   - [3.11 Endpoints: Cobros, Paquetes y Caja Diaria (`/payments`)](#311-endpoints-cobros-paquetes-y-caja-diaria-payments)
   - [3.12 Endpoints: Servicios y Tarifario (`/services`)](#312-endpoints-servicios-y-tarifario-services)
   - [3.13 Endpoints: Dashboard Modular (`/dashboard`)](#313-endpoints-dashboard-modular-dashboard)

---

# 1. Guía de Instalación y Configuración del Entorno

Esta sección detalla paso a paso cómo preparar desde cero el entorno de desarrollo local tanto para el servidor backend como para la aplicación móvil frontend y la base de datos MySQL.

## 1.1 Requisitos Previos del Sistema

Asegúrese de contar con las siguientes herramientas instaladas en su equipo:
- **Node.js:** Versión `v20.x` o `v22.x` LTS (verificado en Node.js `v22.15.0`).
- **npm:** Versión `v10.x` o superior.
- **Git:** Para control de versiones.
- **Base de Datos MySQL:** MySQL 8.0 local (instalado directamente, mediante XAMPP/WampServer o contenedor Docker) o una instancia en la nube compatible como **TiDB Cloud Serverless** con SSL.
- **Expo CLI:** Ejecutable mediante `npx expo`.
- **(Opcional para pruebas móviles físicas):** Aplicación **Expo Go** instalada desde Google Play Store o Apple App Store en su smartphone.

---

## 1.2 Clonación y Estructura del Proyecto

Abra una terminal (PowerShell en Windows o Bash en macOS/Linux) y clone el repositorio:

```powershell
git clone https://github.com/SuarezLeonel/kinesiologia.git
cd kinesiologia
```

El repositorio se organiza con una arquitectura modular desacoplada:
```
kinesiologia/
├── backend/                # API REST en Node.js + Express (ES Modules)
│   ├── database/           # Migraciones versionadas y semillas SQL
│   ├── scripts/            # Scripts de automatización (seed, create-admin)
│   ├── src/
│   │   ├── config/         # Variables de entorno y pool MySQL (mysql2)
│   │   ├── modules/        # Arquitectura en capas por dominio de negocio
│   │   ├── middlewares/    # Autenticación JWT, RBAC, validación Zod, rate limiting
│   │   └── services/       # Envío de emails (Resend / SMTP), logger de auditoría
│   └── tests/              # Suite de pruebas automatizadas (Node.js test runner)
├── frontend/               # Aplicación móvil y web en React Native + Expo + TypeScript
│   ├── src/
│   │   ├── api/            # Cliente Axios centralizado con interceptores y SecureStore
│   │   ├── context/        # Context API para estado global (AuthContext, ThemeContext)
│   │   ├── navigation/     # React Navigation (Pilas públicas y privadas por rol)
│   │   ├── screens/        # Pantallas del sistema adaptadas a cada rol
│   │   └── components/     # Componentes reutilizables, modales y banners accesibles
└── docs/                   # Documentación técnica, arquitectura y manuales
```

---

## 1.3 Configuración y Puesta en Marcha del Backend

### Paso 1: Instalación de Dependencias
Ingrese al directorio del backend y descargue los paquetes necesarios:
```powershell
cd backend
npm install
```

### Paso 2: Configuración del Archivo `.env`
Cree el archivo de entorno en la carpeta `backend/`:
```powershell
cp .env.example .env
```

Abra `backend/.env` con su editor de código y defina las siguientes variables obligatorias:

```env
# 1. Servidor HTTP
PORT=3000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:8081,http://localhost:19006,exp://192.168.1.1:8081

# 2. Base de Datos MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=kinesiologia_db
DB_CONNECTION_LIMIT=10
DB_SSL=false

# 3. Seguridad Criptográfica JWT (Mínimo 32 caracteres cada uno)
# Puede generar secretos seguros con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=clave_secreta_para_access_tokens_minimo_32_caracteres_aleatorios
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=clave_secreta_para_refresh_tokens_minimo_32_caracteres_aleatorios
JWT_REFRESH_EXPIRES_IN=7d
JWT_RESET_SECRET=clave_secreta_para_recuperacion_contrasena_minimo_32_caracteres
JWT_RESET_EXPIRES_IN=15m

# 4. Envío de Correos Electrónicos (Recuperación de Contraseña)
# Opción A (Recomendada para producción / cloud): Resend HTTP API (Puerto 443)
RESEND_API_KEY=re_tu_api_key_de_resend

# Opción B (Desarrollo local / SMTP tradicional):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion_google
SMTP_FROM="KinesioGestión" <no-reply@kinesiologia.com>
APP_URL=http://localhost:8081

# 5. Proveedores OAuth 2.0 (Opcional - Inicio de Sesión Social)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

---

## 1.4 Configuración y Ejecución de la Base de Datos

### Opción A: MySQL Local (XAMPP / Docker / Servicio Nativo)
1. Asegúrese de que el servicio MySQL esté corriendo en el puerto `3306`.
2. Cree la base de datos vacía (si aún no existe):
   ```sql
   CREATE DATABASE IF NOT EXISTS kinesiologia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### Opción B: TiDB Cloud Serverless (Nube Gratuita con TLS)
Si utiliza TiDB Cloud, establezca en su `.env`:
```env
DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=xxxxxxxx.root
DB_PASSWORD=tu_password_tidb
DB_NAME=kinesiologia_db
DB_SSL=true
```

### Ejecutar Migraciones y Datos de Demostración
Desde la carpeta `backend/`, ejecute los siguientes comandos en orden:

1. **Aplicar las 14 migraciones versionadas (Estructura de tablas, índices y restricciones):**
   ```powershell
   npm run migrate
   ```
2. **Cargar datos ficticios de demostración (Usuarios de prueba, servicios y 90 ejercicios kinésicos):**
   ```powershell
   # En Windows PowerShell:
   $env:DEMO_USER_PASSWORD="Password123!"; npm run seed

   # En Linux / macOS Bash:
   DEMO_USER_PASSWORD="Password123!" npm run seed
   ```
3. **Crear usuario Administrador inicial dedicado (Opcional):**
   ```powershell
   $env:ADMIN_EMAIL="admin@kinesiologia.com"; $env:ADMIN_PASSWORD="Password123!"; npm run create-admin
   ```

### Iniciar el Backend en Desarrollo
```powershell
npm run dev
```
El servidor quedará escuchando en `http://localhost:3000`.  
Puede verificar la salud del backend accediendo a: `http://localhost:3000/api/docs` (Swagger UI).

---

## 1.5 Configuración y Puesta en Marcha del Frontend

Abra una segunda ventana de terminal para el cliente móvil:

### Paso 1: Instalación de Dependencias
```powershell
cd frontend
npm install
```

### Paso 2: Configuración de la URL de la API
El cliente frontend se comunica mediante [frontend/src/api/client.ts](file:///c:/Users/leone/OneDrive/Desktop/kinesiologia/frontend/src/api/client.ts).  
Por defecto, la constante `API_BASE_URL` se conecta al backend en producción:
- Si desea apuntar a su backend local en la misma computadora (navegador web): use `http://localhost:3000/api/v1`.
- Si prueba en un celular físico con Expo Go en la misma red Wi-Fi: configure la IP local de su computadora (ej: `http://192.168.1.50:3000/api/v1`).
- Para producción en la nube: `https://kinesiologia-backend.onrender.com/api/v1`.

### Paso 3: Iniciar la Aplicación con Expo
```powershell
npm start
```
Se abrirá la consola interactiva de Expo:
- Presione la tecla **`w`** para abrir la aplicación directamente en su navegador web.
- Presione la tecla **`a`** para abrir en un emulador Android (si tiene Android Studio configurado).
- Escanee el **código QR** que aparece en la terminal con la cámara de su celular (iOS) o desde la app **Expo Go** (Android) para ejecutarla directamente en su teléfono físico.

---

## 1.6 Verificación de Calidad y Pruebas Automatizadas

El proyecto cuenta con suites automatizadas de validación estricta para garantizar estabilidad:

1. **Chequeo de Tipos Estricto en Frontend (TypeScript):**
   ```powershell
   cd frontend
   npm run type-check
   ```
   *(Verifica que no existan errores de tipado, interfaces inconsistentes ni accesos a propiedades inexistentes)*.

2. **Diagnóstico de Salud de Expo:**
   ```powershell
   cd frontend
   npm run doctor
   ```
   *(Verifica la compatibilidad de versiones de todas las librerías nativas con el SDK de Expo)*.

3. **Suite Completa de Pruebas Unitarias y de Seguridad del Backend:**
   ```powershell
   cd backend
   npm test
   ```
   *(Ejecuta las **82 pruebas automáticas**: bloqueo de GET, roles RBAC, cifrado de contraseñas, inmutabilidad de historias clínicas, prevención de account takeover en OAuth, y arqueo de caja)*.

---

# 2. Manual Operativo de Usuario

## 2.1 Matriz de Roles y Control de Acceso (RBAC)

KinesioGestión opera con 4 perfiles claramente diferenciados:

| Perfil | Responsabilidad Principal | Acceso Clínico | Acceso Financiero |
| :--- | :--- | :---: | :---: |
| **Administrador (`admin`)** | Supervisión global, tarifas, roles y auditoría. | ✅ Completo | ✅ Completo |
| **Kinesiólogo (`kinesiologist`)** | Atención en box, historias clínicas y rutinas. | ✅ Completo | 🚫 Denegado (`403`) |
| **Recepcionista (`receptionist`)** | Recepción, turnos, altas de pacientes y caja. | 🚫 Denegado (`403`) | ✅ Completo |
| **Paciente (`patient`)** | Portal personal de ejercicios en casa y turnos. | 👁️ Solo sus rutinas | 🚫 Denegado (`403`) |

---

## 2.2 Perfil: Administrador (Admin)

El Administrador tiene el control integral de la clínica:
1. **Dashboard Ejecutivo:** Consulta en tiempo real los turnos del día, distribución de asistencia y la tarjeta de **Caja y Recaudación Diaria** (total cobrado, cantidad de transacciones e ingresos por medio de pago).
2. **Gestión de Personal y Cuentas:** Modifica roles de usuarios, activa/desactiva cuentas y supervisa los registros de auditoría (`audit_logs`).
3. **Catálogo de Servicios y Tarifas:** Define los precios oficiales de las prestaciones (Sesión Traumatológica, RPG, Kinesiología Deportiva, etc.).
4. **Agenda Global:** Asigna turnos para cualquier profesional sin riesgo de superposiciones horarias.

---

## 2.3 Perfil: Kinesiólogo (Profesional Clínico)

Diseñado para optimizar la atención en el consultorio/box:
1. **Mi Agenda Diaria:** Visualiza exclusivamente su cronograma de pacientes citados. Puede actualizar el estado con un toque: **"Asistió"**, **"Ausente"** o **"Cancelado"**.
2. **Ficha e Historia Clínica:**
   - Registra motivo de consulta, antecedentes personales/quirúrgicos y diagnósticos kinésicos.
   - Evalúa el dolor mediante la **Escala EVA (0 a 10)**.
   - Redacta evoluciones cronológicas. Si necesita rectificar una evolución anterior, el sistema le exigirá registrar obligatoriamente el **motivo de la modificación** para garantizar inmutabilidad médica.
3. **Prescripción de Rutinas y Seguimiento:**
   - Accede a un catálogo de más de 90 ejercicios kinésicos (fortalecimiento, movilidad, elongación, propiocepción).
   - Crea rutinas personalizadas (series, repeticiones, carga y descansos).
   - Versionado clínico: al ajustar una rutina, se genera automáticamente una nueva versión archivando la anterior.
   - Registra la sesión en consultorio: anota ejercicios ejecutados y tolerancia del paciente.
4. **Exportación a PDF:** Genera en un clic el informe médico formal con membrete del centro para entregar al paciente, obras sociales o médicos derivantes.

---

## 2.4 Perfil: Recepcionista (Personal Administrativo)

Optimizado para el escritorio de entrada y sala de espera:
1. **Recepción y Sala de Espera:** Marca la llegada del paciente para que el profesional vea en su pantalla que la persona ya está en espera.
2. **Padrón de Pacientes:** Registra nuevos pacientes validando DNI, teléfono, dirección y cobertura médica.
3. **Caja y Cobranzas:**
   - Registra pagos mediante Efectivo, Débito, Crédito, Transferencia Bancaria o Cobertura Mutual.
   - Vende y administra **Paquetes de Sesiones** (ej. "Pack 10 sesiones"). El sistema descuenta el saldo automáticamente con cada asistencia.
   - Realiza el **Arqueo de Caja del Día** para cuadrar los ingresos de la jornada.
4. **Privacidad Médica:** No tiene acceso a historias clínicas ni diagnósticos (bloqueo automático por interfaz y backend).

---

## 2.5 Perfil: Paciente (Portal de Autogestión y Home Care)

Acompaña la rehabilitación del paciente fuera del consultorio:
1. **Mis Rutinas para el Hogar:** Visualiza los ejercicios indicados por su profesional con instrucciones claras.
2. **Registro de Cumplimiento:** Al completar un ejercicio en su casa, indica las series realizadas, su nivel de dolor (escala 0-10) y comentarios para el kinesiólogo.
3. **Historial:** Consulta sus asistencias y sesiones realizadas.

---

## 2.6 Credenciales de Demostración

| Perfil | Correo Electrónico | Contraseña | Enfoque de Prueba |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@kinesiologia.com` | `Password123!` | Métricas financieras, caja, usuarios y control total. |
| **Kinesiólogo** | `carlos.kine@kinesiologia.com` | `Password123!` | Atención en box, historias clínicas, rutinas y PDF. |
| **Recepcionista** | `mariana.recep@kinesiologia.com` | `Password123!` | Sala de espera, turnos, cobros y arqueo de caja. |
| **Paciente** | `esteban.perez@ejemplo.com` | `Password123!` | Portal de ejercicios en casa y seguimiento. |

---

# 3. Documentación Técnica de la API REST

## 3.1 Reglas Arquitectónicas y Estándares HTTP

1. **Regla Estricta: Cero Uso de HTTP GET en Endpoints de Negocio:**
   - Para mitigar fuga de identificadores clínicos o datos de pacientes en URLs, historiales de navegación y logs de proxies, **todas las consultas y búsquedas se realizan vía `POST`** con identificadores y filtros en el cuerpo JSON (ej. `POST /api/v1/patients/search`).
   - Cualquier solicitud `GET` a rutas de negocio es interceptada por un middleware global y rechazada con **`405 Method Not Allowed`**.
2. **Autorización en el Servidor (Fail-Closed):**
   - Nunca se confía en los roles enviados por el cliente. En cada petición, el backend verifica la validez del token JWT y consulta el rol real en la base de datos.
3. **SQL Parametrizado:** Todas las consultas a la base de datos se ejecutan con sentencias preparadas (placeholders `?`) mediante `mysql2/promise`.

---

## 3.2 Esquema Global de Respuestas y Errores

### Respuesta Exitosa Estándar (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Operación ejecutada correctamente",
  "data": {
    "...": "..."
  }
}
```

### Respuesta de Error Estándar (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos proporcionados no cumplen con las validaciones requeridas",
    "details": [
      {
        "field": "email",
        "message": "Debe ser un correo electrónico válido"
      }
    ]
  }
}
```

### Códigos de Error Principales
- `400 BAD_REQUEST`: Formato JSON inválido o parámetros incompatibles.
- `401 UNAUTHORIZED`: Token ausente, firma inválida o expirada.
- `403 FORBIDDEN`: Usuario autenticado pero sin permisos para el recurso (ej. Recepcionista en historia clínica).
- `404 NOT_FOUND`: Recurso no encontrado.
- `405 METHOD_NOT_ALLOWED`: Intento de consulta por método GET en endpoint de negocio.
- `409 CONFLICT`: Conflicto de unicidad (ej. correo duplicado, solapamiento de turno o recibo existente).
- `422 UNPROCESSABLE_ENTITY`: Fallo en esquema de validación Zod.
- `429 TOO_MANY_REQUESTS`: Límite de tasa de solicitudes excedido (Rate limiting).

---

## 3.3 Autenticación y Seguridad JWT

Todos los endpoints protegidos requieren el encabezado:
```http
Authorization: Bearer <access_token>
```
- **Access Token:** Vigencia de **15 minutos**, firmado con clave criptográfica dedicada (`JWT_ACCESS_SECRET`).
- **Refresh Token:** Vigencia de **7 días**, firmado con `JWT_REFRESH_SECRET`, con identificador único (`jti`) persistido en la tabla `refresh_tokens`. Cuenta con rotación atómica e invalidación en cierre de sesión.

---

## 3.4 Endpoints: Autenticación y Sesión (`/api/v1/auth`)

### `POST /auth/login`
Inicia sesión con credenciales tradicionales.
- **Permisos:** Público.
- **Cuerpo (Request Body):**
  ```json
  {
    "email": "carlos.kine@kinesiologia.com",
    "password": "Password123!"
  }
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": 2,
        "name": "Carlos",
        "lastName": "Kinesio",
        "email": "carlos.kine@kinesiologia.com",
        "role": "kinesiologist"
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

---

### `POST /auth/refresh`
Renueva el par de tokens de forma atómica.
- **Permisos:** Público (requiere refresh token válido).
- **Cuerpo:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
- **Respuesta (200 OK):** Nuevo par `accessToken` y `refreshToken`.

---

### `POST /auth/logout`
Cierra la sesión revocando el refresh token en la base de datos.
- **Permisos:** Requiere autenticación.
- **Cuerpo:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

---

### `POST /auth/forgot-password`
Solicita código de recuperación de contraseña de 6 dígitos.
- **Permisos:** Público (Protegido por rate limiter estricto).
- **Cuerpo:**
  ```json
  {
    "email": "leonelsuarezmiranda@gmail.com"
  }
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "message": "Instrucciones enviadas si el correo existe",
    "data": {
      "sent": true,
      "emailSent": true
    }
  }
  ```

---

### `POST /auth/reset-password`
Restablece la contraseña utilizando el código de 6 dígitos recibido por correo.
- **Permisos:** Público.
- **Cuerpo:**
  ```json
  {
    "token": "426622",
    "newPassword": "NuevaPassword123!"
  }
  ```
- **Respuesta (200 OK):** Mensaje de contraseña restablecida correctamente. Invalida el código de un solo uso y revoca sesiones previas.

---

### `POST /auth/social`
Autenticación e inicio de sesión social mediante proveedores OAuth 2.0.
- **Permisos:** Público.
- **Cuerpo:**
  ```json
  {
    "provider": "google",
    "code": "4/0AeanS0...",
    "redirectUri": "https://kinesiologia-backend.onrender.com/api/v1/auth/oauth/callback"
  }
  ```

---

## 3.5 Endpoints: Padrón de Pacientes (`/api/v1/patients`)

### `POST /patients/search`
Búsqueda y filtrado de pacientes.
- **Permisos:** Administrador, Kinesiólogo, Recepcionista.
- **Cuerpo:**
  ```json
  {
    "query": "Pérez",
    "isActive": true,
    "limit": 20,
    "offset": 0
  }
  ```
- **Respuesta (200 OK):** Lista de pacientes coincidentes con datos de contacto y kinesiólogo asignado.

---

### `POST /patients/detail`
Consulta de expediente administrativo de un paciente.
- **Permisos:** Administrador, Kinesiólogo, Recepcionista.
- **Cuerpo:**
  ```json
  {
    "patientId": 1
  }
  ```

---

### `POST /patients/create`
Alta de nuevo paciente en el sistema.
- **Permisos:** Administrador, Recepcionista.
- **Cuerpo:**
  ```json
  {
    "firstName": "Luciana",
    "lastName": "Martínez",
    "dni": "40123987",
    "birthDate": "1998-04-12",
    "phone": "+5491133221100",
    "email": "luciana.martinez@ejemplo.com",
    "address": "Av. Corrientes 1500, CABA",
    "assignedKinesiologistId": 2
  }
  ```

---

## 3.6 Endpoints: Agenda y Turnos (`/api/v1/appointments`)

### `POST /appointments/search`
Consulta de turnos agendados con filtros multicriterio.
- **Permisos:** Administrador, Kinesiólogo, Recepcionista, Paciente (restringido a sus turnos).
- **Cuerpo:**
  ```json
  {
    "kinesiologistId": 2,
    "date": "2026-10-30",
    "status": "pending"
  }
  ```

---

### `POST /appointments/create`
Agendamiento de nuevo turno médico. Valida colisiones horarias.
- **Permisos:** Administrador, Recepcionista.
- **Cuerpo:**
  ```json
  {
    "patientId": 1,
    "kinesiologistId": 2,
    "serviceId": 1,
    "scheduledAt": "2026-10-30T14:30:00Z"
  }
  ```
- **Respuesta de Error si hay colisión (409 Conflict):**
  ```json
  {
    "success": false,
    "error": {
      "code": "APPOINTMENT_OVERLAP",
      "message": "El profesional ya cuenta con un turno asignado en el rango horario seleccionado"
    }
  }
  ```

---

### `POST /appointments/update-status`
Actualización del estado de asistencia de un turno.
- **Permisos:** Administrador, Kinesiólogo, Recepcionista.
- **Cuerpo:**
  ```json
  {
    "appointmentId": 105,
    "status": "attended"
  }
  ```
  *(Estados válidos: `pending`, `attended`, `absent`, `cancelled`)*.

---

## 3.7 Endpoints: Historias Clínicas y PDF (`/api/v1/clinical-records`)

> [!CAUTION]
> Este módulo está **estrictamente restringido a Administradores y Kinesiólogos**. Cualquier intento de acceso por parte de Recepcionistas o Pacientes es denegado con código **`403 Forbidden`**.

### `POST /clinical-records/search`
Consulta el historial clínico y antecedentes de un paciente.
- **Cuerpo:**
  ```json
  {
    "patientId": 1
  }
  ```

---

### `POST /clinical-records/create`
Registra una nueva evaluación médica o nota clínica de evolución.
- **Cuerpo:**
  ```json
  {
    "patientId": 1,
    "chiefComplaint": "Dolor punzante en hombro derecho post-esfuerzo",
    "painScaleEva": 7,
    "physicalExam": "Limitación en abducción a 80°, prueba de Neer positiva",
    "diagnosis": "Tendinopatía del manguito rotador (supraespinoso)",
    "planNotes": "Crioterapia, ejercicios de movilidad pasiva y fortalecimiento isométrico"
  }
  ```

---

### `POST /clinical-records/update`
Actualización o rectificación de un registro clínico existente.
- **Regla Médica Obligatoria:** Exige registrar el campo `modificationReason`.
- **Cuerpo:**
  ```json
  {
    "recordId": 45,
    "painScaleEva": 5,
    "planNotes": "Se progresa a ejercicios isotónicos con banda elástica suave",
    "modificationReason": "Reevaluación tras 3 sesiones: descenso favorable del dolor"
  }
  ```

---

### `POST /clinical-records/export-pdf`
Genera el informe formal médico de la historia clínica en formato PDF estructurado.
- **Cuerpo:**
  ```json
  {
    "patientId": 1
  }
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "fileName": "Historia_Clinica_Esteban_Perez.pdf",
      "mimeType": "application/pdf",
      "base64": "JVBERi0xLjQKJcTl8uXrp/Og0MTgc..."
    }
  }
  ```

---

## 3.8 Endpoints: Tratamientos, Rutinas y Sesiones (`/api/v1/treatments`)

### `POST /treatments/routines/create`
Crea una nueva rutina terapéutica vinculada al plan de tratamiento.
- **Permisos:** Kinesiólogo, Administrador.
- **Cuerpo:**
  ```json
  {
    "treatmentPlanId": 10,
    "name": "Fase 1: Movilidad y Estabilidad Escapular",
    "description": "Rutina para realizar 3 veces por semana en consultorio y hogar",
    "exercises": [
      {
        "exerciseId": 1,
        "sets": 3,
        "repetitions": 12,
        "restSeconds": 45,
        "notes": "Mantener retracción escapular sin arquear la zona lumbar"
      }
    ]
  }
  ```

---

### `POST /treatments/routines/update`
Edita una rutina activa. **Genera automáticamente una nueva versión (V2) archivando la V1** para preservar la historia terapéutica.
- **Permisos:** Kinesiólogo, Administrador.

---

### `POST /treatments/sessions/create`
Registra la sesión clínica realizada en el consultorio.
- **Permisos:** Kinesiólogo, Administrador.
- **Cuerpo:**
  ```json
  {
    "treatmentPlanId": 10,
    "appointmentId": 105,
    "sessionDate": "2026-10-30",
    "clinicalNotes": "Buena respuesta al tratamiento manual, sin dolor residual",
    "exercisesExecuted": [
      {
        "exerciseId": 1,
        "setsCompleted": 3,
        "repsCompleted": 12,
        "loadKg": 5.0,
        "painScaleEva": 2,
        "tolerance": "good"
      }
    ]
  }
  ```

---

## 3.9 Endpoints: Portal del Paciente Home Care (`/api/v1/patient-portal`)

### `POST /patient-portal/routines`
Consulta las rutinas asignadas al paciente autenticado.
- **Permisos:** Paciente (autenticado).
- **Cuerpo:** `{}`

---

### `POST /patient-portal/log-exercise`
Registra el cumplimiento autónomo de un ejercicio en el hogar.
- **Permisos:** Paciente.
- **Cuerpo:**
  ```json
  {
    "routineExerciseId": 12,
    "setsCompleted": 3,
    "repsCompleted": 10,
    "painScaleEva": 3,
    "patientNotes": "Pude completar las 3 series, sentí pequeña fatiga en la última"
  }
  ```

---

## 3.10 Endpoints: Catálogo de Ejercicios (`/api/v1/exercises`)

### `POST /exercises/search`
Consulta y búsqueda en el catálogo clínico de más de 90 ejercicios.
- **Permisos:** Todos los usuarios autenticados.
- **Cuerpo:**
  ```json
  {
    "category": "Fortalecimiento Lumbo-Pélvico",
    "query": "Puente"
  }
  ```

---

### `POST /exercises/create`
Alta de nuevo ejercicio terapéutico en el catálogo.
- **Permisos:** Administrador.
- **Cuerpo:**
  ```json
  {
    "name": "Plancha frontal isométrica",
    "category": "Core y Estabilidad",
    "description": "Activación isométrica del recto abdominal y transverso",
    "instructions": "Apoyar antebrazos y puntas de pie manteniendo espalda neutra",
    "defaultSets": 3,
    "defaultRepetitions": 30,
    "mediaUrl": "https://example.com/exercises/plancha.mp4"
  }
  ```

---

## 3.11 Endpoints: Cobros, Paquetes y Caja Diaria (`/api/v1/payments`)

> [!NOTE]
> Acceso exclusivo para **Administrador y Recepcionista**. Los Kinesiólogos tienen denegado este módulo (`403 Forbidden`).

### `POST /payments/create`
Registra un cobro individual o compra de paquete. Emite recibo con número único.
- **Cuerpo:**
  ```json
  {
    "patientId": 1,
    "serviceId": 1,
    "amount": 12000.00,
    "paymentMethod": "transfer",
    "receiptNumber": "REC-2026-0089",
    "notes": "Comprobante de transferencia bancaria enviado por WhatsApp"
  }
  ```

---

### `POST /payments/caja-summary`
Genera el arqueo de caja de la jornada actual para control financiero.
- **Cuerpo:**
  ```json
  {
    "date": "2026-10-30"
  }
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "date": "2026-10-30",
      "totalCollected": 96000.00,
      "transactionCount": 8,
      "breakdownByMethod": {
        "cash": 36000.00,
        "transfer": 42000.00,
        "debit": 18000.00,
        "credit": 0.00,
        "insurance": 0.00
      }
    }
  }
  ```

---

### `POST /payments/packages/create`
Crea un paquete prepago de sesiones para un paciente.
- **Cuerpo:**
  ```json
  {
    "patientId": 1,
    "serviceId": 1,
    "totalSessions": 10,
    "pricePaid": 100000.00
  }
  ```

---

### `POST /payments/packages/consume`
Descuenta una sesión del paquete tras la asistencia del paciente.
- **Cuerpo:**
  ```json
  {
    "packageId": 5,
    "appointmentId": 105
  }
  ```

---

## 3.12 Endpoints: Servicios y Tarifario (`/api/v1/services`)

### `POST /services/search`
Consulta el catálogo de prestaciones del consultorio con sus precios vigentes.
- **Permisos:** Todos los usuarios autenticados.
- **Cuerpo:**
  ```json
  {
    "isActive": true
  }
  ```

---

### `POST /services/create`
Alta o modificación de aranceles de servicios clínicos.
- **Permisos:** Administrador.
- **Cuerpo:**
  ```json
  {
    "name": "Drenaje Linfático Manual",
    "description": "Terapia descongestiva para edemas y postquirúrgicos",
    "durationMinutes": 60,
    "defaultPrice": 16000.00
  }
  ```

---

## 3.13 Endpoints: Dashboard Modular (`/api/v1/dashboard`)

### `POST /dashboard/summary`
Retorna métricas operativas consolidadas adaptadas al rol del usuario autenticado.
- **Permisos:** Todos los roles autenticados.
- **Cuerpo:** `{}`
- **Respuesta (200 OK para Administrador / Recepción):**
  ```json
  {
    "success": true,
    "data": {
      "todayAppointments": {
        "total": 14,
        "attended": 6,
        "pending": 7,
        "absent": 1
      },
      "activePatientsCount": 85,
      "financialSummary": {
        "todayTotal": 72000.00,
        "todayCount": 6
      }
    }
  }
  ```
- **Respuesta (200 OK para Kinesiólogo / Paciente):**  
  El objeto `financialSummary` es omitido por el backend, resguardando la confidencialidad de la caja.
