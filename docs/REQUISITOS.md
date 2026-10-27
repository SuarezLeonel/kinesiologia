# REQUISITOS.md — Sistema de gestión para kinesiología

## 1. Objetivo
Desarrollar una aplicación móvil real para administrar un consultorio de kinesiología. Debe conectarse a una API y a MySQL; no basta con una maqueta ni con datos simulados.

## 2. Tecnologías
- React Native, Expo y TypeScript.
- React Navigation.
- Context API o Redux Toolkit para estado global.
- React Hook Form y Zod.
- Axios.
- Expo SecureStore.
- Node.js, Express y ES Modules.
- MySQL y mysql2.
- JWT de acceso y refresh tokens.
- Documentación OpenAPI/Swagger y README.

Antes de instalar o actualizar paquetes, comprobar compatibilidad con la versión existente de Expo y el proyecto.

## 3. Autenticación
- Registro, inicio y cierre de sesión.
- Recuperación y restablecimiento de contraseña.
- Persistencia de sesión.
- JWT de acceso de corta duración y refresh tokens con expiración, revocación y rotación cuando sea viable.
- Limitación de intentos y rate limiting en endpoints sensibles.
- Autenticación social mediante Google, Facebook y Apple.
- Validar tokens sociales en el backend.
- Si faltan credenciales de proveedores, documentar la configuración y no simular que la integración está activa.
- No guardar secretos en el cliente ni contraseñas en texto plano.

## 4. Roles y permisos
### Administrador
Gestionar usuarios y roles, servicios, horarios, tarifas, configuración y reportes administrativos.

### Kinesiólogo
Consultar agenda; gestionar pacientes autorizados; acceder a historias clínicas; registrar evaluaciones, mediciones, sesiones y evolución; crear tratamientos e indicar ejercicios; generar informes.

### Recepcionista
Gestionar datos administrativos, turnos, asistencia y cobros. No debe acceder por defecto a diagnósticos, notas clínicas ni información médica restringida.

Los permisos deben aplicarse en el backend por endpoint y por recurso. Ocultar botones no es una medida suficiente.

## 5. Módulos funcionales
### Pacientes
Ficha con identificador, nombre, apellido, DNI restringido, fecha de nacimiento, contacto, alta, estado y profesional responsable cuando corresponda. Búsqueda, filtros, paginación, edición y desactivación.

### Turnos
Calendario diario y semanal; crear, reprogramar y cancelar; profesional, paciente, horario, duración, tipo de servicio y estado (pendiente, confirmado, atendido, cancelado, ausente). Prevenir superposiciones en backend y validar horarios de atención. Mantener historial de cambios.

### Historias clínicas
Motivo de consulta, antecedentes relevantes, evaluación inicial, diagnóstico registrado por el profesional, dolor informado, movilidad, limitaciones, objetivos, evolución y observaciones. Registrar autor y fecha. Las correcciones deben dejar trazabilidad.

### Tratamientos y sesiones
Planes individuales, profesional responsable, objetivos, fechas, sesiones previstas y realizadas, ejercicios, observaciones y estado.

### Mediciones y evolución
Registrar valores con fecha, unidad y autor: dolor autoinformado, rango de movimiento, fuerza y capacidad funcional. Gráficos temporales y comparación entre evaluación inicial y posteriores. No mezclar unidades ni tratar datos faltantes como cero.

### Ejercicios
Catálogo con nombre, descripción, categoría, instrucciones, series, repeticiones, duración/frecuencia e imagen o video opcional. Asignación a tratamientos.

### Pagos
Importe, moneda, fecha, método, paciente, servicio, paquetes, sesiones disponibles, saldos e historial. Mantener integridad y evitar contabilizar dos veces una operación. No almacenar datos sensibles de tarjetas.

### Dashboard
Turnos del día, próximas atenciones, pacientes, sesiones, ausencias, tratamientos activos e ingresos solo para roles autorizados. Los datos deben provenir de la API.

### Notificaciones
Preparar recordatorios y notificaciones de cambios. Si se integra un proveedor, documentar credenciales y comprobar el envío; no afirmar éxito sin confirmación.

## 6. UI/UX
- Diseño profesional, minimalista y relacionado con salud.
- Modo claro y oscuro, detección del tema del dispositivo, preferencia manual persistente y colores centralizados.
- Diseño adaptable a teléfonos, tablets y ambas orientaciones.
- Navegación inferior en móviles para secciones principales.
- Estados de carga, error, acceso denegado y resultados vacíos.
- Formularios accesibles, validaciones junto a campos, confirmaciones visuales y mensajes claros.
- Sin `alert()`.
- No usar dimensiones rígidas que causen desbordamientos.

## 7. Pantallas mínimas
Splash, login, registro, recuperación de contraseña, acceso social, dashboard, agenda, alta/edición de turno, listado y detalle de pacientes, historia clínica, tratamientos, detalle de tratamiento, registro de sesión, evolución, ejercicios, pagos, estadísticas, gestión de usuarios, perfil, configuración, tema, carga, error, acceso denegado y resultados vacíos.

## 8. Arquitectura
Separar frontend y backend por funcionalidades y responsabilidades. En el backend separar rutas, controladores, servicios, repositorios, esquemas de validación y middleware. Evitar archivos monolíticos y fragmentación innecesaria.

Estructura sugerida:

frontend/src/
- api/
- components/
- context/
- hooks/
- navigation/
- screens/
- schemas/
- services/
- types/
- utils/
- theme/

backend/src/
- config/
- middlewares/
- modules/
- utils/
- app.js
- server.js

Cada módulo debe exportar explícitamente sus funciones, controladores y routers. Usar ES Modules y `"type": "module"`.

## 9. Regla HTTP
No usar GET en ningún endpoint de negocio. Para consultas usar POST, por ejemplo:
- `POST /api/v1/patients/search`
- `POST /api/v1/patients/detail`

Para creación usar POST; para actualización completa PUT; para actualización parcial PATCH; para desactivación o eliminación DELETE. Los identificadores y filtros de consultas deben enviarse en el cuerpo cuando corresponda. Revisar también las pruebas y OpenAPI para evitar rutas GET accidentales.

La interfaz técnica de Swagger puede requerir una excepción separada; documentarla si resulta imprescindible. La regla de no GET se aplica a la API de negocio.

## 10. Endpoints mínimos
Auth:
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/refresh`
- POST `/api/v1/auth/logout`
- POST `/api/v1/auth/forgot-password`
- POST `/api/v1/auth/reset-password`
- POST `/api/v1/auth/social`

Usuarios:
- POST `/api/v1/users/search`
- POST `/api/v1/users/detail`
- POST `/api/v1/users`
- PATCH `/api/v1/users/:id`
- DELETE `/api/v1/users/:id`

Pacientes:
- POST `/api/v1/patients/search`
- POST `/api/v1/patients/detail`
- POST `/api/v1/patients`
- PATCH `/api/v1/patients/:id`
- DELETE `/api/v1/patients/:id`

Turnos:
- POST `/api/v1/appointments/search`
- POST `/api/v1/appointments/detail`
- POST `/api/v1/appointments`
- PATCH `/api/v1/appointments/:id`
- DELETE `/api/v1/appointments/:id`

Historias clínicas:
- POST `/api/v1/clinical-records/search`
- POST `/api/v1/clinical-records/detail`
- POST `/api/v1/clinical-records`
- PATCH `/api/v1/clinical-records/:id`

Tratamientos y sesiones:
- POST `/api/v1/treatments/search`
- POST `/api/v1/treatments`
- PATCH `/api/v1/treatments/:id`
- POST `/api/v1/sessions/search`
- POST `/api/v1/sessions`
- PATCH `/api/v1/sessions/:id`

Agregar endpoints equivalentes y autorizados para ejercicios, mediciones, pagos, reportes y demás operaciones necesarias. Consultas con filtros, paginación y ordenamiento por campos permitidos.

## 11. Seguridad y errores
- bcrypt con parámetros adecuados.
- Consultas parametrizadas.
- Validación en ambos lados.
- JWT y refresh tokens con expiración y revocación.
- Autorización por rol y recurso.
- Rate limiting, Helmet y CORS limitado a orígenes necesarios.
- Secretos en variables de entorno.
- Auditoría de acciones sensibles.
- No registrar contraseñas, tokens ni datos clínicos.
- Backups y restauración documentados.
- Respuestas de error sin detalles internos en producción.

Usar códigos apropiados: 200, 201, 400, 401, 403, 404, 409, 422, 429 y 500. Mantener formato consistente.

## 12. Base de datos y normalización
Diseñar un modelo relacional MySQL con tablas para roles, permisos, relaciones rol-permiso, usuarios, sesiones de autenticación, proveedores sociales, pacientes, turnos, historias clínicas, tratamientos, sesiones de tratamiento, ejercicios, ejercicios asignados a tratamientos, mediciones, servicios, pagos, movimientos de sesiones y auditoría.

Usar claves primarias y foráneas, restricciones, índices, tipos correctos, transacciones y migraciones versionadas. No guardar listas de IDs separados por comas.

Documentar con ejemplos:
- 1FN: campos atómicos y sin grupos repetitivos.
- 2FN: sin dependencias parciales de atributos no clave respecto de claves candidatas compuestas.
- 3FN: sin dependencias transitivas indebidas de atributos no clave respecto de claves candidatas.

Incluir diagrama entidad-relación, migraciones y datos ficticios de demostración. No usar datos reales de pacientes.

## 13. Pruebas
Probar autenticación, tokens, roles, acceso a historias clínicas, CRUD, turnos superpuestos, validaciones, pagos, integridad referencial, errores y navegación. Usar herramientas compatibles como Jest/Vitest, React Native Testing Library y Supertest. Documentar qué pruebas se ejecutaron y sus resultados reales.

## 14. Documentación y entregables
- Código completo de frontend y backend.
- Base de datos y migraciones.
- `.env.example` sin secretos.
- README principal y documentación por componente.
- Instalación y ejecución.
- API OpenAPI con métodos, rutas, autenticación, roles, cuerpos, respuestas y errores.
- Manual de usuario.
- Guía de configuración, MySQL, OAuth, variables de entorno y ejecución.
- Diagrama entidad-relación y explicación de normalización.
- Tests.
- Git y `.gitignore`.
- APK Android instalable y pasos de compilación.

Para la APK, configurar EAS Build o alternativa compatible. Si no se puede compilar en el entorno, dejar instrucciones exactas y declarar que no se generó. En un teléfono físico, la URL de la API no puede ser `localhost`; debe ser accesible desde el dispositivo.

## 15. Método de trabajo
1. Inspeccionar archivos y versiones existentes.
2. Proponer plan breve por etapas.
3. Diseñar base de datos y migraciones.
4. Implementar backend y probarlo.
5. Implementar frontend y conectarlo a la API.
6. Probar permisos, seguridad y flujos completos.
7. Completar documentación y preparar APK.

No continuar ignorando errores críticos. No borrar código funcional sin motivo. No afirmar que algo está terminado si no se implementó y verificó.
