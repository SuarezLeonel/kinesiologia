-- ==========================================================
-- Migración 004: restricciones CHECK de integridad
-- Requiere que el motor las aplique. En TiDB: tidb_enable_check_constraint = ON
-- (el runner aborta si está desactivada, porque TiDB las ignoraría sin avisar).
-- Nota: en SQL un CHECK que evalúa a NULL no se considera violado, por lo que las
-- columnas opcionales no necesitan "IS NULL OR ..." (que además falla en TiDB sobre tablas con datos).
-- ==========================================================

ALTER TABLE clinical_records
  ADD CONSTRAINT chk_cr_pain CHECK (reported_pain_level BETWEEN 0 AND 10);

ALTER TABLE treatment_sessions
  ADD CONSTRAINT chk_ts_pain CHECK (pain_level_reported BETWEEN 0 AND 10);
ALTER TABLE treatment_sessions
  ADD CONSTRAINT chk_ts_number CHECK (session_number >= 1);

ALTER TABLE appointments
  ADD CONSTRAINT chk_app_time CHECK (end_time > start_time);

ALTER TABLE services
  ADD CONSTRAINT chk_services_duration CHECK (duration_minutes > 0);
ALTER TABLE services
  ADD CONSTRAINT chk_services_price CHECK (default_price >= 0);

ALTER TABLE treatments
  ADD CONSTRAINT chk_treatments_sessions CHECK (total_planned_sessions >= 1);
ALTER TABLE treatments
  ADD CONSTRAINT chk_treatments_dates CHECK (end_date >= start_date);

ALTER TABLE treatment_exercises
  ADD CONSTRAINT chk_te_sets CHECK (custom_sets > 0);
ALTER TABLE treatment_exercises
  ADD CONSTRAINT chk_te_reps CHECK (custom_repetitions > 0);

ALTER TABLE exercises
  ADD CONSTRAINT chk_ex_sets CHECK (default_sets > 0);
ALTER TABLE exercises
  ADD CONSTRAINT chk_ex_reps CHECK (default_repetitions > 0);

ALTER TABLE payment_packages
  ADD CONSTRAINT chk_pkg_total CHECK (total_sessions > 0);
ALTER TABLE payment_packages
  ADD CONSTRAINT chk_pkg_used CHECK (used_sessions >= 0 AND used_sessions <= total_sessions);
ALTER TABLE payment_packages
  ADD CONSTRAINT chk_pkg_price CHECK (price_total >= 0);

ALTER TABLE payments
  ADD CONSTRAINT chk_pay_amount CHECK (amount > 0);

ALTER TABLE package_session_transactions
  ADD CONSTRAINT chk_pst_balance CHECK (balance_after >= 0);
ALTER TABLE package_session_transactions
  ADD CONSTRAINT chk_pst_change CHECK (change_amount <> 0);
