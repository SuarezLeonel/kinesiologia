/**
 * @file service.js
 * @module patient-portal
 * @description Lógica de Home Care: registro autónomo de series y dolor sin alterar la prescripción médica original.
 */
import { query } from '../../config/database.js';
import { appointmentsRepository } from '../appointments/repository.js';
import { servicesRepository } from '../services/repository.js';
import { notificationsService } from '../notifications/service.js';
import { NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';
import bcrypt from 'bcryptjs';

export class PatientPortalService {
  async getPatientByUserId(userId) {
    let rows = await query(`
      SELECT p.*, u.email as account_email, u.name as user_name, u.last_name as user_last_name
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.is_active = 1
      LIMIT 1
    `, [userId]);

    if (rows.length === 0) {
      // Si el usuario tiene una ficha creada por recepción con el mismo email aún sin vincular, vincularla automáticamente
      const userRows = await query('SELECT id, email FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
      if (userRows.length > 0 && userRows[0].email) {
        const normalizedEmail = String(userRows[0].email).trim().toLowerCase();
        const unlinked = await query(
          'SELECT id FROM patients WHERE LOWER(TRIM(email)) = ? AND user_id IS NULL AND is_active = 1 LIMIT 1',
          [normalizedEmail]
        );
        if (unlinked.length === 1) {
          await query('UPDATE patients SET user_id = ? WHERE id = ?', [userId, unlinked[0].id]);
          rows = await query(`
            SELECT p.*, u.email as account_email, u.name as user_name, u.last_name as user_last_name
            FROM patients p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ? AND p.is_active = 1
            LIMIT 1
          `, [userId]);
        }
      }
    }

    if (rows.length === 0) {
      throw new NotFoundError('Ficha de paciente no encontrada para esta cuenta de usuario');
    }
    return rows[0];
  }

  async dashboard(userId) {
    const patient = await this.getPatientByUserId(userId);

    // Próximo turno activo
    const nextRows = await query(`
      SELECT a.id, a.start_time, a.end_time, a.status, a.notes, a.agreed_price, a.currency,
             s.name as service_name, s.duration_minutes,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN users u ON a.kinesiologist_id = u.id
      WHERE a.patient_id = ?
        AND a.start_time >= NOW()
        AND a.status IN ('pending', 'confirmed')
      ORDER BY a.start_time ASC
      LIMIT 1
    `, [patient.id]);

    // Estadísticas
    const countRows = await query(`
      SELECT
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) as attended_count,
        SUM(CASE WHEN start_time >= NOW() AND status IN ('pending', 'confirmed') THEN 1 ELSE 0 END) as upcoming_count
      FROM appointments
      WHERE patient_id = ?
    `, [patient.id]);

    // Rutina terapéutica activa vigente
    const activeRoutineRows = await query(`
      SELECT r.id, r.name, r.version, r.valid_from, r.valid_until, r.notes,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) as exercises_count,
             (SELECT COUNT(DISTINCT pel.routine_exercise_id)
              FROM patient_exercise_logs pel
              WHERE pel.routine_id = r.id AND pel.patient_id = ? AND pel.completed_date = CURRENT_DATE) as completed_today_count
      FROM treatment_routines r
      JOIN users u ON r.kinesiologist_id = u.id
      WHERE r.patient_id = ? AND r.is_current = 1 AND r.status = 'active'
      LIMIT 1
    `, [patient.id, patient.id]);

    return {
      patient: {
        id: patient.id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        dni: patient.dni,
        phone: patient.phone,
        email: patient.email || patient.account_email
      },
      nextAppointment: nextRows[0] || null,
      activeRoutine: activeRoutineRows[0] || null,
      stats: countRows[0] || { total_appointments: 0, attended_count: 0, upcoming_count: 0 }
    };
  }

  async myAppointments(userId, filters = {}) {
    const patient = await this.getPatientByUserId(userId);
    const conditions = ['a.patient_id = ?'];
    const params = [patient.id];

    if (filters.status && filters.status !== 'all') {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    const sql = `
      SELECT a.id, a.patient_id, a.start_time, a.end_time, a.status, a.notes, a.agreed_price, a.currency,
             s.name as service_name, s.duration_minutes,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN users u ON a.kinesiologist_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.start_time DESC
      LIMIT 50
    `;

    return await query(sql, params);
  }

  async catalog() {
    // Profesionales disponibles (datos autorizados, sin contraseñas ni logs internos)
    const professionals = await query(`
      SELECT id, name, last_name
      FROM users
      WHERE role_id = 2 AND is_active = 1
      ORDER BY last_name ASC, name ASC
    `);

    // Servicios y tarifas vigentes
    const services = await query(`
      SELECT id, name, description, duration_minutes, default_price
      FROM services
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    return {
      professionals: professionals.map((p) => ({
        id: p.id,
        fullName: `Lic. ${p.last_name}, ${p.name}`,
        specialty: 'Kinesiología y Fisioterapia Especializada'
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || 'Sesión terapéutica personalizada',
        durationMinutes: s.duration_minutes,
        price: Number(s.default_price),
        currency: 'ARS'
      }))
    };
  }

  async availableSlots({ kinesiologistId = 2, serviceId = 1, date } = {}) {
    const service = serviceId ? await servicesRepository.findById(serviceId) : null;
    const durationMinutes = service ? (service.duration_minutes || 45) : 45;

    const targetDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
      ? date
      : this._formatLocalDateTime(new Date(Date.now() + 86400000)).slice(0, 10);

    // Buscar turnos existentes para ese profesional en esa fecha
    const startOfDay = `${targetDate} 00:00:00`;
    const endOfDay = `${targetDate} 23:59:59`;

    const existingAppointments = await query(`
      SELECT start_time, end_time
      FROM appointments
      WHERE kinesiologist_id = ?
        AND status NOT IN ('cancelled')
        AND start_time >= ? AND start_time <= ?
      ORDER BY start_time ASC
    `, [kinesiologistId || 2, startOfDay, endOfDay]);

    // Horarios operativos: 08:00 a 18:00
    const slots = [];
    const startHour = 8;
    const endHour = 18;
    const now = new Date();
    const todayStr = this._formatLocalDateTime(now).slice(0, 10);

    for (let h = startHour; h <= endHour; h++) {
      const slotTimeStr = `${targetDate} ${String(h).padStart(2, '0')}:00:00`;
      const slotStart = new Date(slotTimeStr.replace(' ', 'T'));
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      // Si es hoy dentro del horario laboral, descartar slots de hoy que ya pasaron
      if (targetDate === todayStr && now.getHours() < endHour && slotStart.getTime() <= now.getTime()) {
        continue;
      }

      // Verificar superposición con turnos existentes
      const hasConflict = existingAppointments.some((app) => {
        const appStart = new Date(app.start_time);
        const appEnd = new Date(app.end_time);
        return (slotStart < appEnd && slotEnd > appStart);
      });

      if (!hasConflict) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        slots.push({
          startTime: slotTimeStr,
          time: timeStr,
          timeLabel: timeStr,
          durationMinutes,
          available: true
        });
      }
    }

    return slots;
  }

  _formatLocalDateTime(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async bookAppointment({ kinesiologistId, serviceId, startTime, notes }, userId) {
    const patient = await this.getPatientByUserId(userId);
    const service = await servicesRepository.findById(serviceId);
    if (!service) throw new NotFoundError('Servicio no encontrado');

    const duration = service.duration_minutes || 45;
    const startD = new Date(startTime.replace(' ', 'T'));
    if (isNaN(startD.getTime())) {
      throw new ConflictError('Formato de fecha inválido');
    }

    const endD = new Date(startD.getTime() + duration * 60000);
    const endTime = this._formatLocalDateTime(endD);

    const id = await appointmentsRepository.create({
      patientId: patient.id,
      kinesiologistId,
      serviceId,
      startTime,
      endTime,
      notes: notes || 'Turno solicitado desde Portal del Paciente',
      agreedPrice: Number(service.default_price),
      currency: 'ARS',
      createdBy: userId
    });

    await logAudit({
      userId,
      action: 'PATIENT_PORTAL_APPOINTMENT_BOOKED',
      entityType: 'appointment',
      entityId: id,
      details: { serviceId, kinesiologistId, startTime, agreedPrice: service.default_price }
    });

    await notificationsService.notify({
      userId,
      patientId: patient.id,
      type: 'APPOINTMENT_BOOKED',
      title: 'Reserva confirmada',
      message: `Has reservado tu turno para el ${startTime.slice(0, 16)} hs. Te esperamos en el consultorio.`,
      metadata: { appointmentId: id, startTime }
    });

    return await appointmentsRepository.findById(id);
  }

  async cancelAppointment({ appointmentId, reason }, userId) {
    const patient = await this.getPatientByUserId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new NotFoundError('Turno no encontrado');

    if (appointment.patient_id !== patient.id) {
      throw new ForbiddenError('No posee autorización para cancelar un turno que no le pertenece');
    }

    if (appointment.status === 'cancelled') {
      throw new ConflictError('El turno ya se encuentra cancelado');
    }
    if (appointment.status === 'attended') {
      throw new ConflictError('No es posible cancelar un turno que ya ha sido atendido');
    }

    await appointmentsRepository.updateWithHistory(appointmentId, { status: 'cancelled', reason }, userId);

    await logAudit({
      userId,
      action: 'PATIENT_PORTAL_APPOINTMENT_CANCELLED',
      entityType: 'appointment',
      entityId: appointmentId,
      details: { reason }
    });

    await notificationsService.notify({
      userId,
      patientId: patient.id,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Turno cancelado',
      message: `Tu turno del ${String(appointment.start_time).slice(0, 16)} ha sido cancelado con éxito.`,
      metadata: { appointmentId }
    });

    return { success: true };
  }

  async requestReschedule({ appointmentId, requestedStartTime, reason }, userId) {
    const patient = await this.getPatientByUserId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new NotFoundError('Turno no encontrado');

    if (appointment.patient_id !== patient.id) {
      throw new ForbiddenError('No posee autorización para reprogramar un turno que no le pertenece');
    }

    if (appointment.status === 'cancelled' || appointment.status === 'attended') {
      throw new ConflictError(`No es posible reprogramar un turno en estado ${appointment.status}`);
    }

    const service = await servicesRepository.findById(appointment.service_id);
    const duration = service ? service.duration_minutes : 45;
    const startD = new Date(requestedStartTime.replace(' ', 'T'));
    const endD = new Date(startD.getTime() + duration * 60000);
    const requestedEndTime = endD.toISOString().slice(0, 19).replace('T', ' ');

    const requestId = await appointmentsRepository.createRescheduleRequest({
      appointmentId,
      patientId: patient.id,
      requestedStartTime,
      requestedEndTime,
      reason
    });

    await logAudit({
      userId,
      action: 'PATIENT_RESCHEDULE_REQUESTED',
      entityType: 'appointment_reschedule_request',
      entityId: requestId,
      details: { appointmentId, requestedStartTime, reason }
    });

    await notificationsService.notify({
      userId,
      patientId: patient.id,
      type: 'RESCHEDULE_REQUESTED',
      title: 'Solicitud de reprogramación enviada',
      message: `Tu solicitud para el ${requestedStartTime.slice(0, 16)} fue recibida y está pendiente de confirmación por el consultorio.`,
      metadata: { requestId, appointmentId }
    });

    return { success: true, requestId, status: 'pending' };
  }

  async myRescheduleRequests(userId) {
    const patient = await this.getPatientByUserId(userId);
    return await appointmentsRepository.findRescheduleRequests({ patientId: patient.id });
  }

  async myProfile(userId) {
    return await this.getPatientByUserId(userId);
  }

  async updateProfile(userId, { phone }) {
    const patient = await this.getPatientByUserId(userId);
    if (phone) {
      await query('UPDATE patients SET phone = ? WHERE id = ?', [phone.trim(), patient.id]);
      await query('UPDATE users SET phone = ? WHERE id = ?', [phone.trim(), userId]);
    }
    return await this.getPatientByUserId(userId);
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const rows = await query('SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
    if (rows.length === 0) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const user = rows[0];
    const isValid = user.password_hash ? await bcrypt.compare(currentPassword, user.password_hash) : false;
    if (!isValid) {
      throw new UnauthorizedError('La contraseña actual ingresada es incorrecta');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await logAudit({
      userId,
      action: 'PATIENT_PASSWORD_CHANGED',
      entityType: 'user',
      entityId: userId,
      details: { method: 'current_password_verification' }
    });

    return { updated: true };
  }

  async myNotifications(userId) {
    return await notificationsService.getMyNotifications(userId);
  }

  // ========================================================
  // --- RUTINAS Y CUMPLIMIENTO TERAPÉUTICO DEL PACIENTE ---
  // ========================================================

  async myRoutines(userId) {
    const patient = await this.getPatientByUserId(userId);

    // Obtener todas las rutinas asignadas al paciente ordenadas por vigencia
    const routines = await query(`
      SELECT r.id, r.treatment_id, r.name, r.description, r.status, r.version,
             r.is_current, r.valid_from, r.valid_until, r.notes, r.created_at,
             t.title as treatment_title,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) as exercises_count
      FROM treatment_routines r
      LEFT JOIN treatments t ON r.treatment_id = t.id
      JOIN users u ON r.kinesiologist_id = u.id
      WHERE r.patient_id = ?
      ORDER BY r.is_current DESC, r.created_at DESC
    `, [patient.id]);

    // Para cada rutina, cargar los ejercicios en orden con su estado de cumplimiento
    for (const r of routines) {
      r.exercises = await query(`
        SELECT re.id as routine_exercise_id, re.routine_id, re.exercise_id,
               re.sets, re.repetitions, re.duration_seconds, re.rest_seconds,
               re.weekly_frequency, re.body_side, re.resistance_load,
               re.custom_instructions, re.execution_order,
               e.name, e.category, e.body_zone, e.muscle_group,
               e.therapeutic_objective, e.difficulty_level, e.instructions,
               e.contraindications, e.media_url,
               (SELECT COUNT(*) FROM patient_exercise_logs pel
                WHERE pel.routine_exercise_id = re.id AND pel.patient_id = ? AND pel.completed_date = CURRENT_DATE) as completed_today,
               (SELECT MAX(completed_at) FROM patient_exercise_logs pel
                WHERE pel.routine_exercise_id = re.id AND pel.patient_id = ?) as last_completed_at
        FROM routine_exercises re
        JOIN exercises e ON re.exercise_id = e.id
        WHERE re.routine_id = ?
        ORDER BY re.execution_order ASC, re.id ASC
      `, [patient.id, patient.id, r.id]);
    }

    return routines;
  }

  async logExercise(userId, { routineExerciseId, completedDate, setsCompleted, repsCompleted, perceivedPainLevel, patientNotes }) {
    const patient = await this.getPatientByUserId(userId);

    // Verificar que el ejercicio pertenezca a una rutina de este paciente
    const rows = await query(`
      SELECT re.id, re.routine_id, re.exercise_id, tr.patient_id, tr.status
      FROM routine_exercises re
      JOIN treatment_routines tr ON re.routine_id = tr.id
      WHERE re.id = ?
      LIMIT 1
    `, [routineExerciseId]);

    if (!rows.length || rows[0].patient_id !== patient.id) {
      throw new ForbiddenError('No tiene autorización para registrar cumplimiento sobre este ejercicio');
    }

    const target = rows[0];
    const targetDate = completedDate || new Date().toISOString().slice(0, 10);

    const result = await query(`
      INSERT INTO patient_exercise_logs (
        patient_id, user_id, routine_id, routine_exercise_id, exercise_id,
        completed_date, sets_completed, reps_completed, perceived_pain_level, patient_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient.id,
      userId,
      target.routine_id,
      target.id,
      target.exercise_id,
      targetDate,
      setsCompleted || null,
      repsCompleted || null,
      perceivedPainLevel ?? null,
      patientNotes || null
    ]);

    await logAudit({
      userId,
      action: 'PATIENT_EXERCISE_COMPLETED',
      entityType: 'patient_exercise_log',
      entityId: result.insertId,
      details: {
        patientId: patient.id,
        routineId: target.routine_id,
        routineExerciseId: target.id,
        completedDate: targetDate
      }
    });

    return {
      id: result.insertId,
      routineExerciseId,
      completedDate: targetDate,
      completed: true,
      message: 'Cumplimiento de ejercicio registrado correctamente.'
    };
  }

  async myExerciseLogs(userId, filters = {}) {
    const patient = await this.getPatientByUserId(userId);
    const conditions = ['pel.patient_id = ?'];
    const params = [patient.id];

    if (filters.routineId) {
      conditions.push('pel.routine_id = ?');
      params.push(filters.routineId);
    }
    if (filters.fromDate) {
      conditions.push('pel.completed_date >= ?');
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push('pel.completed_date <= ?');
      params.push(filters.toDate);
    }

    return await query(`
      SELECT pel.id, pel.routine_id, pel.routine_exercise_id, pel.exercise_id,
             pel.completed_date, pel.completed_at, pel.sets_completed, pel.reps_completed,
             pel.perceived_pain_level, pel.patient_notes,
             e.name as exercise_name, e.category as exercise_category,
             tr.name as routine_name
      FROM patient_exercise_logs pel
      JOIN exercises e ON pel.exercise_id = e.id
      JOIN treatment_routines tr ON pel.routine_id = tr.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pel.completed_at DESC
      LIMIT 100
    `, params);
  }
}

export const patientPortalService = new PatientPortalService();
