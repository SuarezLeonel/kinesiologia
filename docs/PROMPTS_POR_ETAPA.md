# Prompts de desarrollo — Sistema de kinesiología

Usar en orden. Enviar un prompt por vez. Antes de cada etapa, revisar el estado real del repositorio.

---

## PROMPT 1 — Base de datos MySQL

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Implementá la base de datos MySQL del sistema de kinesiología siguiendo los requisitos.

Tareas:
1. Inspeccioná primero los archivos existentes y detectá si ya hay esquema, migraciones o conexión configurada.
2. Diseñá un modelo relacional para usuarios, roles, permisos, pacientes, turnos, historias clínicas, tratamientos, sesiones, ejercicios, mediciones, servicios, pagos, movimientos de sesiones, proveedores sociales, sesiones de autenticación y auditoría.
3. Aplicá claves primarias y foráneas, restricciones, índices, tipos adecuados, integridad referencial y transacciones donde sean necesarias.
4. Creá migraciones versionadas y reproducibles, más seeds con datos ficticios. No uses datos reales.
5. Documentá el diagrama entidad-relación y justificá 1FN, 2FN y 3FN con ejemplos concretos de dependencias y tablas.
6. Prepará un usuario administrador inicial mediante un procedimiento seguro; no codifiques una contraseña real.
7. Añadí instrucciones para crear, migrar, sembrar y restaurar la base de datos.

No desarrolles todavía todas las pantallas ni todos los endpoints. No dupliques tablas existentes si ya hay una solución válida. No guardes listas de IDs separadas por comas.

Verificá los scripts y ejecutá las comprobaciones disponibles. Si MySQL no está disponible, indicá claramente qué pudiste verificar y qué queda pendiente. Al finalizar, informá archivos creados/modificados, comandos ejecutados, resultados y decisiones pendientes.

---

## PROMPT 2 — Backend Node.js + Express

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Inspeccioná la base de datos y el código existente. Implementá el backend modular con Node.js, Express, MySQL y ES Modules (`"type": "module"`).

Requisitos:
1. Separá rutas, controladores, servicios, repositorios, esquemas de validación y middleware.
2. Configurá conexión MySQL, variables de entorno, `.env.example`, manejo centralizado de errores y respuestas consistentes.
3. Implementá consultas parametrizadas, validación de entradas, Helmet, CORS restringido, rate limiting y logging sin secretos ni datos clínicos.
4. Implementá registro, login, logout, JWT de acceso, refresh tokens con expiración y revocación, y recuperación de contraseña con un flujo seguro.
5. Implementá autorización en backend para administrador, kinesiólogo y recepcionista, incluyendo control de acceso por recurso. La recepcionista no debe acceder por defecto a notas clínicas ni diagnósticos.
6. Creá endpoints versionados `/api/v1` para autenticación y los módulos definidos en `docs/REQUISITOS.md`.
7. No utilices HTTP GET en endpoints de negocio. Usá POST para consultas y POST, PUT, PATCH o DELETE para las demás operaciones. Revisá también rutas auxiliares, documentación y pruebas para evitar GET accidentales.
8. Documentá la API con OpenAPI/Swagger y ejemplos de solicitudes, respuestas, roles y errores.
9. Añadí pruebas de autenticación, permisos, validación, acceso a historias clínicas y operaciones principales.

No simules la base de datos ni las integraciones. No afirmes que algo funciona si no se probó. No implementes aún pantallas móviles. Trabajá sobre la estructura existente, modificando solo lo necesario.

Al finalizar, ejecutá las pruebas disponibles y reportá archivos modificados, comandos, resultados reales y configuración externa pendiente. Corregí los errores introducidos antes de cerrar la etapa.

---

## PROMPT 3 — Frontend React Native + Expo

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Inspeccioná la versión de Expo, dependencias y estructura existentes antes de cambiar nada. Implementá el frontend con React Native, Expo y TypeScript, compatible con el backend existente.

Requisitos:
1. Configurá React Navigation con flujos separados de autenticación y aplicación privada.
2. Implementá Context API para autenticación y estado global; evitá agregar Redux salvo que exista una necesidad concreta.
3. Configurá Axios en un cliente centralizado, URL de API configurable y tratamiento consistente de errores.
4. Implementá persistencia segura de sesión con Expo SecureStore, renovación de tokens y cierre de sesión.
5. Usá React Hook Form y Zod para formularios y validación.
6. Implementá modo claro y oscuro, detección del tema del dispositivo, preferencia manual persistente, componentes reutilizables y diseño adaptable a teléfonos y tablets.
7. Creá las pantallas de autenticación, dashboard, pacientes, agenda, historias clínicas, tratamientos, sesiones, mediciones, ejercicios, pagos, estadísticas, usuarios y configuración indicadas en los requisitos.
8. Mostrá opciones según el rol, pero no confíes en el frontend para autorizar acciones: el backend sigue siendo la autoridad.
9. Incluí estados de carga, error, resultados vacíos, acceso denegado, confirmaciones visuales y validaciones junto a los campos. No uses `alert()`.
10. Usá componentes y servicios separados; no concentres toda la aplicación en `App.tsx`.

No uses datos simulados como si provinieran del servidor. No actualices Expo ni instales paquetes incompatibles sin necesidad. No uses `localhost` como URL final para una APK instalada en un teléfono físico.

Conectá primero autenticación y navegación; luego implementá las pantallas por módulo. Ejecutá las comprobaciones disponibles y reportá archivos, resultados y pendientes. No afirmes que una integración social funciona hasta configurarla y probarla.

---

## PROMPT 4 — Integración y verificación end-to-end

Leé `AGENTS.md` y `docs/REQUISITOS.md`. Inspeccioná el estado real del frontend, backend y base de datos. Esta etapa es para integrar y corregir, no para reconstruir el proyecto.

Verificá los flujos completos:
1. Registro, login, persistencia de sesión, renovación, logout y errores de autenticación.
2. Permisos efectivos de administrador, kinesiólogo y recepcionista.
3. CRUD de pacientes y sus validaciones.
4. Creación, modificación y cancelación de turnos, incluyendo prevención de superposiciones.
5. Acceso autorizado a historias clínicas.
6. Tratamientos, sesiones, mediciones y ejercicios.
7. Pagos, saldos y consumo de sesiones sin duplicaciones.
8. Dashboard y reportes alimentados por datos reales.
9. Modo claro/oscuro, navegación, formularios, carga, errores y pantallas vacías.
10. Conectividad desde un dispositivo móvil a una URL de backend accesible.

Comprobá que:
- No hay endpoints GET de negocio.
- No hay `alert()`.
- No existen secretos en el repositorio.
- Las consultas SQL están parametrizadas.
- Los endpoints privados verifican identidad, rol y acceso al recurso.
- No hay botones o formularios sin funcionamiento.
- No se muestran datos ficticios como reales.
- Los errores del servidor no filtran stack traces ni datos sensibles.

Ejecutá lint, pruebas unitarias e integración disponibles. Añadí o corregí pruebas donde sea necesario. Corregí solo los problemas encontrados y evitá refactorizaciones no relacionadas.

No declares que todo está correcto si una prueba no pudo ejecutarse. Entregá un resumen de verificaciones aprobadas, fallidas y pendientes, con los comandos utilizados.

---

## PROMPT 5 — Entrega, documentación y APK

Leé `AGENTS.md`, `docs/REQUISITOS.md` y la documentación existente. Prepará la entrega final sin reescribir módulos que ya funcionan.

Completá y verificá:
1. README principal con arquitectura, requisitos, instalación y ejecución.
2. Guía de configuración de variables de entorno, MySQL, migraciones y seeds.
3. Instrucciones separadas para frontend y backend.
4. Documentación OpenAPI de los endpoints, métodos HTTP, autenticación, roles, cuerpos, respuestas y errores.
5. Manual de usuario para cada rol.
6. Diagrama entidad-relación y explicación demostrable de 1FN, 2FN y 3FN.
7. Procedimiento de copias de seguridad y restauración.
8. `.gitignore`, `.env.example` sin secretos y scripts de desarrollo, lint y pruebas.
9. Revisión de seguridad y lista de limitaciones conocidas.
10. Configuración de EAS Build o alternativa compatible para generar una APK Android.

Antes de compilar, verificá que la URL de API sea accesible desde el teléfono físico y que no sea `localhost`. Revisá la compatibilidad de las dependencias y la configuración de Expo.

Intentá generar la APK si el entorno y las credenciales lo permiten. Si la compilación necesita ejecutar un servicio externo o una acción manual, dejá instrucciones exactas y señalá claramente que la APK todavía no se generó. No inventes una ruta de descarga.

Ejecutá las pruebas finales disponibles y entregá:
- Lista de funcionalidades completadas.
- Pruebas ejecutadas y resultados reales.
- Pasos de instalación y ejecución.
- Ubicación real de la APK, si se generó.
- Integraciones que requieren credenciales.
- Errores conocidos y tareas pendientes.

No declares el proyecto listo para producción si quedan fallos críticos de seguridad o funcionalidad.
