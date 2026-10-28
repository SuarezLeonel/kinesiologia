import { query, executeTransaction } from '../../config/database.js';
import { ConflictError } from '../../utils/errors.js';

export class AppointmentsRepository {
  async search({ kinesiologistId, patientId, startDate, endDate, status, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (kinesiologistId) { conditions.push('a.kinesiologist_id = ?'); params.push(kinesiologistId); }
    if (patientId) { conditions.push('a.patient_id = ?'); params.push(patientId); }
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (startDate) { conditions.push('a.start_time >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('a.end_time <= ?'); params.push(endDate); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT a.id, a.patient_id, p.first_name as patient_first_name, p.last_name as patient_last_name,
             a.kinesiologist_id, u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             a.service_id, s.name as service_name, a.start_time, a.end_time, a.status, a.notes, a.created_at
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.kinesiologist_id = u.id
      JOIN services s ON a.service_id = s.id
      ${whereClause}
      ORDER BY a.start_time ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             s.name as service_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.kinesiologist_id = u.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async checkOverlap(kinesiologistId, startTime, endTime, excludeAppointmentId = null) {
    let sql = `
      SELECT id FROM appointments
      WHERE kinesiologist_id = ?
        AND status NOT IN ('cancelled')
        AND (
          (start_time < ? AND end_time > ?) OR
          (start_time >= ? AND start_time < ?)
        )
    `;
    const params = [kinesiologistId, endTime, startTime, startTime, endTime];
    if (excludeAppointmentId) {
      sql += ' AND id != ?';
      params.push(excludeAppointmentId);
    }
    sql += ' LIMIT 1';
    const rows = await query(sql, params);
    return rows.length > 0;
  }

  async create(data) {
    return await executeTransaction(async (conn) => {
      // Bloqueo y verificación atómica de superposición
      const [overlaps] = await conn.execute(`
        SELECT id FROM appointments
        WHERE kinesiologist_id = ?
          AND status NOT IN ('cancelled')
          AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
        FOR UPDATE
      `, [data.kinesiologistId, data.endTime, data.startTime, data.startTime, data.endTime]);

      if (overlaps.length > 0) {
        throw new ConflictError('El profesional ya tiene un turno agendado en ese horario');
      }

      const [result] = await conn.execute(`
        INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `, [data.patientId, data.kinesiologistId, data.serviceId, data.startTime, data.endTime, data.notes || null, data.createdBy]);

      await conn.execute(`
        INSERT INTO appointment_history (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, reason)
        VALUES (?, NULL, 'pending', NULL, ?, ?, 'Creación inicial del turno')
      `, [result.insertId, data.startTime, data.createdBy]);

      return result.insertId;
    });
  }

  async updateWithHistory(id, fields, userId) {
    return await executeTransaction(async (conn) => {
      const [current] = await conn.execute(
        'SELECT kinesiologist_id, status, start_time, end_time FROM appointments WHERE id = ? FOR UPDATE',
        [id]
      );
      if (current.length === 0) return null;

      const app = current[0];
      const previousStatus = app.status;
      const previousStartTime = app.start_time;

      const targetStart = fields.startTime || app.start_time;
      const targetEnd = fields.endTime || app.end_time;

      // Si se altera horario o estado activo, verificar superposición de forma atómica
      if (fields.startTime || fields.endTime) {
        const [overlaps] = await conn.execute(`
          SELECT id FROM appointments
          WHERE kinesiologist_id = ?
            AND id != ?
            AND status NOT IN ('cancelled')
            AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
          FOR UPDATE
        `, [app.kinesiologist_id, id, targetEnd, targetStart, targetStart, targetEnd]);

        if (overlaps.length > 0) {
          throw new ConflictError('El nuevo horario genera una superposición con otro turno del profesional');
        }
      }

      const updates = [];
      const params = [];
      if (fields.status) { updates.push('status = ?'); params.push(fields.status); }
      if (fields.startTime) { updates.push('start_time = ?'); params.push(fields.startTime); }
      if (fields.endTime) { updates.push('end_time = ?'); params.push(fields.endTime); }
      if (fields.notes !== undefined) { updates.push('notes = ?'); params.push(fields.notes); }

      if (updates.length > 0) {
        params.push(id);
        await conn.execute(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      await conn.execute(`
        INSERT INTO appointment_history (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        previousStatus,
        fields.status || previousStatus,
        previousStartTime,
        fields.startTime || previousStartTime,
        userId,
        fields.reason || 'Actualización de turno'
      ]);
    });
  }
}

export const appointmentsRepository = new AppointmentsRepository();
