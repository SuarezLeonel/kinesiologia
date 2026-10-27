-- ==========================================================
-- Seeds ficticios para demostración y pruebas
-- Contraseña genérica de prueba: 'Password123!' (con hash bcrypt demostrativo)
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

-- Permisos Admin: todos
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8);

-- Permisos Kinesiólogo: pacientes, turnos, historias, tratamientos
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7);

-- Permisos Recepcionista: pacientes administrativos, turnos, pagos (sin historias clínicas)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(3, 2), (3, 3), (3, 4), (3, 8);

-- Usuarios de prueba ($2a$12$e0M2/LzW2P4kQvO/mQYgfe70bQ.4xJqI9s3g4zN/w89a4J8wZqg5y -> Password123!)
INSERT INTO users (id, role_id, name, last_name, email, password_hash, phone, is_active) VALUES
(1, 1, 'Laura', 'Admin', 'admin@kinesiologia.com', '$2b$10$v5yT9k4X/h0o8gZ6JkL.9uLd1W0zM2Qe5gA0nQZ1q2x3w4e5r6t7y', '+5491100010001', 1),
(2, 2, 'Carlos', 'Kinesio', 'carlos.kine@kinesiologia.com', '$2b$10$v5yT9k4X/h0o8gZ6JkL.9uLd1W0zM2Qe5gA0nQZ1q2x3w4e5r6t7y', '+5491100020002', 1),
(3, 3, 'Mariana', 'Recep', 'mariana.recep@kinesiologia.com', '$2b$10$v5yT9k4X/h0o8gZ6JkL.9uLd1W0zM2Qe5gA0nQZ1q2x3w4e5r6t7y', '+5491100030003', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO services (id, name, description, duration_minutes, default_price, is_active) VALUES
(1, 'Rehabilitación Traumatológica', 'Sesión kinesiológica para lesiones articulares y musculares', 45, 12000.00, 1),
(2, 'RPG (Reeducación Postural Global)', 'Método de evaluación y tratamiento postural', 60, 18000.00, 1),
(3, 'Fisioterapia y Kinesiología Deportiva', 'Recuperación de lesiones por actividad deportiva', 45, 15000.00, 1)
ON DUPLICATE KEY UPDATE default_price=VALUES(default_price);

INSERT INTO patients (id, first_name, last_name, dni, birth_date, phone, email, address, assigned_kinesiologist_id, is_active) VALUES
(1, 'Esteban', 'Pérez', '35123456', '1990-05-14', '+5491155551234', 'esteban.perez@ejemplo.com', 'Av. Santa Fe 2450, CABA', 2, 1),
(2, 'Florencia', 'Gómez', '38987654', '1995-10-22', '+5491155554321', 'florencia.gomez@ejemplo.com', 'Calle falsa 123, CABA', 2, 1)
ON DUPLICATE KEY UPDATE phone=VALUES(phone);

INSERT INTO exercises (id, name, category, description, instructions, default_sets, default_repetitions, media_url, is_active) VALUES
(1, 'Puente de glúteos', 'Fortalecimiento Lumbo-Pélvico', 'Activación de glúteo mayor e isquiotibiales con control de core', 'Elevar la pelvis manteniendo la alineación y sostener 3 segundos en el punto alto', 3, 12, 'https://example.com/exercises/puente-gluteo.mp4', 1),
(2, 'Movilidad cervical en flexo-extensión', 'Movilidad Articular', 'Rango de movimiento controlado para columna cervical', 'Realizar movimientos lentos y controlados sin provocar dolor punzante', 2, 10, 'https://example.com/exercises/cervical-flex.mp4', 1)
ON DUPLICATE KEY UPDATE category=VALUES(category);
