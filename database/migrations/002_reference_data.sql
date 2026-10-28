-- ==========================================================
-- Datos de referencia requeridos por la aplicación (no son datos de demostración):
-- roles, permisos y su asignación. Idempotente.
-- ==========================================================

INSERT INTO roles (id, name, description) VALUES
(1, 'admin', 'Administrador total del consultorio y configuraciones'),
(2, 'kinesiologist', 'Profesional kinesiólogo con acceso a historias y sesiones'),
(3, 'receptionist', 'Recepcionista con acceso administrativo y turnos')
ON DUPLICATE KEY UPDATE description=VALUES(description);

INSERT INTO permissions (id, code, description) VALUES
(1, 'users:manage', 'Crear y administrar usuarios'),
(2, 'patients:read', 'Ver listado y datos de pacientes'),
(3, 'patients:write', 'Crear y editar pacientes'),
(4, 'appointments:manage', 'Gestionar agenda y turnos'),
(5, 'clinical_records:read', 'Ver historias clínicas y notas médicas'),
(6, 'clinical_records:write', 'Crear y actualizar historias clínicas'),
(7, 'treatments:manage', 'Gestionar planes y sesiones'),
(8, 'payments:manage', 'Registrar y consultar cobros y paquetes')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Admin: todos
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8);

-- Kinesiólogo: pacientes, turnos, historias, tratamientos
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7);

-- Recepcionista: pacientes administrativos, turnos, pagos (sin historias clínicas)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(3, 2), (3, 3), (3, 4), (3, 8);
