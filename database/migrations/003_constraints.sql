-- ==========================================================
-- Migración 003: unicidad de negocio e índices
-- ==========================================================

ALTER TABLE treatment_sessions
  ADD UNIQUE KEY uq_ts_treatment_number (treatment_id, session_number);

ALTER TABLE appointments
  ADD INDEX idx_appointments_status (status, start_time);

ALTER TABLE treatment_exercises
  ADD UNIQUE KEY uq_te_treatment_exercise (treatment_id, exercise_id);

ALTER TABLE payments
  ADD UNIQUE KEY uq_payments_receipt (receipt_number);
