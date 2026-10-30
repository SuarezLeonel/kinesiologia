/**
 * @file repository.js
 * @module appointments
 * @description Capa de acceso a datos para la agenda de turnos en MySQL / TiDB.
 * Ejecuta consultas parametrizadas para evitar solapamientos, filtrar por profesional y actualizar estados.
 */
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
             a.service_id, s.name as service_name, a.start_time, a.end_time, a.status, a.notes,
             a.agreed_price, a.currency, a.created_at
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
        INSERT INTO appointments (patient_id, kinesiologist_id, service_id, start_time, end_time, status, notes, agreed_price, currency, created_by)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `, [
        data.patientId,
        data.kinesiologistId,
        data.serviceId,
        data.startTime,
        data.endTime,
        data.notes || null,
        data.agreedPrice || 0,
        data.currency || 'ARS',
        data.createdBy
      ]);

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

  // ==========================================
  // Solicitudes de Reprogramación
  // ==========================================

  async createRescheduleRequest({ appointmentId, patientId, requestedStartTime, requestedEndTime, reason }) {
    const result = await query(`
      INSERT INTO appointment_reschedule_requests (appointment_id, patient_id, requested_start_time, requested_end_time, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [appointmentId, patientId, requestedStartTime, requestedEndTime, reason || null]);
    return result.insertId;
  }

  async findRescheduleRequestById(id) {
    const rows = await query(`
      SELECT r.*, a.kinesiologist_id, a.service_id, a.start_time as current_start_time, a.end_time as current_end_time,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             s.name as service_name
      FROM appointment_reschedule_requests r
      JOIN appointments a ON r.appointment_id = a.id
      JOIN patients p ON r.patient_id = p.id
      JOIN services s ON a.service_id = s.id
      WHERE r.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findRescheduleRequests({ status, patientId, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (patientId) {
      conditions.push('r.patient_id = ?');
      params.push(patientId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT r.id, r.appointment_id, r.patient_id, r.requested_start_time, r.requested_end_time,
             r.reason, r.status, r.response_notes, r.created_at, r.updated_at,
             a.start_time as current_start_time, a.end_time as current_end_time, a.kinesiologist_id,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             s.name as service_name
      FROM appointment_reschedule_requests r
      JOIN appointments a ON r.appointment_id = a.id
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON a.kinesiologist_id = u.id
      JOIN services s ON a.service_id = s.id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async approveRescheduleAtomic(requestId, userId, responseNotes) {
    return await executeTransaction(async (conn) => {
      const [reqRows] = await conn.execute(
        'SELECT * FROM appointment_reschedule_requests WHERE id = ? FOR UPDATE',
        [requestId]
      );
      if (reqRows.length === 0) {
        throw new ConflictError('Solicitud de reprogramación no encontrada');
      }
      const req = reqRows[0];
      if (req.status !== 'pending') {
        throw new ConflictError(`La solicitud ya se encuentra ${req.status}`);
      }

      const [appRows] = await conn.execute(
        'SELECT * FROM appointments WHERE id = ? FOR UPDATE',
        [req.appointment_id]
      );
      if (appRows.length === 0) {
        throw new ConflictError('Turno no encontrado');
      }
      const app = appRows[0];

      // Verificar superposición en el nuevo horario
      const [overlaps] = await conn.execute(`
        SELECT id FROM appointments
        WHERE kinesiologist_id = ?
          AND id != ?
          AND status NOT IN ('cancelled')
          AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
        FOR UPDATE
      `, [app.kinesiologist_id, app.id, req.requested_end_time, req.requested_start_time, req.requested_start_time, req.requested_end_time]);

      if (overlaps.length > 0) {
        throw new ConflictError('El profesional ya tiene otro turno confirmado en el nuevo horario solicitado');
      }

      // Actualizar turno
      await conn.execute(`
        UPDATE appointments
        SET start_time = ?, end_time = ?, status = 'confirmed'
        WHERE id = ?
      `, [req.requested_start_time, req.requested_end_time, app.id]);

      // Actualizar solicitud
      await conn.execute(`
        UPDATE appointment_reschedule_requests
        SET status = 'approved', responded_by = ?, response_notes = ?
        WHERE id = ?
      `, [userId, responseNotes || 'Reprogramación aprobada por el consultorio', requestId]);

      // Guardar historial
      await conn.execute(`
        INSERT INTO appointment_history (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, reason)
        VALUES (?, ?, 'confirmed', ?, ?, ?, ?)
      `, [
        app.id,
        app.status,
        app.start_time,
        req.requested_start_time,
        userId,
        `Reprogramación aprobada: ${responseNotes || 'Aprobada'}`
      ]);

      return { success: true, appointmentId: app.id };
    });
  }

  async rejectReschedule(requestId, userId, responseNotes) {
    await query(`
      UPDATE appointment_reschedule_requests
      SET status = 'rejected', responded_by = ?, response_notes = ?
      WHERE id = ? AND status = 'pending'
    `, [userId, responseNotes || 'No es posible reprogramar en el horario solicitado', requestId]);
    return { success: true };
  }

  async findProfessionals() {
    return await query(`
      SELECT u.id, u.name, u.last_name, u.email, u.phone
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'kinesiologist' AND u.is_active = 1
      ORDER BY u.last_name ASC, u.name ASC
    `);
  }
}

export const appointmentsRepository = new AppointmentsRepository();
