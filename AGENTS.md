# AGENTS.md — Reglas permanentes del proyecto

## Objetivo
Sistema móvil de gestión para un consultorio de kinesiología. Construir una aplicación funcional, segura, documentada y mantenible.

## Stack
- Frontend: React Native, Expo y TypeScript.
- Navegación: React Navigation.
- Estado global: Context API, salvo que la complejidad justifique Redux Toolkit.
- Formularios y validación: React Hook Form y Zod.
- HTTP: Axios.
- Almacenamiento seguro móvil: Expo SecureStore.
- Backend: Node.js, Express y JavaScript con ES Modules (`"type": "module"`).
- Base de datos: MySQL y `mysql2`.
- Autenticación: JWT de acceso y refresh tokens.
- Pruebas: herramientas compatibles con las versiones instaladas; documentar qué se ejecutó realmente.

## Restricciones obligatorias
- No usar HTTP GET en endpoints de negocio. Las consultas se realizan mediante POST con el identificador/filtros en el cuerpo cuando corresponda.
- No utilizar `alert()` en el frontend.
- Usar `import`/`export` de ES Modules en el backend y extensiones `.js` en imports relativos cuando corresponda.
- No confiar en roles o permisos enviados por el cliente: autorizarlos en el backend en cada endpoint protegido.
- No exponer secretos, contraseñas, tokens ni datos clínicos en logs.
- No almacenar contraseñas en texto plano.
- Utilizar consultas SQL parametrizadas.
- Validar datos tanto en frontend como en backend.
- Mantener los datos clínicos restringidos a profesionales autorizados.
- No simular integraciones ni afirmar que una funcionalidad fue probada si no lo fue.
- No dejar botones, formularios ni endpoints sin implementar.
- No instalar, actualizar ni reemplazar dependencias sin verificar necesidad y compatibilidad.

## Roles mínimos
- Administrador: usuarios, roles, configuración y reportes administrativos.
- Kinesiólogo: agenda, pacientes autorizados, historias clínicas, evaluaciones, tratamientos, sesiones, ejercicios y evolución.
- Recepcionista: datos administrativos, agenda, asistencia y cobros; sin acceso por defecto a notas clínicas ni diagnósticos.

## Forma de trabajo
1. Inspeccionar el proyecto y las versiones existentes antes de modificar archivos.
2. Leer `docs/REQUISITOS.md` antes de implementar una funcionalidad.
3. Trabajar en tareas pequeñas y delimitadas.
4. Modificar solo los archivos necesarios; evitar reescrituras completas sin motivo.
5. Reutilizar código y componentes existentes.
6. Ejecutar las pruebas relevantes después de cada cambio y corregir los errores introducidos.
7. Revisar el diff antes de terminar.
8. Mantener documentación breve y actualizada.
9. Al cerrar cada etapa, informar archivos modificados, pruebas ejecutadas y pendientes.
10. No reconstruir módulos funcionales ni repetir análisis generales innecesariamente.

## Calidad
- Código modular, nombres descriptivos, indentación consistente y responsabilidades separadas.
- Sin duplicación evitable, imports sin usar ni errores silenciados.
- Configuración mediante variables de entorno y `.env.example` sin secretos reales.
- Migraciones versionadas y datos de demostración ficticios.
- Git con commits claros.
