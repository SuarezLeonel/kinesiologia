# Instrucciones por etapa para Antigravity

Usá una sola instrucción por vez. Esperá a que termine y revisá los resultados antes de pasar a la siguiente.

## Inicio — inspección y planificación

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Inspeccioná la estructura y las versiones existentes sin modificar archivos todavía. Entregá un plan breve por etapas, riesgos técnicos y decisiones que necesiten configuración externa. No vuelvas a copiar la especificación completa en la respuesta. Esperá mi aprobación antes de implementar.

## Etapa 1 — arquitectura y base de datos

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Implementá el esquema relacional MySQL, migraciones versionadas, restricciones, índices y datos de demostración ficticios. Documentá el diagrama entidad-relación y justificá 1FN, 2FN y 3FN con ejemplos concretos. No uses datos reales. Ejecutá las comprobaciones disponibles e informá archivos, pruebas y pendientes. No empieces todavía la aplicación móvil completa.

## Etapa 2 — backend base y seguridad

Implementá la estructura modular de Express con ES Modules, conexión MySQL, configuración mediante variables de entorno, validación, manejo centralizado de errores, logging seguro, Helmet, CORS restringido y rate limiting. Añadí pruebas básicas y documentación OpenAPI. Cumplí la regla de no usar GET en endpoints de negocio. No implementes todavía todos los módulos de dominio; primero verificá que la base del servidor funciona.

## Etapa 3 — autenticación y roles

Implementá registro, login, logout, refresh tokens, revocación y autorización para administrador, kinesiólogo y recepcionista. No permitas asignación pública de privilegios. Protegé cada endpoint en el backend y restringí los datos clínicos por rol y recurso. Prepará Google, Facebook y Apple sin fingir que están configurados si faltan credenciales. Añadí pruebas de acceso permitido y denegado. No continúes hasta corregir errores críticos.

## Etapa 4 — módulos de negocio

Implementá, en este orden:
1. Pacientes.
2. Turnos y prevención de superposiciones.
3. Historias clínicas.
4. Tratamientos y sesiones.
5. Mediciones y ejercicios.
6. Pagos.
7. Dashboard y reportes.

Para cada módulo, implementá esquema/validación, ruta, controlador, servicio, repositorio, permisos, pruebas y documentación. Reutilizá la arquitectura existente. No reescribas módulos ya terminados.

## Etapa 5 — frontend y navegación

Implementá la estructura React Native + Expo + TypeScript, navegación, Context API, cliente Axios, formularios validados, SecureStore y temas claro/oscuro. Construí pantallas de autenticación y layouts compartidos primero. Usá una API configurable mediante variables de entorno o configuración de build. No uses localhost para una APK destinada a un teléfono físico.

## Etapa 6 — pantallas y conexión real

Conectá cada pantalla a los endpoints reales. Implementá estados de carga, error, vacío, confirmaciones visuales y permisos por rol. No uses datos mock como si fueran datos reales. Trabajá por módulo y probá el flujo completo antes de pasar al siguiente.

## Etapa 7 — auditoría y pruebas finales

Ejecutá lint, pruebas unitarias y de integración disponibles. Revisá que no haya endpoints GET de negocio, usos de alert(), secretos en Git, consultas SQL sin parametrizar, rutas sin autorización, imports rotos ni botones sin funcionalidad. Corregí los errores encontrados y reportá honestamente las pruebas que no pudieron ejecutarse.

## Etapa 8 — documentación y APK

Completá README, manual de usuario, guía de instalación, documentación OpenAPI, diagrama entidad-relación, normalización y guía de backups/restauración. Configurá la compilación Android mediante EAS Build o alternativa compatible. Generá la APK si el entorno lo permite; si no, documentá comandos exactos y aclaralo. No afirmes que existe un archivo que no se haya generado.

## Plantilla para una tarea pequeña

Leé `AGENTS.md` y la sección relevante de `docs/REQUISITOS.md`. Implementá únicamente: [DESCRIBIR UNA TAREA CONCRETA]. Inspeccioná los archivos relacionados, modificá lo mínimo necesario, reutilizá el código existente y ejecutá las pruebas relevantes. No rehagas el proyecto ni imprimas archivos completos sin necesidad. Al finalizar, informá archivos modificados, pruebas ejecutadas y pendientes.
