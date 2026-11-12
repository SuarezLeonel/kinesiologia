/**
 * @file repository.js
 * @module vacations
 * @description Capa de acceso a datos MySQL para las vacaciones de kinesiólogos.
 */
import { query, executeTransaction } from '../../config/database.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors.js';

export const VACATION_CANCELLATION_REASON = 'Vacaciones del kinesiólogo';

const VACATION_SELECT_COLUMNS = `
  kv.id, kv.kinesiologist_id,
  DATE_FORMAT(kv.start_date, '%Y-%m-%d') as start_date,
  DATE_FORMAT(kv.end_date, '%Y-%m-%d') as end_date,
  kv.status, kv.notes,
  kv.affected_appointments_count,
  DATE_FORMAT(kv.cancelled_at, '%Y-%m-%d %H:%i:%s') as cancelled_at,
  kv.cancelled_by,
  kv.cancellation_reason,
  DATE_FORMAT(kv.effective_end_date, '%Y-%m-%d') as effective_end_date,
  kv.created_by, kv.created_at, kv.updated_at,
  u.name as kinesiologist_name, u.last_name as kinesiologist_last_name, u.email as kinesiologist_email,
  c.name as created_by_name, c.last_name as created_by_last_name,
  cr.name as created_by_role,
  cb.name as cancelled_by_name, cb.last_name as cancelled_by_last_name,
  cbr.name as cancelled_by_role
`;

const VACATION_BASE_JOINS = `
  FROM kinesiologist_vacations kv
  JOIN users u ON kv.kinesiologist_id = u.id
  LEFT JOIN users c ON kv.created_by = c.id
  LEFT JOIN roles cr ON c.role_id = cr.id
  LEFT JOIN users cb ON kv.cancelled_by = cb.id
  LEFT JOIN roles cbr ON cb.role_id = cbr.id
`;

/**
 * Construye el mensaje personalizado de WhatsApp para un turno cancelado por vacaciones.
 */
export function buildVacationWhatsAppMessage({
  patientFirstName,
  dateDisplay,
  timeDisplay,
  kinesiologistFullName
}) {
  const safePatient = (patientFirstName || '').trim() || 'Paciente';
  const safeKine = (kinesiologistFullName || '').trim() || 'su profesional';
  return (
    `Hola ${safePatient}, te contactamos del consultorio para informarte que tu turno del día ` +
    `${dateDisplay} a las ${timeDisplay} con el/la kinesiólogo/a ${safeKine} debió ser cancelado ` +
    `debido a que el profesional estará de vacaciones durante ese período.\n\n` +
    `Disculpá las molestias ocasionadas. Ante cualquier consulta, podés comunicarte con nosotros. ¡Muchas gracias!`
  );
}

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
      SELECT ${VACATION_SELECT_COLUMNS}
      ${VACATION_BASE_JOINS}
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
      cancelledAt: row.cancelled_at || null,
      cancelledBy: row.cancelled_by || null,
      cancelledByName: row.cancelled_by_name || null,
      cancelledByLastName: row.cancelled_by_last_name || null,
      cancelledByRole: row.cancelled_by_role || null,
      cancellationReason: row.cancellation_reason || null,
      effectiveEndDate: row.effective_end_date || null,
      createdBy: row.created_by,
      createdByName: row.created_by_name || null,
      createdByLastName: row.created_by_last_name || null,
      createdByRole: row.created_by_role || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findById(id) {
    const rows = await query(`
      SELECT ${VACATION_SELECT_COLUMNS}
      ${VACATION_BASE_JOINS}
      WHERE kv.id = ?
      LIMIT 1
    `, [id]);
    return this._mapRow(rows[0]);
  }

  /**
   * Sincroniza los estados automáticos del ciclo de vida (scheduled -> active -> completed)
   * sin alterar períodos ya cancelados.
   */
  async syncLifecycleStatuses(today) {
    await query(
      `UPDATE kinesiologist_vacations
       SET status = 'active'
       WHERE status = 'scheduled'
         AND start_date <= ?
         AND end_date >= ?`,
      [today, today]
    );

    await query(
      `UPDATE kinesiologist_vacations
       SET status = 'completed'
       WHERE status IN ('scheduled', 'active')
         AND end_date < ?`,
      [today]
    );
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
             a.cancellation_reason, a.cancelled_by_vacation_id,
             DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i:%s') as start_time_str,
             DATE_FORMAT(a.start_time, '%d/%m/%Y') as date_display,
             DATE_FORMAT(a.start_time, '%H:%i') as time_display,
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

  async findCancelledByVacation(vacationId) {
    return await query(`
      SELECT a.id, a.patient_id, a.kinesiologist_id, a.service_id, a.start_time, a.end_time, a.status, a.notes,
             a.cancellation_reason, a.cancelled_by_vacation_id,
             DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i:%s') as start_time_str,
             DATE_FORMAT(a.start_time, '%d/%m/%Y') as date_display,
             DATE_FORMAT(a.start_time, '%H:%i') as time_display,
             a.agreed_price, a.currency,
             p.first_name as patient_first_name, p.last_name as patient_last_name, p.dni as patient_dni, p.phone as patient_phone,
             s.name as service_name, s.duration_minutes,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             vcn.id as notification_id, vcn.tracking_status, vcn.whatsapp_message, vcn.notified_at
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN services s ON a.service_id = s.id
      LEFT JOIN users u ON a.kinesiologist_id = u.id
      LEFT JOIN vacation_cancellation_notifications vcn ON vcn.appointment_id = a.id
      WHERE a.cancelled_by_vacation_id = ?
      ORDER BY a.start_time ASC
    `, [vacationId]);
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

  /**
   * Registra un período de vacaciones y cancela automáticamente dentro de una transacción ACID
   * todos los turnos activos asignados al kinesiólogo dentro de [startDate, endDate] inclusive,
   * preservando registros históricos y generando las notificaciones individuales para recepción.
   */
  async createWithAutoCancellations({
    kinesiologistId,
    kineFullName,
    startDate,
    endDate,
    status = 'scheduled',
    notes = null,
    createdBy,
    changedByUserId
  }) {
    const startOfDay = `${startDate} 00:00:00`;
    const endOfDay = `${endDate} 23:59:59`;

    return await executeTransaction(async (connection) => {
      const [affected] = await connection.query(`
        SELECT a.id, a.patient_id, a.kinesiologist_id, a.service_id, a.status,
               DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i:%s') as start_time_str,
               DATE_FORMAT(a.start_time, '%d/%m/%Y') as date_display,
               DATE_FORMAT(a.start_time, '%H:%i') as time_display,
               p.first_name as patient_first_name, p.last_name as patient_last_name, p.phone as patient_phone,
               s.name as service_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN services s ON a.service_id = s.id
        WHERE a.kinesiologist_id = ?
          AND a.status NOT IN ('cancelled', 'attended')
          AND a.start_time >= ? AND a.start_time <= ?
        ORDER BY a.start_time ASC
        FOR UPDATE
      `, [kinesiologistId, startOfDay, endOfDay]);

      const [insertRes] = await connection.query(`
        INSERT INTO kinesiologist_vacations
          (kinesiologist_id, start_date, end_date, status, notes, affected_appointments_count, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        kinesiologistId,
        startDate,
        endDate,
        status,
        notes,
        affected.length,
        createdBy
      ]);

      const vacationId = insertRes.insertId;
      const cancelledAppointments = [];

      for (const appt of affected) {
        await connection.query(
          `UPDATE appointments
           SET status = 'cancelled',
               cancellation_reason = ?,
               cancelled_by_vacation_id = ?
           WHERE id = ?`,
          [VACATION_CANCELLATION_REASON, vacationId, appt.id]
        );

        await connection.query(
          `INSERT INTO appointment_history
             (appointment_id, previous_status, new_status, previous_start_time, new_start_time, changed_by, reason)
           VALUES (?, ?, 'cancelled', ?, ?, ?, ?)`,
          [
            appt.id,
            appt.status,
            appt.start_time_str,
            appt.start_time_str,
            changedByUserId,
            'Cancelación automática por vacaciones del kinesiólogo'
          ]
        );

        const patientFullName = `${appt.patient_first_name || ''} ${appt.patient_last_name || ''}`.trim();
        const whatsappMessage = buildVacationWhatsAppMessage({
          patientFirstName: appt.patient_first_name,
          dateDisplay: appt.date_display,
          timeDisplay: appt.time_display,
          kinesiologistFullName: kineFullName
        });

        await connection.query(
          `INSERT IGNORE INTO vacation_cancellation_notifications
             (vacation_id, appointment_id, patient_id, kinesiologist_id, patient_name, patient_phone,
              kinesiologist_name, appointment_start_time, cancellation_reason, whatsapp_message, tracking_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_notification')`,
          [
            vacationId,
            appt.id,
            appt.patient_id,
            kinesiologistId,
            patientFullName,
            appt.patient_phone || null,
            kineFullName,
            appt.start_time_str,
            VACATION_CANCELLATION_REASON,
            whatsappMessage
          ]
        );

        cancelledAppointments.push({
          ...appt,
          status: 'cancelled',
          cancellation_reason: VACATION_CANCELLATION_REASON,
          cancelled_by_vacation_id: vacationId,
          patient_name: patientFullName,
          kinesiologist_name: kineFullName,
          whatsapp_message: whatsappMessage
        });
      }

      return {
        vacationId,
        cancelledAppointments
      };
    });
  }

  async findCancellationNotifications({ trackingStatus = 'all', vacationId, kinesiologistId, page = 1, limit = 100 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (trackingStatus && trackingStatus !== 'all') {
      conditions.push('vcn.tracking_status = ?');
      params.push(trackingStatus);
    }
    if (vacationId) {
      conditions.push('vcn.vacation_id = ?');
      params.push(vacationId);
    }
    if (kinesiologistId) {
      conditions.push('vcn.kinesiologist_id = ?');
      params.push(kinesiologistId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT vcn.id, vcn.vacation_id, vcn.appointment_id, vcn.patient_id, vcn.kinesiologist_id,
             vcn.patient_name, COALESCE(vcn.patient_phone, p.phone) as patient_phone,
             vcn.kinesiologist_name,
             DATE_FORMAT(vcn.appointment_start_time, '%Y-%m-%d %H:%i:%s') as appointment_start_time,
             DATE_FORMAT(vcn.appointment_start_time, '%d/%m/%Y') as date_display,
             DATE_FORMAT(vcn.appointment_start_time, '%H:%i') as time_display,
             vcn.cancellation_reason, vcn.whatsapp_message, vcn.tracking_status,
             DATE_FORMAT(vcn.notified_at, '%Y-%m-%d %H:%i:%s') as notified_at,
             vcn.notified_by, vcn.created_at,
             s.name as service_name,
             DATE_FORMAT(kv.start_date, '%Y-%m-%d') as vacation_start_date,
             DATE_FORMAT(kv.end_date, '%Y-%m-%d') as vacation_end_date,
             CONCAT_WS(' ', nb.name, nb.last_name) as notified_by_name
      FROM vacation_cancellation_notifications vcn
      JOIN patients p ON vcn.patient_id = p.id
      JOIN appointments a ON vcn.appointment_id = a.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN kinesiologist_vacations kv ON vcn.vacation_id = kv.id
      LEFT JOIN users nb ON vcn.notified_by = nb.id
      ${where}
      ORDER BY CASE WHEN vcn.tracking_status = 'pending_notification' THEN 0 ELSE 1 END ASC,
               vcn.appointment_start_time ASC, vcn.id ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async getCancellationNotificationsSummary({ vacationId, kinesiologistId } = {}) {
    const conditions = [];
    const params = [];
    if (vacationId) {
      conditions.push('vacation_id = ?');
      params.push(vacationId);
    }
    if (kinesiologistId) {
      conditions.push('kinesiologist_id = ?');
      params.push(kinesiologistId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN tracking_status = 'pending_notification' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN tracking_status = 'notified' THEN 1 ELSE 0 END) as notified_count
      FROM vacation_cancellation_notifications
      ${where}
    `, params);
    const r = rows[0] || {};
    return {
      totalCount: Number(r.total_count || 0),
      pendingCount: Number(r.pending_count || 0),
      notifiedCount: Number(r.notified_count || 0)
    };
  }

  async findCancellationNotificationById(id) {
    const rows = await query(`
      SELECT vcn.id, vcn.vacation_id, vcn.appointment_id, vcn.patient_id, vcn.kinesiologist_id,
             vcn.patient_name, COALESCE(vcn.patient_phone, p.phone) as patient_phone,
             vcn.kinesiologist_name,
             DATE_FORMAT(vcn.appointment_start_time, '%Y-%m-%d %H:%i:%s') as appointment_start_time,
             DATE_FORMAT(vcn.appointment_start_time, '%d/%m/%Y') as date_display,
             DATE_FORMAT(vcn.appointment_start_time, '%H:%i') as time_display,
             vcn.cancellation_reason, vcn.whatsapp_message, vcn.tracking_status,
             DATE_FORMAT(vcn.notified_at, '%Y-%m-%d %H:%i:%s') as notified_at,
             vcn.notified_by, vcn.created_at,
             s.name as service_name,
             CONCAT_WS(' ', nb.name, nb.last_name) as notified_by_name
      FROM vacation_cancellation_notifications vcn
      JOIN patients p ON vcn.patient_id = p.id
      JOIN appointments a ON vcn.appointment_id = a.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users nb ON vcn.notified_by = nb.id
      WHERE vcn.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async markCancellationNotificationAsSent(id, userId) {
    await query(`
      UPDATE vacation_cancellation_notifications
      SET tracking_status = 'notified',
          notified_at = COALESCE(notified_at, NOW()),
          notified_by = COALESCE(notified_by, ?)
      WHERE id = ?
    `, [userId, id]);
    return await this.findCancellationNotificationById(id);
  }

  async updateStatus(id, status, notes = null) {
    if (notes !== null) {
      await query('UPDATE kinesiologist_vacations SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
    } else {
      await query('UPDATE kinesiologist_vacations SET status = ? WHERE id = ?', [status, id]);
    }
  }

  /**
   * Cancela un período de vacaciones (futuro o en curso) dentro de una transacción ACID con bloqueo de fila (FOR UPDATE).
   * Preserva el registro completo, las notas originales, los turnos previamente cancelados y las fechas
   * anteriores a la fecha de cancelación cuando las vacaciones ya habían comenzado (`effective_end_date`).
   */
  async cancelAtomic({ id, cancelledBy, cancelledAt, today, previousDay, reason = null, authorize }) {
    return await executeTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT id, kinesiologist_id,
                DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
                DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
                status, notes, affected_appointments_count
         FROM kinesiologist_vacations
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [id]
      );

      const row = rows[0];
      if (!row) {
        throw new NotFoundError('Período de vacaciones no encontrado');
      }

      if (typeof authorize === 'function') {
        authorize(row);
      }

      if (row.status === 'cancelled') {
        throw new ConflictError('El período de vacaciones ya se encuentra cancelado');
      }

      if (row.status === 'completed' || row.end_date < today) {
        throw new BadRequestError('No se pueden cancelar períodos de vacaciones finalizados');
      }

      const wasInProgress = row.start_date <= today;
      const previousStatus = wasInProgress ? 'active' : 'scheduled';
      // Si ya había iniciado antes de hoy, conservar en historial el tramo transcurrido [start_date, ayer]
      const effectiveEndDate = row.start_date < today ? previousDay : null;

      const [updateRes] = await connection.query(
        `UPDATE kinesiologist_vacations
         SET status = 'cancelled',
             cancelled_at = ?,
             cancelled_by = ?,
             cancellation_reason = ?,
             effective_end_date = ?
         WHERE id = ?
           AND status IN ('scheduled', 'active')`,
        [cancelledAt, cancelledBy, reason, effectiveEndDate, id]
      );

      if (!updateRes || updateRes.affectedRows !== 1) {
        throw new ConflictError('El período de vacaciones ya fue modificado por otra operación simultánea');
      }

      return {
        previousRecord: row,
        previousStatus,
        wasInProgress,
        effectiveEndDate
      };
    });
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
             kv.affected_appointments_count, kv.created_by,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name, u.phone as kinesiologist_phone,
             c.name as created_by_name, c.last_name as created_by_last_name,
             cr.name as created_by_role,
             (
               SELECT COUNT(*)
               FROM vacation_cancellation_notifications vcn
               WHERE vcn.vacation_id = kv.id
                 AND vcn.tracking_status = 'pending_notification'
             ) as pending_affected_count
      FROM kinesiologist_vacations kv
      JOIN users u ON kv.kinesiologist_id = u.id
      LEFT JOIN users c ON kv.created_by = c.id
      LEFT JOIN roles cr ON c.role_id = cr.id
      WHERE kv.status != 'cancelled'
      HAVING pending_affected_count > 0
      ORDER BY kv.start_date ASC
    `);

    return rows.map((r) => ({
      ...r,
      kinesiologistId: r.kinesiologist_id,
      startDate: r.start_date,
      endDate: r.end_date,
      createdBy: r.created_by,
      createdByName: r.created_by_name || null,
      createdByLastName: r.created_by_last_name || null,
      createdByRole: r.created_by_role || null,
      affectedAppointmentsCount: Number(r.affected_appointments_count || 0),
      pendingAffectedCount: Number(r.pending_affected_count || 0),
      pendingNotificationsCount: Number(r.pending_affected_count || 0)
    }));
  }
}

export const vacationsRepository = new VacationsRepository();
