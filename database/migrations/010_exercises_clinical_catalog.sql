-- 010_exercises_clinical_catalog.sql
-- Catálogo de ejercicios ampliado para prescripción clínica de kinesiología

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS body_zone VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS muscle_group VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS therapeutic_objective VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS equipment_needed VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS difficulty_level ENUM('Bajo', 'Medio', 'Alto') NOT NULL DEFAULT 'Bajo',
  ADD COLUMN IF NOT EXISTS contraindications TEXT NULL;

-- Índices para optimizar las consultas de filtrado clínico
ALTER TABLE exercises
  ADD INDEX IF NOT EXISTS idx_exercises_body_zone (body_zone),
  ADD INDEX IF NOT EXISTS idx_exercises_objective (therapeutic_objective),
  ADD INDEX IF NOT EXISTS idx_exercises_difficulty (difficulty_level),
  ADD INDEX IF NOT EXISTS idx_exercises_equipment (equipment_needed);

