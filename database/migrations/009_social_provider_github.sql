-- ==========================================================
-- Migración 009: Soporte para proveedor social GitHub
-- ==========================================================

ALTER TABLE social_accounts
  MODIFY COLUMN provider ENUM('google', 'facebook', 'github', 'microsoft', 'apple') NOT NULL;

