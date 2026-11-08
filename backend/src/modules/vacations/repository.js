/**
 * @file repository.js
 * @module vacations
 * @description Capa de acceso a datos MySQL para las vacaciones de kinesiólogos.
 */
import { query } from '../../config/database.js';

export class VacationsRepository {
  async search({ kinesiologistId, startDate, endDate, status, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (kinesiologistId && kinesiologistId !== 'all') {
      conditions.push('kv.kinesiologist_id = ?');
      params.push(kinesiologistId);
    }

    if (status && status !== 'all') {
      conditions.push('kv.status = ?');
      params.push(status);
    }

    if (startDate) {
      conditions.push('kv.end_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('kv.start_date <= ?');
      params.push(endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT kv.id, kv.kinesiologist_id,
             DATE_FORMAT(kv.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(kv.end_date, '%Y-%m-%d') as end_date,
             kv.status, kv.notes,
             kv.affected_appointments_count, kv.created_by, kv.created_at, kv.updated_at,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name, u.email as kinesiologist_email,
             c.name as created_by_name, c.last_name as created_by_last_name
      FROM kinesiologist_vacations kv
      JOIN users u ON kv.kinesiologist_id = u.id
      JOIN users c ON kv.created_by = c.id
      ${where}
      ORDER BY kv.start_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    const rows = await query(sql, params);
    return rows.map((r) => this._mapRow(r));
  }

  _mapRow(row) {
    if (!row) return null;
    return {
      ...row,
      kinesiologistId: row.kinesiologist_id,
      startDate: row.start_date,
      endDate: row.end_date,
      affectedAppointmentsCount: Number(row.affected_appointments_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findById(id) {
    const rows = await query(`
      SELECT kv.id, kv.kinesiologist_id,
             DATE_FORMAT(kv.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(kv.end_date, '%Y-%m-%d') as end_date,
             kv.status, kv.notes,
             kv.affected_appointments_count, kv.created_by, kv.created_at, kv.updated_at,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name, u.email as kinesiologist_email
      FROM kinesiologist_vacations kv
      JOIN users u ON kv.kinesiologist_id = u.id
      WHERE kv.id = ?
      LIMIT 1
    `, [id]);
    return this._mapRow(rows[0]);
  }

  async findOverlapping(kinesiologistId, startDate, endDate, excludeId = null) {
    let sql = `
      SELECT id, kinesiologist_id, start_date, end_date, status
      FROM kinesiologist_vacations
      WHERE kinesiologist_id = ?
        AND status IN ('scheduled', 'active')
        AND (start_date <= ? AND end_date >= ?)
    `;
    const params = [kinesiologistId, endDate, startDate];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await query(sql, params);
    return rows[0] || null;
  }

  async isKinesiologistOnVacation(kinesiologistId, dateStr) {
    if (!kinesiologistId || !dateStr) return false;
    const cleanDate = String(dateStr).slice(0, 10);
    const rows = await query(`
      SELECT id, kinesiologist_id, start_date, end_date, status, notes
      FROM kinesiologist_vacations
      WHERE kinesiologist_id = ?
        AND status IN ('scheduled', 'active')
        AND ? >= start_date AND ? <= end_date
      LIMIT 1
    `, [kinesiologistId, cleanDate, cleanDate]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findAffectedAppointments(kinesiologistId, startDate, endDate) {
    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    return await query(`
      SELECT a.id, a.patient_id, a.kinesiologist_id, a.service_id, a.start_time, a.end_time, a.status, a.notes,
             a.agreed_price, a.currency,
             p.first_name as patient_first_name, p.last_name as patient_last_name, p.dni as patient_dni, p.phone as patient_phone,
             s.name as service_name, s.duration_minutes,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN services s ON a.service_id = s.id
      LEFT JOIN users u ON a.kinesiologist_id = u.id
      WHERE a.kinesiologist_id = ?
        AND a.status NOT IN ('cancelled', 'attended')
        AND a.start_time >= ? AND a.start_time <= ?
      ORDER BY a.start_time ASC
    `, [kinesiologistId, startOfDay, endOfDay]);
  }

  async create({ kinesiologistId, startDate, endDate, status = 'scheduled', notes = null, affectedAppointmentsCount = 0, createdBy }) {
    const result = await query(`
      INSERT INTO kinesiologist_vacations
        (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      kinesiologistId,
      startDate,
      endDate,
      status,
      notes,
      affectedAppointmentsCount,
      createdBy
    ]);
    return result.insertId;
  }

  async updateStatus(id, status, notes = null) {
    if (notes !== null) {
      await query('UPDATE kinesiologist_vacations SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
    } else {
      await query('UPDATE kinesiologist_vacations SET status = ? WHERE id = ?', [status, id]);
    }
  }

  async updateAffectedCount(id, count) {
    await query('UPDATE kinesiologist_vacations SET affected_appointments_count = ? WHERE id = ?', [count, id]);
  }

  async findActiveAlerts() {
    const rows = await query(`
      SELECT kv.id, kv.kinesiologist_id,
             DATE_FORMAT(kv.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(kv.end_date, '%Y-%m-%d') as end_date,
             kv.status, kv.notes,
             kv.affected_appointments_count,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name, u.phone as kinesiologist_phone,
             (
               SELECT COUNT(*)
               FROM appointments a
               WHERE a.kinesiologist_id = kv.kinesiologist_id
                 AND a.status NOT IN ('cancelled', 'attended')
                 AND a.start_time >= CONCAT(kv.start_date, ' 00:00:00')
                 AND a.start_time <= CONCAT(kv.end_date, ' 23:59:59')
             ) as pending_affected_count
      FROM kinesiologist_vacations kv
      JOIN users u ON kv.kinesiologist_id = u.id
      WHERE kv.status IN ('scheduled', 'active')
        AND kv.end_date >= CURDATE()
      HAVING pending_affected_count > 0
      ORDER BY kv.start_date ASC
    `);

    return rows.map((r) => ({
      ...r,
      kinesiologistId: r.kinesiologist_id,
      startDate: r.start_date,
      endDate: r.end_date,
      affectedAppointmentsCount: Number(r.affected_appointments_count || 0),
      pendingAffectedCount: Number(r.pending_affected_count || 0)
    }));
  }
}

export const vacationsRepository = new VacationsRepository();
