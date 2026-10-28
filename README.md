# Sistema de Gestión para Consultorio de Kinesiología

Sistema integral (Frontend Móvil + Backend REST + Base de Datos Relacional) diseñado específicamente para la administración de pacientes, turnos, fichas clínicas, tratamientos, ejercicios y cobros en consultorios kinesiológicos.

---

## 1. Arquitectura General

```
                     ┌──────────────────────────────────────────────┐
                     │    Frontend Móvil (React Native + Expo)      │
                     │  - React Navigation (Público / Privado)      │
                     │  - Context API (Auth + Theme claro/oscuro)   │
                     │  - Expo SecureStore (Tokens JWT persistidos) │
                     │  - React Hook Form + Zod                     │
                     │  - Axios con auto-refresh de tokens          │
                     └──────────────────────┬───────────────────────┘
                                            │ HTTP (POST / PUT / PATCH / DELETE)
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │         Backend (Node.js + Express)          │
                     │  - ES Modules ("type": "module")             │
                     │  - Capas: Routes -> Controllers -> Services  │
                     │           -> Repositories -> Schemas         │
                     │  - Helmet + CORS + Rate Limiting             │
                     │  - JWT (Access 15m / Refresh 7d)             │
                     │  - Regla estricta: Cero GET de negocio       │
                     │  - RBAC: Admin, Kinesiólogo, Recepcionista   │
                     └──────────────────────┬───────────────────────┘
                                            │ mysql2/promise (TLS/SSL)
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │       MySQL / TiDB Cloud (Serverless)        │
                     │  - 21 tablas normalizadas en 3FN             │
                     │  - Integridad referencial e índices          │
                     │  - Auditoría de turnos e historias clínicas  │
                     └──────────────────────────────────────────────┘
```

---

## 2. Requisitos Previos

- **Node.js:** v20.x o v22.x (comprobado en Node v22.15.0).
- **npm:** v10.x o superior.
- **Expo CLI:** disponible vía `npx expo`.
- **Base de Datos:** MySQL 8.0 local o instancia en la nube (**TiDB Cloud Serverless** con SSL).

---

## 3. Instalación y Puesta en Marcha

### 3.1. Clonar el repositorio
```powershell
git clone https://github.com/SuarezLeonel/kinesiologia.git
cd kinesiologia
```

### 3.2. Configuración y Ejecución del Backend

1. Ingresar a la carpeta `backend/` e instalar dependencias:
   ```powershell
   cd backend
   npm install
   ```

2. Configurar el archivo `.env`:
   Copiar `.env.example` a `.env` y completar los datos de conexión (actualmente configurado con TiDB Cloud):
   ```env
   PORT=3000
   NODE_ENV=development
   API_PREFIX=/api/v1
   CORS_ORIGIN=http://localhost:8081,http://localhost:19006

   # MySQL / TiDB Cloud
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=tu_usuario
   DB_PASSWORD=tu_password_aqui
   DB_NAME=kinesiologia_db
   DB_SSL=false

   # Claves JWT (mínimo 32 caracteres)
   JWT_ACCESS_SECRET=clave_secreta_larga_para_access_tokens_minimo_32_caracteres
   JWT_REFRESH_SECRET=clave_secreta_larga_para_refresh_tokens_minimo_32_caracteres
   ```

3. Aplicar migraciones y datos iniciales (desde la carpeta `backend/`):
   - **Migraciones versionadas**: `npm run migrate`
   - **Datos de prueba (opcional)**: `$env:DEMO_USER_PASSWORD="Password123!"; npm run seed`
   - **Crear administrador inicial**: `$env:ADMIN_EMAIL="admin@kinesiologia.com"; $env:ADMIN_PASSWORD="TuPasswordSeguro123!"; npm run create-admin`

4. Iniciar el servidor:
   ```powershell
   npm run dev
   ```
   - Servidor API: `http://localhost:3000`
   - Documentación OpenAPI/Swagger: `http://localhost:3000/api/docs`

5. Ejecutar la suite de pruebas del backend:
   ```powershell
   npm test
   ```

---

### 3.3. Configuración y Ejecución del Frontend

1. Ingresar a la carpeta `frontend/` e instalar dependencias:
   ```powershell
   cd frontend
   npm install
   ```

2. Ejecutar la aplicación con Expo:
   ```powershell
   npm start
   ```
   - Presionar `w` para abrir en el navegador web.
   - Presionar `a` para emulador Android.
   - Escanear el código QR con la app **Expo Go** en tu celular físico.

3. Compilar APK Android:
   Ver las instrucciones completas en [docs/ANDROID_BUILD_GUIDE.md](docs/ANDROID_BUILD_GUIDE.md).

---

## 4. Roles del Sistema y Credenciales de Demostración

| Rol | Correo de prueba | Contraseña | Permisos Principales |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@kinesiologia.com` | `Password123!` | Control total, usuarios, métricas financieras de recaudación, turnos, historias clínicas. |
| **Kinesiólogo** | `carlos.kine@kinesiologia.com` | `Password123!` | Agenda asignada, pacientes, redacción de historias clínicas y ejercicios. Sin acceso a cobros (`403`). |
| **Recepcionista** | `mariana.recep@kinesiologia.com` | `Password123!` | Gestión de turnos, alta de pacientes y cobros de caja. **Bloqueada en historias clínicas (`403`)**. |

---

## 5. Reglas de Seguridad y Cumplimiento

- **Regla HTTP Estricta:** Cero uso de `GET` en endpoints de negocio. Las búsquedas y filtros se ejecutan exclusivamente mediante solicitudes `POST` con parámetros en el cuerpo (ej. `POST /api/v1/patients/search`). Cualquier intento de consulta `GET` es bloqueado por el servidor con `405 Method Not Allowed`.
- **Cero uso de `alert()`:** Todas las confirmaciones y errores se informan a través de componentes en pantalla y banners accesibles (`FeedbackStates.tsx`).
- **Autenticación Robusta:** Access Tokens firmados de 15 minutos y Refresh Tokens de 7 días con rotación automática e invalidación en base de datos.
- **SQL Parametrizado:** Mitigación total de inyecciones SQL mediante placeholders `?`.

---

## 6. Documentación Detallada

- [Manual de Usuario por Rol](docs/USER_MANUAL.md)
- [Arquitectura de Base de Datos y Formas Normales (1FN, 2FN, 3FN)](docs/DATABASE_ARCHITECTURE.md)
- [Operaciones de Base de Datos y Copias de Seguridad](docs/DATABASE_OPERATIONS.md)
- [Guía de Compilación de APK Android (EAS Build)](docs/ANDROID_BUILD_GUIDE.md)
- [Requisitos Funcionales y Técnicos](docs/REQUISITOS.md)
- [Plan de Trabajo](docs/PLAN_DE_TRABAJO.md)
