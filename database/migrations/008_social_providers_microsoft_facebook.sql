-- ==========================================================
-- Migración 008: Soporte para proveedores sociales Google, Microsoft y Facebook
-- ==========================================================

ALTER TABLE social_accounts
  MODIFY COLUMN provider ENUM('google', 'facebook', 'microsoft', 'apple') NOT NULL;

