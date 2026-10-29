-- ==========================================================
-- Migración 007: Campos extendidos para usuarios (Kinesiólogos y Administradores)
-- ==========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS dni VARCHAR(20) NULL AFTER last_name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number VARCHAR(50) NULL AFTER phone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(120) NULL AFTER license_number;

