-- 013_session_exercise_executions.sql
-- Registro clínico de ejercicios ejecutados en sesión profesional, tolerancia y evolución

CREATE TABLE IF NOT EXISTS session_exercise_executions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  treatment_id INT NOT NULL,
  routine_id INT NULL,
  routine_exercise_id INT NULL,
  exercise_id INT NOT NULL,
  kinesiologist_id INT NOT NULL,
  sets_completed INT NOT NULL,
  reps_completed INT NOT NULL,
  resistance_load VARCHAR(120) NULL,
  tolerance_level ENUM('Excelente', 'Buena', 'Regular', 'Mala', 'Intolerancia') NOT NULL DEFAULT 'Buena',
  pain_level_reported TINYINT UNSIGNED NULL,
  clinical_observations TEXT NULL,
  future_modifications_suggested TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_see_session (session_id),
  INDEX idx_see_treatment (treatment_id),
  INDEX idx_see_routine (routine_id),
  INDEX idx_see_exercise (exercise_id),
  INDEX idx_see_kine (kinesiologist_id),
  CONSTRAINT fk_see_session FOREIGN KEY (session_id) REFERENCES treatment_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_see_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE,
  CONSTRAINT fk_see_routine FOREIGN KEY (routine_id) REFERENCES treatment_routines(id) ON DELETE SET NULL,
  CONSTRAINT fk_see_routine_ex FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON DELETE SET NULL,
  CONSTRAINT fk_see_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
  CONSTRAINT fk_see_kine FOREIGN KEY (kinesiologist_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

