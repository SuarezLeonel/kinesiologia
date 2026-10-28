-- ==========================================================
-- Migración 006: Registro de Pacientes, Cuentas y Gestión de Turnos
-- Ficha de paciente independiente de la cuenta de usuario
-- ==========================================================

-- 1. Rol de paciente en tabla roles (idempotente)
INSERT INTO roles (id, name, description) VALUES
(4, 'patient', 'Paciente con acceso a portal personal, turnos propios y perfil')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- 2. Permisos específicos para pacientes
INSERT INTO permissions (id, code, description) VALUES
(9, 'patient_portal:access', 'Acceso al portal de autogestión de pacientes'),
(10, 'my_appointments:manage', 'Gestionar y consultar turnos propios')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Asignar permisos al rol paciente
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(4, 9), (4, 10);

-- 3. Vincular pacientes con cuenta de usuario opcional (1 a 1 o 1 a 0)
-- Una ficha de paciente existe independientemente de si el usuario tiene cuenta.
-- user_id es NULL por defecto y UNIQUE para evitar que una cuenta se vincule con múltiples fichas.
SET @exist_user_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'patients' 
    AND COLUMN_NAME = 'user_id'
);

SET @sql_add_user_id := IF(
  @exist_user_id = 0,
  'ALTER TABLE patients ADD COLUMN user_id INT NULL AFTER assigned_kinesiologist_id',
  'SELECT 1'
);
PREPARE stmt1 FROM @sql_add_user_id;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @exist_uq_user_id := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND INDEX_NAME = 'uq_patient_user'
);

SET @sql_add_uq_user_id := IF(
  @exist_uq_user_id = 0,
  'ALTER TABLE patients ADD UNIQUE INDEX uq_patient_user (user_id)',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql_add_uq_user_id;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @exist_fk_user := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'patients'
    AND CONSTRAINT_NAME = 'fk_patients_user'
);

SET @sql_add_fk_user := IF(
  @exist_fk_user = 0,
  'ALTER TABLE patients ADD CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql_add_fk_user;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 4. Precio acordado al reservar en tabla appointments (snapshot inmutable de tarifa)
SET @exist_price := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'appointments' 
    AND COLUMN_NAME = 'agreed_price'
);

SET @sql_add_price := IF(
  @exist_price = 0,
  'ALTER TABLE appointments ADD COLUMN agreed_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER notes',
  'SELECT 1'
);
PREPARE stmt4 FROM @sql_add_price;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

SET @exist_curr := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'appointments' 
    AND COLUMN_NAME = 'currency'
);

SET @sql_add_curr := IF(
  @exist_curr = 0,
  'ALTER TABLE appointments ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT \'ARS\' AFTER agreed_price',
  'SELECT 1'
);
PREPARE stmt5 FROM @sql_add_curr;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

-- 5. Tabla de solicitudes de reprogramación de turnos
CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  patient_id INT NOT NULL,
  requested_start_time DATETIME NOT NULL,
  requested_end_time DATETIME NOT NULL,
  reason TEXT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  responded_by INT NULL,
  response_notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_arr_patient (patient_id, status),
  INDEX idx_arr_appointment (appointment_id),
  CONSTRAINT fk_arr_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_arr_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_arr_responder FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla de notificaciones del sistema
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  patient_id INT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  channel ENUM('in_app', 'email', 'push') NOT NULL DEFAULT 'in_app',
  status ENUM('pending', 'sent', 'failed', 'read') NOT NULL DEFAULT 'sent',
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, status),
  INDEX idx_notif_patient (patient_id, status),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
