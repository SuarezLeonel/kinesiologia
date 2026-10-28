-- ==========================================================
-- Seeds ficticios para demostración y pruebas.
-- Roles/permisos: migración 002. Usuarios demo: backend/scripts/seed.js (bcrypt real).
-- Requiere que existan users con id 1..3 (los crea seed.js antes de este archivo).
-- ==========================================================

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
