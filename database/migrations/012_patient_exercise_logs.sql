-- 012_patient_exercise_logs.sql
-- Registro de cumplimiento y feedback informado por el paciente sobre sus ejercicios

CREATE TABLE IF NOT EXISTS patient_exercise_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  user_id INT NOT NULL,
  routine_id INT NOT NULL,
  routine_exercise_id INT NOT NULL,
  exercise_id INT NOT NULL,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sets_completed INT NULL,
  reps_completed INT NULL,
  perceived_pain_level INT NULL,
  patient_notes TEXT NULL,
  INDEX idx_pel_patient_date (patient_id, completed_date),
  INDEX idx_pel_routine_ex (routine_exercise_id, completed_date),
  CONSTRAINT fk_pel_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_pel_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pel_routine FOREIGN KEY (routine_id) REFERENCES treatment_routines(id) ON DELETE CASCADE,
  CONSTRAINT fk_pel_re FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON DELETE CASCADE,
  CONSTRAINT fk_pel_ex FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

