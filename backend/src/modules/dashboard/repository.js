/**
 * @file repository.js
 * @module dashboard
 * @description Consultas agregadas para métricas operativas del día y resumen de recaudación financiera.
 */
import { query } from '../../config/database.js';
import { getClinicDayBounds } from '../../utils/date.js';

export class DashboardRepository {
  async getAppointmentsMetrics(targetDate, kinesiologistId = null) {
    const { start, end } = getClinicDayBounds(targetDate);
    const conditions = ['start_time >= ? AND start_time <= ?'];
    const params = [start, end];

    if (kinesiologistId) {
      conditions.push('kinesiologist_id = ?');
      params.push(kinesiologistId);
    }

    const rows = await query(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END), 0) as attended,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
             COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed,
             COALESCE(SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END), 0) as absent,
             COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled
      FROM appointments
      WHERE ${conditions.join(' AND ')}
    `, params);

    return rows[0] || { total: 0, attended: 0, pending: 0, confirmed: 0, absent: 0, cancelled: 0 };
  }

  async getActivePatientsCount(kinesiologistId = null) {
    if (kinesiologistId) {
      const rows = await query(
        'SELECT COUNT(*) as total FROM patients WHERE is_active = 1 AND assigned_kinesiologist_id = ?',
        [kinesiologistId]
      );
      return rows[0]?.total || 0;
    }
    const rows = await query('SELECT COUNT(*) as total FROM patients WHERE is_active = 1');
    return rows[0]?.total || 0;
  }

  async getActiveTreatmentsCount(kinesiologistId = null) {
    if (kinesiologistId) {
      const rows = await query(
        'SELECT COUNT(*) as total FROM treatments WHERE status = "active" AND kinesiologist_id = ?',
        [kinesiologistId]
      );
      return rows[0]?.total || 0;
    }
    const rows = await query('SELECT COUNT(*) as total FROM treatments WHERE status = "active"');
    return rows[0]?.total || 0;
  }

  async getFinancialMetrics(targetDate) {
    const { start, end } = getClinicDayBounds(targetDate);
    const rows = await query(`
      SELECT COALESCE(SUM(amount), 0) as totalIncome, COUNT(*) as transactionsCount
      FROM payments
      WHERE payment_date >= ? AND payment_date <= ?
    `, [start, end]);

    return {
      totalIncome: Number(rows[0]?.totalIncome || 0),
      transactionsCount: Number(rows[0]?.transactionsCount || 0)
    };
  }
}

export const dashboardRepository = new DashboardRepository();
