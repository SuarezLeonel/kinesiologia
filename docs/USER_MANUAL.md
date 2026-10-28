# Manual de Usuario por Rol — Sistema de Kinesiología

Este documento detalla las funciones, pantallas y permisos disponibles para cada uno de los tres perfiles del sistema.

---

## 1. Administrador (Admin)

### Responsabilidades
Gestión integral de usuarios, asignación de roles, tarifario y servicios, configuraciones del consultorio y reportes ejecutivos.

### Funcionalidades y Pantallas
1. **Inicio / Dashboard:**
   - Visualización global de turnos del día, pacientes activos, tratamientos en curso y el bloque de **Recaudación Financiera Diaria** (total facturado y número de operaciones).
2. **Gestión de Agenda:**
   - Crear, reprogramar y cancelar turnos para cualquier kinesiólogo del centro sin superposición horaria.
3. **Pacientes:**
   - Alta, modificación de datos de contacto y desactivación lógica de pacientes.
4. **Historias Clínicas:**
   - Acceso completo de consulta y auditoría de cambios sobre notas clínicas y diagnósticos.
5. **Catálogo de Ejercicios:**
   - Crear nuevos ejercicios, definir categorías, series y repeticiones sugeridas.
6. **Caja y Cobros:**
   - Registrar cobros directos por servicio o compras de paquetes de sesiones de pacientes. Descuento de sesiones consumidas.
7. **Ajustes:**
   - Alternar modo claro / oscuro manual o sincronizado con el sistema. Cierre de sesión seguro con invalidación de tokens.

---

## 2. Kinesiólogo (Profesional Clínico)

### Responsabilidades
Atención a pacientes, evaluación inicial, redacción y actualización de historias clínicas, indicación de tratamientos y planes de ejercicios.

### Funcionalidades y Pantallas
1. **Inicio / Dashboard:**
   - Visualización de sus turnos programados del día, estado de asistencia y tratamientos activos a su cargo. *(No visualiza información financiera de recaudación)*.
2. **Agenda:**
   - Consulta de horarios asignados y actualización del estado del turno (`attended`, `cancelled`, `absent`).
3. **Pacientes:**
   - Ficha administrativa y acceso directo al expediente clínico del paciente.
4. **Historias Clínicas:**
   - Redacción de motivo de consulta, diagnósticos, nivel de dolor percibido (escala 0-10) y evaluación funcional.
   - Cada actualización exige registrar el motivo del cambio, garantizando trazabilidad médica inmutable.
5. **Ejercicios:**
   - Consulta del catálogo de ejercicios para asignación de rutinas y prescripción de frecuencia/series.
6. **Restricción de Seguridad:**
   - No tiene acceso al módulo de cobros administrativos (`/payments`). El backend bloquea cualquier intento con `403 Forbidden`.

---

## 3. Recepcionista (Personal Administrativo)

### Responsabilidades
Recepción de pacientes, administración de la agenda diaria, asistencia y gestión de cobros en caja.

### Funcionalidades y Pantallas
1. **Inicio / Dashboard:**
   - Resumen del flujo de turnos del día (presentes, pendientes, ausentes) y control de ingresos de caja diaria.
2. **Agenda:**
   - Coordinación de turnos, confirmación de asistencia y reprogramaciones.
3. **Pacientes:**
   - Registro de nuevos pacientes, validación de DNI y actualización de datos de contacto.
4. **Caja y Cobros:**
   - Registro de pagos en efectivo, transferencia, débito o crédito. Creación de paquetes de sesiones para pacientes.
5. **Restricción Estricta de Seguridad Médica:**
   - **No tiene acceso a notas clínicas ni diagnósticos.**
   - La pestaña de *Historias Clínicas* está oculta en su interfaz, y cualquier petición directa a `/clinical-records` es denegada por el backend con un código `403 Forbidden`.

---

## 4. Usuarios Ficticios de Demostración

Para probar los tres perfiles en el entorno local o en la app móvil, se encuentran disponibles las siguientes credenciales de prueba:

| Rol | Correo Electrónico | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin@kinesiologia.com` | `Password123!` |
| **Kinesiólogo** | `carlos.kine@kinesiologia.com` | `Password123!` |
| **Recepcionista** | `mariana.recep@kinesiologia.com` | `Password123!` |
