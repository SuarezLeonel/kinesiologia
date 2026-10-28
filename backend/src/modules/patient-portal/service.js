import { query } from '../../config/database.js';
import { appointmentsRepository } from '../appointments/repository.js';
import { servicesRepository } from '../services/repository.js';
import { notificationsService } from '../notifications/service.js';
import { NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class PatientPortalService {
  async getPatientByUserId(userId) {
    const rows = await query(`
      SELECT p.*, u.email as account_email, u.name as user_name, u.last_name as user_last_name
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.is_active = 1
      LIMIT 1
    `, [userId]);

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

  async availableSlots({ kinesiologistId, serviceId, date }) {
    const service = await servicesRepository.findById(serviceId);
    if (!service) throw new NotFoundError('Servicio no encontrado');

    const durationMinutes = service.duration_minutes || 45;

    // Buscar turnos existentes para ese profesional en esa fecha
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    const existingAppointments = await query(`
      SELECT start_time, end_time
      FROM appointments
      WHERE kinesiologist_id = ?
        AND status NOT IN ('cancelled')
        AND start_time >= ? AND start_time <= ?
      ORDER BY start_time ASC
    `, [kinesiologistId, startOfDay, endOfDay]);

    // Horarios operativos: 08:00 a 19:00 (en intervalos de 45 o 60 minutos)
    const slots = [];
    const stepMinutes = 60; // slots a cada hora en punto
    const startHour = 8;
    const endHour = 18;

    for (let h = startHour; h <= endHour; h++) {
      const slotTimeStr = `${date} ${String(h).padStart(2, '0')}:00:00`;
      const slotStart = new Date(slotTimeStr.replace(' ', 'T'));
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      // Si es hoy, descartar slots pasados
      if (slotStart.getTime() <= Date.now()) {
        continue;
      }

      // Verificar superposición con turnos existentes
      const hasConflict = existingAppointments.some((app) => {
        const appStart = new Date(app.start_time);
        const appEnd = new Date(app.end_time);
        return (slotStart < appEnd && slotEnd > appStart);
      });

      if (!hasConflict) {
        slots.push({
          startTime: slotTimeStr,
          timeLabel: `${String(h).padStart(2, '0')}:00`,
          durationMinutes,
          available: true
        });
      }
    }

    return slots;
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
    const endTime = endD.toISOString().slice(0, 19).replace('T', ' ');

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

  async updateProfile(userId, { phone, address }) {
    const patient = await this.getPatientByUserId(userId);
    const updates = [];
    const params = [];
    if (phone) { updates.push('phone = ?'); params.push(phone); }
    if (address) { updates.push('address = ?'); params.push(address); }

    if (updates.length > 0) {
      params.push(patient.id);
      await query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    return await this.getPatientByUserId(userId);
  }

  async myNotifications(userId) {
    return await notificationsService.getMyNotifications(userId);
  }
}

export const patientPortalService = new PatientPortalService();
