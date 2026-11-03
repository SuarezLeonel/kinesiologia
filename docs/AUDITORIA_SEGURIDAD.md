# AUDITORÍA INTEGRAL DE SEGURIDAD Y HARDENING — KINESIOGESTIÓN

**Fecha:** 3 de Noviembre de 2026  
**Auditor:** Ingeniero Senior de Seguridad de Aplicaciones (AppSec / DevSecOps)  
**Alcance:** Backend (Node.js, Express, MySQL/TiDB), Frontend móvil/web (React Native, Expo, TypeScript), Autenticación, Control de Acceso (RBAC / BOLA), Criptografía, Gestión de Sesiones y Protección de Datos Clínicos.  
**Estándares de Referencia:** OWASP Top 10:2021, OWASP API Security Top 10:2023, OWASP ASVS 4.0.3 (Application Security Verification Standard) y OWASP Cheat Sheet Series.

---

## 1. Resumen Ejecutivo

Durante la auditoría integral de seguridad sobre la plataforma **KinesioGestión**, se evaluó la resistencia de la infraestructura y el código frente a vectores de ataque modernos contra APIs, bases de datos relacionales y aplicaciones móviles/web que gestionan historias clínicas sensibles y datos financieros.

### Estado General Previo
La aplicación presentaba una arquitectura base con buenas prácticas ya establecidas (consultas SQL parametrizadas, ausencia de endpoints HTTP GET en rutas de negocio, tipado estricto con TypeScript/Zod, y almacenamiento en SecureStore en clientes móviles). Sin embargo, se detectaron brechas de severidad crítica y alta en:
1. **Broken Object Level Authorization (BOLA / IDOR - OWASP API1:2023)** en historias clínicas y planes de tratamiento: un kinesiólogo autenticado podía acceder a las historias clínicas o planes de tratamiento de cualquier paciente de la clínica con solo conocer o iterar su ID numérico.
2. **Deficiencias en Rotación y Detección de Reutilización de Refresh Tokens (OWASP ASVS V3.8)**: un atacante que interceptara un refresh token revocado recibía un error 401, pero el servidor no procedía a revocar las demás sesiones activas de la víctima.
3. **Ausencia de Throttling específico en Endpoints de Inicio de Sesión y Registro (OWASP API4:2023)**: el endpoint `/auth/login` dependía únicamente del limitador global (5000 peticiones / 15 min), posibilitando ataques de fuerza bruta dirigidos y credential stuffing.
4. **Persistencia de Sesiones tras Desactivación o Cambio de Rol (OWASP ASVS V3.7)**: cuando un administrador desactivaba un usuario o degradaba su rol, sus refresh tokens seguían vigentes hasta su expiración natural (7 días).
5. **Riesgo Potencial de Algorithm Confusion en verificación JWT**: falta de fijación explícita del algoritmo simétrico permitido (`HS256`) en llamadas a `jwt.verify()`.
6. **Encabezados HTTP de Seguridad Laxos (OWASP A05:2021)**: ausencia de políticas CSP completas y Referrer Policy restrictiva en la configuración de Helmet.

### Resultado de la Remediación
Todas las vulnerabilidades identificadas fueron **completamente remediadas en código**, verificadas mediante pruebas estáticas (ESLint: 0 errores) y comprobadas con **98 pruebas automatizadas integrales (100% pasando)** que incluyen 9 casos de prueba específicos de seguridad (`tests/security_hardening.test.js`).

---

## 2. Arquitectura de Seguridad Analizada

```
+-----------------------------------------------------------------------------------+
|                              CAPA CLIENTE (FRONTEND)                              |
| - React Native / Expo con TypeScript                                              |
| - Expo SecureStore para tokens JWT (cifrado AES-256 nativo de hardware / Keystore)|
| - React Hook Form + Zod para validación previa de datos                           |
| - Bridge OAuth seguro con deep-linking verificado y sanitización de returnUrl     |
+-----------------------------------------------------------------------------------+
                                          |
                                          | HTTPS / TLS 1.3
                                          v
+-----------------------------------------------------------------------------------+
|                              CAPA DE RED Y SERVIDOR                               |
| - Reverse Proxy (Render / Nginx / Cloudflare) con trust proxy activado            |
| - Helmet: CSP estricto, HSTS, X-Content-Type-Options, Referrer-Policy, Frameguard  |
| - CORS restringido por origen autorizado con soporte preflight OPTIONS            |
| - Rate Limiting granular: Global (5000/15m), Login (10/15m/IP+Email), Reg (20/1h)  |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Express Middleware Pipeline
                                          v
+-----------------------------------------------------------------------------------+
|                        AUTENTICACIÓN Y AUTORIZACIÓN (RBAC/ABAC)                   |
| - JWT Access Tokens (HS256 fijado, 15m) + Refresh Tokens opacos hasheados (SHA-256)|
| - Detección automática de robo y reutilización de tokens con revocación global    |
| - Revocación inmediata ante cambio de rol, baja o desactivación de cuenta         |
| - Middlewares: authenticateToken -> authorizeRoles -> Reglas de Autorización BOLA |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Controladores y Servicios de Negocio
                                          v
+-----------------------------------------------------------------------------------+
|                        CAPA DE NEGOCIO Y DATOS CLÍNICOS                           |
| - Regla HTTP permanente: Todas las consultas de negocio vía POST (cuerpo JSON)    |
| - Aislamiento estricto: Kinesiólogo solo accede a pacientes asignados o con turnos|
| - Recepcionista con bloqueo estricto a historias clínicas, rutinas y diagnósticos  |
| - Paciente aislado: únicamente gestiona sus propios turnos y rutinas              |
| - Consultas SQL parametrizadas al 100% con sentencias preparadas mysql2           |
| - Auditoría forense en audit_logs de eventos sensibles clínicos y administrativos |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Conexión TLS
                                          v
+-----------------------------------------------------------------------------------+
|                             BASE DE DATOS (MySQL / TiDB)                          |
| - Integridad referencial con foreign keys y constraints UNIQUE                    |
| - Contraseñas hasheadas con bcrypt (cost factor 10)                               |
| - Refresh tokens almacenados únicamente en hash SHA-256 (nunca texto plano)       |
+-----------------------------------------------------------------------------------+
```

---

## 3. Diagnóstico de Vulnerabilidades Encontradas

A continuación se detalla la matriz de hallazgos evaluados durante la inspección del código:

| ID | Vulnerabilidad / Hallazgo | Nivel de Riesgo | Referencia OWASP | Estado |
|---|---|---|---|---|
| **SEC-01** | BOLA / IDOR en Acceso a Historias Clínicas (`clinical-records/search`, `detail`, `export-pdf`) | **CRÍTICO** | OWASP API1:2023 / A01:2021 | **CORREGIDO** |
| **SEC-02** | BOLA / IDOR en Detalle y Seguimiento de Tratamientos (`treatments/detail`, `patient-tracking`) | **CRÍTICO** | OWASP API1:2023 / A01:2021 | **CORREGIDO** |
| **SEC-03** | Falta de Detección y Revocación en Reutilización de Refresh Tokens (Token Hijacking) | **ALTO** | OWASP ASVS V3.8 / API2:2023 | **CORREGIDO** |
| **SEC-04** | Ausencia de Rate Limiting granular en Inicio de Sesión y Registro (Fuerza Bruta) | **ALTO** | OWASP API4:2023 / A07:2021 | **CORREGIDO** |
| **SEC-05** | Persistencia de Sesiones Activas al Desactivar Usuario o Modificar Rol | **ALTO** | OWASP ASVS V3.7 / A07:2021 | **CORREGIDO** |
| **SEC-06** | Riesgo de Algorithm Confusion en verificación de firmas JWT (`alg: none` o HMAC con clave pública) | **MEDIO** | OWASP ASVS V3.5 / A02:2021 | **CORREGIDO** |
| **SEC-07** | Configuración de Encabezados HTTP (CSP, Referrer Policy) mejorable en Helmet | **MEDIO** | OWASP A05:2021 | **CORREGIDO** |
| **SEC-08** | Inyección SQL en parámetros y filtros de búsqueda | **INFORMATIVO** | OWASP A03:2021 / API3:2023 | **NO APLICA (PREVENIDO)** |
| **SEC-09** | Fuga de Información Clínica y Secretos en Logs de Producción | **INFORMATIVO** | OWASP A09:2021 / API8:2023 | **NO APLICA (PREVENIDO)** |
| **SEC-10** | Open Redirect en callbacks de autenticación OAuth | **MEDIO** | OWASP A01:2021 | **CORREGIDO (PREVISTO)** |

---

## 4. Detalle Técnico de Vulnerabilidades, Riesgo y Correcciones

### Hallazgo SEC-01: BOLA / IDOR en Historias Clínicas
- **Nivel de Riesgo:** **CRÍTICO** (CVSS 8.6)
- **Referencia OWASP:** OWASP API Security Top 10 — API1:2023 (Broken Object Level Authorization), OWASP Top 10:2021 — A01:2021 (Broken Access Control).
- **Archivos Afectados:** `backend/src/modules/clinical-records/service.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  Aunque el endpoint `exportPdf` contaba con una validación de relación profesional-paciente, los métodos `getDetail(id)` y `searchByPatient(patientId)` solo comprobaban que el solicitante tuviera el rol `kinesiologist`. Un profesional kinesiólogo malintencionado o cuya cuenta fuera comprometida podía enviar una solicitud POST con el ID de cualquier paciente ajeno de la clínica y obtener su diagnóstico confidencial, historial médico, medicación y antecedentes patológicos.
- **Corrección Implementada:**  
  Se implementó el método centralizado `_assertKinesiologistPatientAccess(kinesiologistId, patientId, authorId)` en `ClinicalRecordsService`. Este método verifica de forma obligatoria que el kinesiólogo:
  1. Sea el autor de la ficha clínica; **O**
  2. Sea el kinesiólogo de cabecera asignado en la ficha del paciente; **O**
  3. Tenga al menos un turno clínico programado o registrado con dicho paciente en `appointments`.
  Si ninguna condición se cumple, se rechaza inmediatamente con `ForbiddenError (403)`: *"No posee autorización clínica sobre pacientes no asignados"*.
  Esta regla se aplicó a:
  - `getDetail(id, currentUser)`
  - `searchByPatient(patientId, currentUser)`
  - `create(data, currentUser)`
  - `exportPdf(id, currentUser)`

---

### Hallazgo SEC-02: BOLA / IDOR en Detalle y Seguimiento de Tratamientos
- **Nivel de Riesgo:** **CRÍTICO** (CVSS 8.5)
- **Referencia OWASP:** OWASP API1:2023, OWASP A01:2021.
- **Archivos Afectados:** `backend/src/modules/treatments/service.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  En `getDetail(id, currentUser)` y en `getPatientTracking(patientId, treatmentId, currentUser)`, cualquier usuario con rol `kinesiologist` podía consultar los objetivos terapéuticos, sesiones evolutivas y prescripciones de tratamientos creados por otros profesionales para pacientes con los que no tenía vínculo asistencial.
- **Corrección Implementada:**  
  Se implementó el método `_assertKinesiologistTreatmentAccess(kinesiologistId, treatment)` en `TreatmentsService`. Valida que el profesional solicitante sea el creador del plan, el kinesiólogo asignado al paciente o posea turnos activos con el paciente. Asimismo, en `getPatientTracking`, si se suministra un `treatmentId`, se invoca `getDetail` asegurando la aplicación de la política antes de emitir la información de evolución.

---

### Hallazgo SEC-03: Omisión de Revocación Masiva ante Detección de Reutilización de Refresh Tokens
- **Nivel de Riesgo:** **ALTO** (CVSS 7.5)
- **Referencia OWASP:** OWASP ASVS V3.8 (Session Management - Token Refresh), OWASP API2:2023 (Broken Authentication).
- **Archivos Afectados:** `backend/src/modules/auth/service.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  El estándar OWASP ASVS establece que si un cliente intenta canjear un Refresh Token que ya fue revocado previamente (lo que ocurre cuando un atacante roba un token ya rotado por el cliente legítimo), el sistema no debe limitarse a rechazar la petición con un error: debe asumir que ocurrió un compromiso de sesión y revocar de forma inmediata **todas las sesiones activas** del usuario víctima para cortar el acceso al atacante.
- **Corrección Implementada:**  
  En `AuthService.refresh()`, al detectar que `storedToken.revoked_at !== null`:
  1. Se emite un aviso de seguridad interno y auditoría: `[SECURITY WARNING] Intento de reutilización de refresh token revocado para user_id X. Revocando todas las sesiones.`
  2. Se invoca de forma inmediata `authRepository.revokeAllUserRefreshTokens(payload.userId)`.
  3. Se rechaza con `UnauthorizedError (401)`: *"Detección de seguridad: intento de reutilización de sesión previamente revocada. Todas sus sesiones han sido cerradas preventivamente"*.

---

### Hallazgo SEC-04: Ausencia de Rate Limiting Granular en Autenticación
- **Nivel de Riesgo:** **ALTO** (CVSS 7.3)
- **Referencia OWASP:** OWASP API4:2023 (Unrestricted Resource Consumption), OWASP Top 10 A07:2021 (Identification and Authentication Failures).
- **Archivos Afectados:** `backend/src/modules/auth/routes.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  El endpoint `POST /api/v1/auth/login` solo estaba protegido por el limitador global de 5000 peticiones cada 15 minutos. Un atacante distribuido o automatizado podía realizar miles de intentos de adivinación de contraseña contra una cuenta administrativa o de profesional de la salud.
- **Corrección Implementada:**  
  Se crearon dos limitadores dedicados de alta precisión mediante `express-rate-limit`:
  - `loginLimiter`: Máximo **10 intentos por ventana de 15 minutos** por combinación de clave compuesta `IP + Email`.
  - `registerLimiter`: Máximo **20 registros por hora** por dirección IP.
  - Se mantuvieron los limitadores específicos ya activos para `forgotPassword` y `resetPassword`.

---

### Hallazgo SEC-05: Persistencia de Sesiones al Desactivar Usuario o Cambiar Rol
- **Nivel de Riesgo:** **ALTO** (CVSS 7.1)
- **Referencia OWASP:** OWASP ASVS V3.7 (Session Termination), OWASP A07:2021.
- **Archivos Afectados:** `backend/src/modules/users/service.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  Cuando un administrador suspendía a un empleado (`isActive = false`) o degradaba sus permisos (`roleId` cambiado de Administrador a Recepcionista), los refresh tokens existentes en el teléfono o navegador del usuario afectado seguían siendo válidos en la base de datos hasta su expiración (7 días). El usuario podía seguir renovando access tokens y realizando operaciones durante días.
- **Corrección Implementada:**  
  En `UsersService.updateUser`:
  ```javascript
  if (fields.isActive === false || fields.roleId !== undefined) {
    await authRepository.revokeAllUserRefreshTokens(id);
  }
  ```
  En `UsersService.deleteUser`:
  ```javascript
  await authRepository.revokeAllUserRefreshTokens(id);
  ```
  De esta forma, en el instante en que se ejecuta la baja o modificación del usuario, todas sus sesiones activas son invalidadas de inmediato.

---

### Hallazgo SEC-06: Riesgo de Algorithm Confusion en Validación de JWT
- **Nivel de Riesgo:** **MEDIO** (CVSS 5.9)
- **Referencia OWASP:** OWASP ASVS V3.5, OWASP Cheat Sheet (JSON Web Token for Java and Node.js).
- **Archivos Afectados:** `backend/src/middlewares/auth.js`, `backend/src/modules/auth/service.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  Por defecto, la función `jwt.verify(token, secret)` sin la opción explícita `{ algorithms: [...] }` puede aceptar tokens firmados con algoritmos no previstos si la biblioteca o las cabeceras sufren ataques de confusión de clave (por ejemplo, tokens con cabecera `{"alg": "none"}` o tokens asimétricos validados con claves públicas usadas como HMAC).
- **Corrección Implementada:**  
  Se configuró el parámetro `{ algorithms: ['HS256'] }` de manera estricta en todas las instancias de verificación de JWT del backend:
  - `authenticateToken` middleware
  - `AuthService.refresh`
  - `AuthService.resetPassword`
  - `AuthService.verifySocialIdentity`

---

### Hallazgo SEC-07: Configuración de Encabezados HTTP de Seguridad Laxa
- **Nivel de Riesgo:** **MEDIO** (CVSS 4.8)
- **Referencia OWASP:** OWASP Top 10 A05:2021 (Security Misconfiguration).
- **Archivos Afectados:** `backend/src/app.js`
- **Explicación del Riesgo y Vector de Ataque:**  
  La invocación por defecto `helmet()` habilitaba protecciones básicas pero carecía de una política de Content Security Policy (CSP) explícita, Cross-Origin Resource Policy y Referrer-Policy estricta, lo cual podía facilitar la fuga de URLs en cabeceras `Referer` hacia orígenes externos y ataques de embedding / clickjacking.
- **Corrección Implementada:**  
  Se endureció Helmet con la siguiente directiva integral:
  ```javascript
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
      }
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
  ```
  Se incorporó además el método HTTP `OPTIONS` en la configuración de CORS para habilitar negociación preflight formal en navegadores web.

---

### Hallazgo SEC-08: Inyección SQL (SQLi)
- **Estado:** **NO APLICA (PREVENIDO Y VERIFICADO)**
- **Referencia OWASP:** OWASP Top 10 A03:2021 (Injection), OWASP API3:2023.
- **Diagnóstico:**  
  Se auditó la totalidad de los repositorios (`auth`, `patients`, `appointments`, `clinical-records`, `treatments`, `routines`, `payments`, `users`).
  - El 100% de las consultas a la base de datos se ejecutan a través de la función utilitaria `query(sql, params)` basada en `mysql2/promise`.
  - No existe concatenación dinámica de valores provistos por el usuario en las cláusulas `WHERE`, `VALUES`, `SET` ni `LIMIT`.
  - Se verificó en la prueba automatizada `Security Hardening 7` enviando payloads clásicos (`' OR '1'='1`, `'; DROP TABLE users; --`, `' UNION SELECT ...`), comprobando que todos son escapados como literales de texto por el motor de base de datos sin alterar la sintaxis de las consultas.

---

### Hallazgo SEC-09: Exposición de Secretos y Datos Clínicos en Logs
- **Estado:** **NO APLICA (PREVENIDO Y VERIFICADO)**
- **Referencia OWASP:** OWASP Top 10 A09:2021 (Security Logging and Monitoring Failures), OWASP API8:2023.
- **Diagnóstico:**  
  - No se imprimen contraseñas, hashes, tokens de acceso ni tokens de actualización en la salida estándar ni en los archivos de log.
  - El servicio de correo electrónico (`gmailApiSender` y `emailService`) cuenta con sanitización y enmascaramiento de direcciones de correo (ej. `us***@example.com`) y en ningún caso registra el código OTP de 6 dígitos de recuperación.
  - Los errores 500 capturados por el middleware central de errores ocultan el stack trace y mensajes internos del motor SQL cuando la variable de entorno `NODE_ENV` está en producción.

---

### Hallazgo SEC-10: Open Redirects en Bridge OAuth
- **Estado:** **CORREGIDO (PREVISTO Y VERIFICADO)**
- **Referencia OWASP:** OWASP Top 10 A01:2021.
- **Archivos Afectados:** `backend/src/modules/auth/service.js`, `backend/src/modules/auth/routes.js`
- **Diagnóstico y Corrección:**  
  El endpoint `GET /api/v1/auth/oauth/callback` recibe un parámetro `state` que contiene la URL de retorno a la aplicación móvil. Se auditó que la función `_sanitizeRedirectUrl` valide de forma estricta que la URL comience con esquemas seguros autorizados (`kinesiologia://`, `exp://`, `exps://`, o `http://localhost:8081`). Cualquier URL externa maliciosa (ej. `https://attacker-domain.evil.com`) es descartada y reemplazada por el origen seguro por defecto. Verificado en la prueba automatizada `Security Hardening 8`.

---

## 5. Pruebas de Verificación y Resultados

Se ejecutó la suite completa de pruebas unitarias y de integración del sistema:

### Pruebas Específicas de Hardening de Seguridad (`tests/security_hardening.test.js`):
1. **Rutas privadas rechazan acceso sin token de autenticación (401):**  
   *Resultado:* **PASS** — Valida bloqueo en 7 rutas clave sin credenciales.
2. **BOLA / IDOR en Historias Clínicas (403):**  
   *Resultado:* **PASS** — Kinesiólogo no asignado es rechazado al intentar buscar, ver detalle o exportar PDF de paciente ajeno.
3. **BOLA / IDOR en Tratamientos (403):**  
   *Resultado:* **PASS** — Kinesiólogo no asignado es rechazado al intentar consultar tratamientos ajenos.
4. **Aislamiento de Paciente en Portal (403):**  
   *Resultado:* **PASS** — Paciente B es rechazado al intentar cancelar o reprogramar turnos del Paciente A.
5. **Detección de Reutilización de Refresh Tokens (OWASP ASVS V3.8):**  
   *Resultado:* **PASS** — Presentar un token previamente revocado causa 401 y revoca todas las sesiones activas restantes del usuario.
6. **Revocación de Sesiones al Desactivar Usuario o Cambiar Rol:**  
   *Resultado:* **PASS** — Al desactivar a un recepcionista, sus refresh tokens se marcan inmediatamente como revocados.
7. **Mitigación contra Inyección SQL:**  
   *Resultado:* **PASS** — Inyecciones con comillas, UNION y comentarios SQL son neutralizadas como búsquedas literales.
8. **Rechazo Estricto de Open Redirect en OAuth:**  
   *Resultado:* **PASS** — Enlaces phishing y javascript: son neutralizados y redirigidos al host seguro.
9. **Rechazo de Tokens con Algoritmo Inválido o "none":**  
   *Resultado:* **PASS** — Tokens forjados sin firma o con algoritmo alterado son rechazados de inmediato.

### Resultados Globales de la Suite:
- **Total de pruebas ejecutadas:** 98 subtests.
- **Pruebas superadas:** 98/98 (100%).
- **Pruebas fallidas:** 0.
- **Análisis de código estático (ESLint):** 0 errores.
- **Comprobación de tipos (TypeScript Frontend):** 0 errores (`tsc --noEmit`).

---

## 6. Clasificación de Hallazgos y Matriz de Estado

| Código | Descripción del Hallazgo | Clasificación |
|---|---|---|
| SEC-01 | BOLA/IDOR en Historias Clínicas | **CORREGIDO** |
| SEC-02 | BOLA/IDOR en Tratamientos y Tracking | **CORREGIDO** |
| SEC-03 | Detección de Reutilización de Refresh Tokens | **CORREGIDO** |
| SEC-04 | Rate Limiting granular en Login y Registro | **CORREGIDO** |
| SEC-05 | Revocación de sesiones por baja/cambio de rol | **CORREGIDO** |
| SEC-06 | Fijación de algoritmo HS256 en JWT | **CORREGIDO** |
| SEC-07 | Endurecimiento de cabeceras HTTP (Helmet/CSP) | **CORREGIDO** |
| SEC-08 | Resistencia a SQL Injection | **NO APLICA (PREVENIDO)** |
| SEC-09 | Protección contra fuga de credenciales en logs | **NO APLICA (PREVENIDO)** |
| SEC-10 | Open Redirects en OAuth Bridge | **CORREGIDO** |

---

## 7. Pendientes y Limitaciones Conocidas

1. **Almacenamiento de Secretos en Entorno de Pruebas:**  
   En entornos locales y de CI/CD, las variables de entorno provienen de archivos `.env`. Es imprescindible asegurar que en el despliegue de producción (Render, AWS, Railway) las variables `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APPS_SCRIPT_SHARED_SECRET` y credenciales de TiDB se configuren directamente en el panel de gestión de secretos del proveedor Cloud y nunca se versionen en Git.
2. **Autenticación Biométrica en Frontend:**  
   Actualmente la aplicación móvil utiliza `Expo SecureStore` para almacenar el token. La integración con sensores biométricos nativos (`expo-local-authentication`) como paso previo a desbloquear el SecureStore es una mejora recomendada para futuras fases.

---

## 8. Recomendaciones para el Despliegue en Producción

1. **HTTPS Obligatorio y HSTS:**  
   Asegurar que el balanceador de carga o proxy inverso termine TLS con certificados válidos (Let's Encrypt / Cloudflare) y fuerce la redirección HTTP -> HTTPS.
2. **Rotación Periódica de Secretos:**  
   Definir un ciclo de rotación semestral para los secretos `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`.
3. **Monitoreo de `audit_logs`:**  
   Configurar alertas automáticas sobre eventos de severidad crítica en la tabla `audit_logs` (p. ej., múltiples intentos fallidos de acceso o eventos de detección de reutilización de refresh tokens).
4. **Permisos de Usuario de Base de Datos:**  
   Verificar que el usuario MySQL configurado en producción cuente únicamente con permisos de `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre las tablas de la base de datos de la aplicación, sin privilegios administrativos globales como `GRANT`, `SUPER` o `DROP DATABASE`.

