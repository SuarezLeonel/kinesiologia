# AUDITORÍA TÉCNICA — Sistema de gestión para consultorio de kinesiología

- **Fecha:** 2026-10-27
- **Alcance:** repositorio completo (`backend/`, `frontend/`, `database/`, `docs/`, `AGENTS.md`), base TiDB Cloud en uso y build EAS existente.
- **Restricción respetada:** no se modificó ni eliminó ningún archivo del proyecto. Solo se creó este informe. Las comprobaciones fueron de lectura (grep, lectura de archivos, `npm test`, `tsc --noEmit`, `npm audit`, consultas `SELECT` a TiDB y peticiones HTTP al backend local).
- **Método de verificación** (se indica en cada hallazgo):
  - **[E]** ejecutado y observado en esta auditoría.
  - **[C]** deducido de la lectura del código, **no ejecutado**.
  - **[N]** no verificado / no verificable en este entorno.

---

## 0. Correcciones a afirmaciones previas del asistente

Esta auditoría contradice varios mensajes anteriores de la conversación. Se corrigen aquí para que el informe sea confiable:

| Afirmación previa | Realidad |
| :--- | :--- |
| "Verificación de los 10 flujos del sistema" (etapa de integración) | Solo se ejecutaron 7 pruebas automatizadas, casi todas negativas (405/401/403/404/422). **No se probó** CRUD de pacientes, creación/cancelación de turnos, superposición, historias clínicas con datos, pagos ni consumo de sesiones. Persistencia, renovación de token y logout **no se probaron de punta a punta**. |
| "Tratamientos, sesiones, mediciones y ejercicios" integrados | Solo existen tratamientos (search + create) y ejercicios (search + create). **Sesiones y mediciones no tienen ningún endpoint ni pantalla.** |
| "Auditoría inmutable de historias clínicas y turnos" (README) | `audit_logs` existe pero **ningún código escribe en ella** [E: 0 filas, 0 referencias en `backend/src`]. |
| "La APK aún no se generó" | **Falso.** El build EAS `8971ce84…` terminó con estado `FINISHED` [E: `eas build:list`]. Ver sección 8 (la APK existe pero no es utilizable en un teléfono físico). |
| Manual de usuario: "crear ejercicios", "registrar cobros", "alta de pacientes", "actualizar estado del turno" | El frontend **no tiene formularios** para ninguna de esas acciones (solo listados). El manual describe capacidades que solo existen como endpoints (y algunas ni eso). |
| "Procedimiento seguro para administrador inicial" | `create_initial_admin.js` solo imprime una contraseña aleatoria; **no crea usuario ni hash** [E: lectura]. |

---

## 1. Resultados reales de las comprobaciones ejecutadas

| Comprobación | Comando | Resultado |
| :--- | :--- | :--- |
| Tests backend | `npm test` (backend) | 7/7 aprobados [E]. Los tests 4 y 7 usan JWT firmados localmente y el test 4 acepta 401 **o** 403. |
| Compilación frontend | `npx tsc --noEmit` | Sin errores (exit 0) [E]. |
| Lint backend/frontend | — | **No existe** (sin ESLint, sin script `lint`) [E: `package.json`]. |
| Tests frontend | — | **No existen** (sin Jest/RNTL). |
| `npm audit --omit=dev` backend | | 1 vulnerabilidad alta: `zod <4.6.6` (DoS por memoria) [E]. |
| `npm audit --omit=dev` frontend | | 8 (5 bajas, 3 altas), incluye `zod` y `@expo/prebuild-config` [E]. |
| GET a endpoint de negocio | `GET /api/v1/patients/search` | 405 [E]. |
| GET `/api/docs/` (Swagger) | | 200 [E]. Es la única ruta GET útil; la excepción de Swagger permitida por `REQUISITOS.md` §9 **no está documentada formalmente**. |
| JSON malformado | `POST /auth/login` con `{bad json` | **500** `INTERNAL_SERVER_ERROR` [E]. Debería ser 400. |
| Rate limit en login | respuesta de `POST /auth/login` fallido | Cabecera `ratelimit-limit: 300` [E]: solo existe el límite global. |
| Estado real de TiDB | `SELECT` sobre `information_schema` | TiDB `8.0.11-TiDB-v8.5.3-serverless`, 21 tablas, 38 FK, **0 CHECK** [E]. |
| Datos en TiDB | `SELECT COUNT(*)` | users 3, patients 2, exercises 2, permissions 8, role_permissions 18, auth_refresh_tokens 9; **appointments, clinical_records, treatments, treatment_sessions, measurements, payments, payment_packages, audit_logs = 0** [E]. Ningún flujo de escritura de negocio ha sido ejercitado contra la base. |
| Secretos en Git | `git grep` / `git log -S` | La contraseña de TiDB **no** está en el historial [E]. `backend/.env` no está versionado [E]. `README.md` publica host y usuario de TiDB [E]. |
| Build APK | `eas build:list` | Build `8971ce84-5077-4179-9a42-67dd800f1a1e`, `FINISHED`, perfil `preview`, commit `3926bdd` [E]. Instalación/ejecución en dispositivo: **[N]**. |

---

## 2. Tabla de funcionalidades y estado

Leyenda: ✅ funciona (verificado) · 🟡 parcial · 🔴 solo UI o solo endpoint (sin extremo opuesto) · ⚠️ simulado / aparente · ❌ no existe

| # | Funcionalidad | Backend | Frontend | Estado global | Verificación |
| :-- | :--- | :--- | :--- | :---: | :--- |
| 1 | Login | Endpoint + bcrypt + JWT | Pantalla RHF + Zod | ✅ | [E] login 200 con admin |
| 2 | Registro | Endpoint (asigna rol kinesiólogo a cualquiera) | ❌ sin pantalla | 🔴 crítico | [C] |
| 3 | Recuperación/restablecer contraseña | Endpoints; **no envía correo** | ❌ sin pantallas | ⚠️ | [C] |
| 4 | Login social (Google/Facebook/Apple) | Devuelve 501 siempre (honesto) | ❌ | ❌ | [C] |
| 5 | Refresh / rotación / revocación | Implementado; riesgo de colisión de hash (H5) | Interceptor Axios | 🟡 | [C], no probado |
| 6 | Persistencia de sesión | n/a | SecureStore + localStorage (web) | 🟡 | [C]; probado manualmente por el usuario solo hasta el Dashboard |
| 7 | Logout | Revoca refresh token | Botón en Dashboard/Ajustes | 🟡 | [C] |
| 8 | Roles y permisos | Por nombre de rol en rutas; **tablas `permissions`/`role_permissions` sin uso** | Pestañas por rol | 🟡 | [C] + tests 4/7 |
| 9 | Usuarios (CRUD) | search/detail/create/patch/delete (solo admin) | ❌ sin pantalla | 🔴 | [C], no ejecutado |
| 10 | Pacientes | search/detail/create/patch/delete | Solo listado + búsqueda | 🟡 | [E] search 200 (2 filas) |
| 11 | Turnos | search/detail/create/patch/delete con historial y chequeo de superposición | Solo listado (sin calendario, sin alta/edición/cancelación) | 🟡 | [E] search 200 (0 filas); resto [C] |
| 12 | Servicios / tarifas | ❌ sin endpoint | ❌ | ❌ | Imposible elegir `serviceId` desde la UI |
| 13 | Historias clínicas | search/detail/create/patch con versionado parcial | Solo listado (sin alta/detalle/edición); `patientId` por defecto `'1'` | 🟡 | [E] search 200 (0 filas) |
| 14 | Tratamientos | Solo search + create; sin detail/PATCH | ❌ | 🔴 | [C] |
| 15 | Sesiones de tratamiento | ❌ sin endpoint (tabla existe) | ❌ | ❌ | [E] 0 filas |
| 16 | Mediciones y evolución (gráficos) | ❌ sin endpoint (tabla existe) | ❌ | ❌ | [E] 0 filas |
| 17 | Ejercicios | search + create; sin PATCH/DELETE; **sin asignación a tratamientos** | Solo listado | 🟡 | [E] search 200 (2 filas) |
| 18 | Pagos | search + create + consume-session | Solo listado | 🟡 | [E] search 200 (0 filas); create/consume [C] |
| 19 | Paquetes y saldos | Alta de paquete y consumo transaccional | ❌ | 🔴 | [C] |
| 20 | Dashboard | `/dashboard/summary` con datos reales | Pantalla conectada | ✅ (con límites) | [E] hasta el Dashboard según el usuario |
| 21 | Estadísticas / reportes | ❌ | ❌ | ❌ | — |
| 22 | Notificaciones/recordatorios | ❌ | ❌ | ❌ | — |
| 23 | Auditoría de acciones sensibles | Tabla sin uso | ❌ | ❌ | [E] 0 filas / 0 referencias |
| 24 | Modo claro/oscuro | n/a | Detección + manual | 🟡 | [C]; preferencia **no persiste en web** |
| 25 | Responsive teléfono/tablet | n/a | Sin `useWindowDimensions`; grid `48%`; 7 pestañas inferiores | 🟡 | [C] |
| 26 | Documentación OpenAPI | 6 de 34 endpoints documentados | n/a | 🟡 | [E] conteo |
| 27 | APK Android | n/a | Build `FINISHED` pero con URL de API inválida para teléfono | 🟡 | [E]/[C]; ver sección 8 |

**Pantallas mínimas de `REQUISITOS.md` §7 inexistentes:** splash propio, registro, recuperación, acceso social, alta/edición de turno, detalle de paciente, alta/detalle de historia clínica, tratamientos, detalle de tratamiento, registro de sesión, evolución, estadísticas, gestión de usuarios, perfil.

---

## 3. Hallazgos por área

Severidad: **CRÍTICO** (seguridad/datos clínicos o incumplimiento obligatorio) · **ALTO** · **MEDIO** · **BAJO**.

### 3.1 Seguridad

| ID | Sev. | Hallazgo | Consecuencia | Verif. |
| :-- | :-- | :--- | :--- | :-- |
| S1 | CRÍTICO | `POST /auth/register` es público y crea usuarios con `roleId: 2` (kinesiólogo) y devuelve tokens (`auth/service.js:25`). | Cualquier persona obtiene un rol con acceso a pacientes e historias clínicas. Viola "no permitir asignación pública de privilegios" (`PLAN_DE_TRABAJO`, Etapa 3) y la regla de datos clínicos restringidos. | [C] |
| S2 | CRÍTICO | `authenticateToken` toma el **rol del JWT**, no de la base, y **ignora errores `ECONNREFUSED`/`ER_ACCESS_DENIED_ERROR`** (`middlewares/auth.js:40`). Si el usuario no existe en la base (`users.length===0`) igualmente continúa. | Falla abierta: ante caída de BD el middleware autentica con el contenido del token; un cambio de rol o desactivación no tiene efecto hasta que expire el token. Los tests 4 y 7 dependen de este comportamiento. | [C] |
| S3 | CRÍTICO | Sin autorización **por recurso**: cualquier kinesiólogo lee/edita historias de **cualquier** paciente; `assigned_kinesiologist_id` no se usa para filtrar. El administrador puede firmar historias clínicas. Cualquier kinesiólogo puede modificar historias de otro autor. | Incumple "autorizar por endpoint y por recurso" (`REQUISITOS` §4) y "pacientes autorizados". | [C] |
| S4 | CRÍTICO | El DNI ("restringido" en `REQUISITOS` §5) se devuelve completo a recepción y kinesiología en search/detail. | Exposición de dato restringido sin política definida. | [C] |
| S5 | ALTO | Sin limitación de intentos en login, registro, forgot/reset (solo límite global de 300 req/15 min por IP). Sin bloqueo de cuenta. | Fuerza bruta de contraseñas viable. Incumple `REQUISITOS` §3. | [E] cabecera `ratelimit-limit: 300` |
| S6 | ALTO | Token de reset firmado con el **mismo secreto del access token**, no de un solo uso, y `forgot-password` devuelve `resetToken` en el cuerpo cuando `NODE_ENV=development`. No hay envío de correo. Un reset token válido es aceptado por `authenticateToken` como access token (rol `user`). | Flujo de recuperación inseguro y simulado; `NODE_ENV` mal configurado en producción expondría tokens. | [C] |
| S7 | ALTO | `env.js` define secretos JWT por defecto (`default_access_secret_change_in_production`) y CORS `*` por defecto. | Si falta una variable, la app arranca con secretos públicos conocidos. | [C] |
| S8 | ALTO | Contraseña de TiDB compartida en el chat de la sesión; `README.md` publica host y usuario de TiDB. | Credencial a rotar; superficie de ataque conocida. | [E] (no está en Git; sí host/usuario) |
| S9 | ALTO | Sin auditoría real: `audit_logs` nunca se escribe. Las versiones de historia clínica solo guardan diagnóstico y evaluación inicial (no el resto de campos). | Sin trazabilidad exigida por `REQUISITOS` §5 y §11. | [E] |
| S10 | MEDIO | En web los tokens quedan en `localStorage` (fallback agregado para depurar). | Exposición a XSS en la versión web; debe quedar limitado a desarrollo. | [C] |
| S11 | MEDIO | `refresh`: expiración del registro fijada en 7 días (`setDate(+7)`), independiente de `JWT_REFRESH_EXPIRES_IN`; sin detección de reutilización de refresh tokens. | Configuración incoherente; robo de refresh token no detectable. | [C] |
| S12 | MEDIO | `trust proxy` no configurado, `urlencoded` habilitado sin necesidad, `ID` en `DELETE /:id` sin validación. | Rate limit por IP incorrecto tras un proxy; superficie innecesaria. | [C] |
| S13 | MEDIO | Dependencia `zod` con vulnerabilidad alta (backend y frontend). | DoS por memoria con colecciones grandes. | [E] |

### 3.2 Backend (arquitectura, validaciones, errores)

| ID | Sev. | Hallazgo | Consecuencia | Verif. |
| :-- | :-- | :--- | :--- | :-- |
| B1 | ALTO | JSON malformado devuelve **500** (el handler ignora `err.status`/`err.type` de body-parser). | Mensaje engañoso y ruido en logs; debería ser 400. | [E] |
| B2 | ALTO | Violaciones de FK (`ER_NO_REFERENCED_ROW_2`), fechas inválidas y otros errores de BD responden 500 (solo se mapea `ER_DUP_ENTRY`). | Datos de entrada incorrectos producen "error inesperado". | [C] |
| B3 | ALTO | Turnos: la verificación de superposición **no es atómica** con el INSERT (no hay bloqueo ni transacción alrededor del chequeo); no se valida `endTime > startTime`, horario de atención, duración del servicio, ni cruce por paciente; ISO con `Z` pasa a `DATETIME` sin normalizar. | Doble reserva por concurrencia; turnos inválidos; riesgo de zona horaria. | [C], no ejecutado |
| B4 | ALTO | Módulos `treatments`, `dashboard`, `exercises`, `payments` tienen SQL y reglas **dentro de `routes.js`**; no hay controller/service/repository. | Incumple la arquitectura de `REQUISITOS` §8; difícil de probar y mantener. | [C] |
| B5 | ALTO | Pagos: sin clave de idempotencia (un reintento duplica el cobro); `consume-session` no verifica que el paquete pertenezca al paciente ni se vincula a una sesión real; sin anulación/reintegro; sin concepto de saldo adeudado. | Riesgo de contabilizar dos veces una operación (`REQUISITOS` §5 Pagos). | [C] |
| B6 | ALTO | Refresh token: el payload `{userId}` + `iat` en segundos puede repetirse si se emite dos veces en el mismo segundo; `token_hash` es `UNIQUE` → `ER_DUP_ENTRY` → 409. | Login seguido de refresh inmediato podría fallar. **Hipótesis, no reproducida.** | [C] |
| B7 | MEDIO | Endpoints mínimos de `REQUISITOS` §10 faltantes: `PATCH /treatments/:id`, `POST /sessions/search`, `POST /sessions`, `PATCH /sessions/:id`. Faltan servicios, mediciones, reportes. | Incumple la lista mínima. | [C] |
| B8 | MEDIO | Pacientes: el PATCH no permite corregir DNI ni fecha de nacimiento; no se valida que `assignedKinesiologistId` sea un usuario con rol kinesiólogo. | Errores de carga irrecuperables; asignaciones inválidas. | [C] |
| B9 | MEDIO | Dashboard: métricas globales para todos los roles (un kinesiólogo ve totales del consultorio); `DATE(start_time)=?` impide usar índices. | Sobreexposición y rendimiento. | [C] |
| B10 | MEDIO | Usuarios: el admin puede desactivarse a sí mismo o al último admin; no hay política. | Bloqueo administrativo. | [C] |
| B11 | MEDIO | Código duplicado: bloque `try/catch → next(error)` repetido en todos los controllers (sin `asyncHandler`); `req.ip` pasado por controller. Imports/parámetros sin uso (p. ej. `authorizeRoles` en `dashboard/routes.js`, `idToken`/`currentUser` sin uso). Sin lint no hay detección automática. | Mantenibilidad. | [C] |
| B12 | BAJO | `yamljs` sin mantenimiento; `swagger-ui-express` expone `/api/docs` con GET sin documentar la excepción. | Dependencia riesgosa; documentación incompleta de la excepción. | [C]/[E] |

### 3.3 Base de datos

| ID | Sev. | Hallazgo | Consecuencia | Verif. |
| :-- | :-- | :--- | :--- | :-- |
| D1 | CRÍTICO | Los **seeds contienen hashes bcrypt falsos** (`$2b$10$v5yT9k4X/...`) y un comentario con un hash distinto. Para poder iniciar sesión se ejecutó a mano un `UPDATE users SET password_hash = ?` **sobre todos los usuarios** de TiDB, fuera de cualquier script versionado. | Una base nueva creada con las migraciones del repositorio **no permite login**; el estado actual no es reproducible. | [E] lectura de seed y de la sesión |
| D2 | ALTO | "Migraciones versionadas" = un único `001_initial_schema.sql`, sin tabla `schema_migrations`, sin `down`, y `migrate_tidb.js` re-ejecuta esquema **y seeds de demostración** (usuarios/contraseña conocida) en cualquier destino; importa módulos con rutas relativas a `backend/node_modules`. | No hay control de versión del esquema; riesgo de sembrar credenciales demo en producción; script frágil. | [C] |
| D3 | ALTO | 0 restricciones `CHECK` [E]: dolor 0–10, `end_time > start_time`, importes `> 0`, sesiones usadas ≤ totales, saldos ≥ 0 no se garantizan en BD. | La integridad depende solo de la capa de aplicación. | [E] |
| D4 | ALTO | `permissions` y `role_permissions` (18 filas) **no se usan**; la autorización está fija en el código por nombre de rol. | Modelo de permisos aparente; cambiar permisos requiere desplegar código. | [E]/[C] |
| D5 | MEDIO | Normalización: `treatments.diagnosis_summary` duplica el diagnóstico de la historia; `measurements.patient_id` es derivable de `treatment_id`/`session_id`; `payments.service_id` es derivable de `package_id`; `payment_packages.used_sessions`/`status` y `package_session_transactions.balance_after` son derivados (contadores desnormalizados); `measurements.unit` y `metric_name` son texto libre. | Contradice parcialmente `DATABASE_ARCHITECTURE.md` (que presenta el modelo como 3FN limpia) y permite mezclar unidades (`REQUISITOS` §5 Mediciones). Los derivados son defendibles como decisión de rendimiento **si se documentan**. | [C] |
| D6 | MEDIO | Sin catálogo de unidades/métricas; sin índices para búsquedas por `appointments.patient_id + status`, `treatments.kinesiologist_id`, `payments.payment_date`. | Rendimiento y consistencia de datos futura. | [C] |
| D7 | BAJO | 38 FK confirmadas en TiDB v8.5.3 [E]; **no se probó** su aplicación efectiva con datos (ninguna tabla de negocio tiene filas). | La integridad referencial real no está demostrada. | [N] |

### 3.4 Aplicación móvil / interfaz

| ID | Sev. | Hallazgo | Consecuencia | Verif. |
| :-- | :-- | :--- | :-- | :-- |
| F1 | ALTO | **Reglas de hooks violadas**: `ClinicalRecordsScreen` y `PaymentsScreen` hacen `return` condicional antes de `useEffect`. | Comportamiento indefinido si cambia el rol en la misma instancia; error de lint esperable. | [E] lectura (`ClinicalRecordsScreen.tsx:17`) |
| F2 | ALTO | `ErrorState` declara `onRetry` pero **nunca renderiza un botón** (`FeedbackStates.tsx:15`); todas las pantallas lo pasan. | El usuario no puede reintentar tras un error; la promesa de la UI no se cumple. | [E] grep |
| F3 | ALTO | La app es de **solo lectura**: no hay formularios de alta/edición para pacientes, turnos, historias, pagos ni ejercicios. Solo el login usa React Hook Form + Zod. | Casi todo el negocio solo es operable vía API. Incumple "validación en frontend" y las pantallas mínimas. | [E] grep `useForm` (solo `LoginScreen`) |
| F4 | MEDIO | Agenda lista todos los turnos ordenados sin vista diaria/semanal ni filtros; `ClinicalRecordsScreen` precarga `patientId='1'` y pide ID numérico en texto libre. | UX inviable para uso real; dato ficticio por defecto. | [C] |
| F5 | MEDIO | Sin accesibilidad (`accessibilityLabel` = 0 ocurrencias), sin adaptación a tablet/orientación (`useWindowDimensions` = 0), 7 pestañas inferiores en teléfono. | Incumple `REQUISITOS` §6. | [E] grep |
| F6 | MEDIO | `ThemeContext` persiste la preferencia solo con SecureStore (no funciona en web) mientras `AuthContext` sí tiene fallback. Lógica de almacenamiento **duplicada** en `AuthContext.tsx` y `api/client.ts`. | Preferencia de tema no persistente en web; duplicación. | [C] |
| F7 | MEDIO | El rol llega como `role_name` y se normaliza con valor por defecto `'admin'` si falta (`AuthContext.tsx`). | Un fallo de datos concedería UI de administrador (la autoridad sigue siendo el backend, pero es un valor por defecto riesgoso). | [C] |
| F8 | MEDIO | `API_BASE_URL` por defecto es `localhost` (web/iOS) o `10.0.2.2` (Android emulador). No hay `frontend/.env.example` ni variable definida en `eas.json`. | En un teléfono físico no hay conectividad (ver sección 8). | [E] lectura |
| F9 | BAJO | Sin Splash propio; `userInterfaceStyle: automatic` pero colores no reaccionan a pestañas nativas; TypeScript `~6.0.3`, React 19.3 y RN 0.88 provienen de la plantilla y **no se ejecutó `expo-doctor`**. | Compatibilidad de dependencias no certificada. | [N] |

### 3.5 Pruebas y calidad

| ID | Sev. | Hallazgo | Consecuencia | Verif. |
| :-- | :-- | :--- | :-- | :-- |
| Q1 | ALTO | 7 pruebas, 0 de integración funcional: sin CRUD, sin superposición de turnos, sin pagos/saldos, sin acceso permitido a historias clínicas, sin refresh/logout. Los tests usan la **base TiDB real** (sin BD de prueba) y firman JWT con el secreto de desarrollo. | La cobertura real es mínima; no pueden usarse como evidencia de las funcionalidades. | [E] |
| Q2 | ALTO | Sin lint (ni backend ni frontend), sin pruebas de frontend, sin CI. | No se detectan errores como F1, imports sin uso o duplicación. | [E] |
| Q3 | MEDIO | Sin funcionalidades **simuladas con datos falsos** (no hay mocks en el frontend; todo proviene de la API), pero sí **simulaciones de proceso**: `forgot-password` responde "sent" sin enviar nada, `create_initial_admin.js` no crea el admin, y el Dashboard muestra ceros cuando la base está vacía. | Apariencia de funcionalidad. | [C] |
| Q4 | MEDIO | La documentación (README, USER_MANUAL, `PROMPTS`) afirma capacidades inexistentes (ver sección 0). | Riesgo de entrega engañosa. | [C] |

### 3.6 API REST y requisito "sin GET"

| ID | Sev. | Hallazgo | Estado | Verif. |
| :-- | :-- | :--- | :-- | :-- |
| A1 | — | Cumplimiento "sin GET de negocio": middleware bloquea GET en `/api/v1/*` con 405; ninguna ruta de negocio declara `router.get`. | ✅ Cumple | [E] |
| A2 | MEDIO | OpenAPI cubre **6 de 34** endpoints (sin esquemas de error, sin roles por operación, sin ejemplos de respuesta, sin `users`, `appointments/detail|POST|PATCH|DELETE`, `treatments`, `exercises`, `payments`, `dashboard`). | ❌ Incumple `REQUISITOS` §14 | [E] conteo |
| A3 | BAJO | Se usa PATCH y DELETE; **PUT no se usa** en ningún recurso. | Aceptable, pero sin criterio documentado. | [C] |

---

## 4. Riesgos transversales y límites de esta auditoría

- **No se verificó** conectividad desde un dispositivo físico ni la instalación/ejecución de la APK **[N]**.
- **No se verificaron** en ejecución: creación/cancelación de turnos, superposición, historias clínicas con datos, tratamientos, pagos, consumo de sesiones, refresh/rotación y logout **[N]**. Las conclusiones sobre ellos son por lectura de código **[C]**.
- La aplicación efectiva de FK/transacciones en TiDB con datos reales **[N]**.
- Zona horaria entre `DATETIME`, `mysql2` y el cliente **[N]**.

---

## 5. Prioridades

| Prioridad | Criterio | IDs |
| :-- | :--- | :--- |
| **P0 — bloquea cualquier uso con datos reales** | Escalada de privilegios, acceso a datos clínicos, secretos, no reproducibilidad | S1, S2, S3, S4, S8, D1 |
| **P1 — requisito obligatorio incumplido o corrupción de datos** | Seguridad restante, módulos obligatorios, integridad | S5, S6, S7, S9, B3, B5, B6, B7, D2, D3, D4, Q1 |
| **P2 — calidad y usabilidad** | UI de escritura, errores, documentación | B1, B2, B4, F1, F2, F3, A2, Q2, Q4 |
| **P3 — mejoras** | Responsive, accesibilidad, rendimiento, deuda | B8–B12, D5–D7, F4–F9, S10–S13 |

---

## 6. Plan de corrección ordenado por dependencias

Cada fase depende de la anterior. No se avanza de fase sin pruebas ejecutadas y reportadas con resultados reales.

**Fase 0 — Contención (sin dependencias)**
1. Rotar la contraseña de TiDB; quitar host/usuario del `README.md`; confirmar `.env` fuera de Git. (S8)
2. Hacer obligatorios los secretos JWT y `CORS_ORIGIN` (fallar al arrancar si faltan). (S7)

**Fase 1 — Base de datos reproducible** (depende de F0)
3. Tabla `schema_migrations` + migraciones numeradas con rollback; separar seeds de demostración de las migraciones; `migrate` no siembra en producción. (D2)
4. Seeds con hashes generados por script (sin contraseñas conocidas en repositorio) y **script real de creación de admin** que inserta con hash bcrypt desde variable de entorno. (D1)
5. Restricciones `CHECK` e índices faltantes; decidir y documentar los campos derivados/redundantes; catálogo de unidades de medición. (D3, D5, D6)

**Fase 2 — Núcleo de seguridad del backend** (depende de F1)
6. Eliminar el rol por defecto del registro: registro público deshabilitado o crear solo cuentas sin privilegios clínicos; alta de profesionales solo por administrador. (S1)
7. `authenticateToken` fail-closed: leer rol y estado desde BD en cada petición (o con caché corta); rechazar usuario inexistente; sin captura de errores de conexión. (S2)
8. Capa de políticas por recurso (kinesiólogo → pacientes asignados; recepción sin DNI completo ni datos clínicos; autoría en historias). Usar `permissions` o eliminarlas del modelo. (S3, S4, D4)
9. Limitadores específicos en login/registro/forgot/reset + bloqueo temporal; reset con secreto y tabla de un solo uso; `jti` único en refresh y detección de reutilización. (S5, S6, S11, B6)
10. `errorHandler`: 400 para JSON inválido, 409/422 para FK y datos inválidos; `asyncHandler`; `trust proxy`. (B1, B2, S12)
11. Escritura real en `audit_logs` para acciones sensibles; ampliar versionado de historias. (S9)

**Fase 3 — Módulos de negocio faltantes y refuerzo** (depende de F2)
12. Mover `treatments`, `exercises`, `payments`, `dashboard` a controller/service/repository. (B4)
13. Servicios/tarifas; sesiones; mediciones; `PATCH /treatments`, asignación de ejercicios; reportes/estadísticas. (B7, #12, #15, #16, #21)
14. Turnos: transacción con bloqueo, validación de horario/duración/paciente/`end>start`, normalización de zona horaria. (B3)
15. Pagos: clave de idempotencia, verificación paciente-paquete, anulación, saldo. (B5)

**Fase 4 — Pruebas y calidad** (depende de F3; algunas pruebas se escriben junto a cada fase)
16. BD de pruebas separada; pruebas de integración: matriz rol × endpoint, CRUD, superposición, pagos, refresh/logout. (Q1)
17. ESLint (backend y frontend) y pruebas de frontend; actualizar `zod`; ejecutar `expo-doctor`. (Q2, S13, F9)

**Fase 5 — Documentación de API** (depende de F3)
18. OpenAPI completo de los 34+ endpoints (roles, cuerpos, respuestas, errores); documentar la excepción de `/api/docs`. (A2, B12)

**Fase 6 — Frontend** (depende de F2–F3)
19. Corregir hooks y `ErrorState` con botón de reintento. (F1, F2)
20. Formularios RHF + Zod: pacientes, turnos (calendario diario/semanal), historias, tratamientos, sesiones, mediciones, pagos, ejercicios, usuarios; registro/recuperación; perfil. (F3, F4)
21. Responsive/tablet, accesibilidad, persistencia de tema en web; unificar la capa de almacenamiento; quitar rol por defecto `'admin'`. (F5, F6, F7)

**Fase 7 — APK utilizable** (depende de F2 y F6)
22. Publicar el backend con HTTPS accesible; definir `EXPO_PUBLIC_API_URL` por perfil en `eas.json` y `frontend/.env.example`; reconstruir; probar en teléfono físico. (F8, sección 8)

**Fase 8 — Cierre documental** (depende de todo lo anterior)
23. README, manual y guías ajustados **solo a lo implementado y probado**; revisión de seguridad y lista de limitaciones. (Q4)

---

## 7. Qué funciona realmente (resumen honesto)

- Login con JWT y bcrypt contra TiDB Cloud (credenciales de demostración tras el `UPDATE` manual). [E]
- Conexión TLS a TiDB y esquema de 21 tablas con 38 FK. [E]
- Bloqueo de GET en rutas de negocio (405) y formato de errores consistente para 401/403/404/405/422. [E]
- Listados de pacientes, turnos, historias, ejercicios y pagos devuelven 200 (con 2, 0, 0, 2, 0 filas respectivamente). [E]
- Dashboard con datos reales de la API. [E parcial]
- `tsc --noEmit` sin errores. [E]

Todo lo demás está **parcial, sin verificar o inexistente**, según la sección 2.

---

## 8. Estado de la APK y conectividad móvil

- **Existe un build EAS terminado** (`FINISHED`), ID `8971ce84-5077-4179-9a42-67dd800f1a1e`, perfil `preview`, `appIdentifier com.kinesiologia.app`, commit `3926bdd`, caduca el 2026-11-11 [E]. Artefacto: `https://expo.dev/artifacts/eas/vwNZmrS0Hijj9eDV6Jquqe_4DWp9jgPuvDx-RM44OXs.apk`.
- **No se instaló ni se ejecutó** [N].
- **Problemas conocidos de esa APK** [C]:
  1. Se compiló sin `EXPO_PUBLIC_API_URL`; por tanto usa `http://10.0.2.2:3000/api/v1`, que solo existe en el emulador de Android. En un teléfono físico **no conecta**.
  2. Aunque se use una IP de red local, es `http` en texto claro: Android 9+ lo bloquea en builds de release salvo configuración explícita.
  3. Es anterior a las correcciones de `AuthContext`/`DashboardScreen` y no contiene la normalización de rol.
  4. El backend corre solo en el equipo local; ningún teléfono puede alcanzar `localhost`.
- Conclusión: **la APK no debe considerarse entregable** hasta resolver la Fase 7.

---

## 9. Conclusión

El proyecto tiene una base válida (esquema relacional razonable, arquitectura por capas en `users`/`patients`/`appointments`/`clinical-records`, regla de "sin GET" cumplida, login funcional). **No está listo para producción ni para datos reales de pacientes**: existen fallas críticas de seguridad (S1–S4), módulos obligatorios inexistentes, escritura de negocio no probada y documentación que afirma más de lo implementado.
