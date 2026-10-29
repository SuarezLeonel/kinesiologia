-- 011_treatment_routines_and_versions.sql
-- Gestión de rutinas terapéuticas, prescripción de ejercicios y versionado clínico

CREATE TABLE IF NOT EXISTS treatment_routines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  treatment_id INT NOT NULL,
  patient_id INT NOT NULL,
  kinesiologist_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  parent_routine_id INT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  valid_from DATE NULL,
  valid_until DATE NULL,
  change_reason VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_routines_treatment (treatment_id),
  INDEX idx_routines_patient (patient_id),
  INDEX idx_routines_status (status, is_current),
  CONSTRAINT fk_routines_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE,
  CONSTRAINT fk_routines_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_routines_kine FOREIGN KEY (kinesiologist_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_routines_parent FOREIGN KEY (parent_routine_id) REFERENCES treatment_routines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  exercise_id INT NOT NULL,
  sets INT NULL DEFAULT 3,
  repetitions INT NULL DEFAULT 10,
  duration_seconds INT NULL DEFAULT NULL,
  rest_seconds INT NULL DEFAULT 60,
  weekly_frequency VARCHAR(100) NULL DEFAULT '3 veces por semana',
  body_side ENUM('Bilateral', 'Izquierdo', 'Derecho', 'No aplica') NOT NULL DEFAULT 'Bilateral',
  resistance_load VARCHAR(120) NULL DEFAULT NULL,
  custom_instructions TEXT NULL,
  execution_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_re_routine (routine_id, execution_order),
  INDEX idx_re_exercise (exercise_id),
  CONSTRAINT fk_re_routine FOREIGN KEY (routine_id) REFERENCES treatment_routines(id) ON DELETE CASCADE,
  CONSTRAINT fk_re_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

