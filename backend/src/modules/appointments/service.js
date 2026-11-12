/**
 * @file service.js
 * @module appointments
 * @description Lógica de negocio para la agenda de turnos.
 * Verifica solapamientos horarios de profesionales y pacientes, precios acordados y auditoría de cambios.
 */
import { appointmentsRepository } from './repository.js';
import { servicesRepository } from '../services/repository.js';
import { patientsRepository } from '../patients/repository.js';
import { notificationsService } from '../notifications/service.js';
import { holidayService } from '../../services/holidayService.js';
import { vacationsService } from '../vacations/service.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';
import { getClinicDateString, getClinicDateTimeString } from '../../utils/date.js';

export class AppointmentsService {
  async search(filters, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;

    // RBAC: Si el usuario es Kinesiólogo, forzar que solo consulte sus propios turnos asignados
    if (role === 'kinesiologist' || role === 'kinesiologo') {
      filters.kinesiologistId = currentUser.id;
    } else if (role === 'admin' || role === 'receptionist' || role === 'recepcionista') {
      // El Administrador y Recepcionista pueden consultar turnos de todos los profesionales
      // Si se envía 'all', se remueve la condición para devolver todos los turnos
      if (filters.kinesiologistId === 'all') {
        delete filters.kinesiologistId;
      }
    }

    return await appointmentsRepository.search(filters);
  }

  async getDetail(id) {
    const appointment = await appointmentsRepository.findById(id);
    if (!appointment) {
      throw new NotFoundError('Turno no encontrado');
    }
    return appointment;
  }

  async create(data, currentUser) {
    // Validar si el kinesiólogo seleccionado está de vacaciones en esa fecha
    if (data.kinesiologistId) {
      const dateStr = String(data.startTime).slice(0, 10);
      const isAvailable = await vacationsService.isKinesiologistAvailableOnDate(data.kinesiologistId, dateStr);
      if (!isAvailable) {
        throw new ConflictError('El profesional seleccionado se encuentra de vacaciones en la fecha indicada');
      }
    }

    // Validar fecha hábil, feriados y límite de 14 días corridos
    await holidayService.validateAppointmentDate(data.startTime);

    let agreedPrice = data.agreedPrice;
    if (agreedPrice === undefined || agreedPrice === null) {
      const service = await servicesRepository.findById(data.serviceId);
      agreedPrice = service ? Number(service.default_price) : 0;
    }

    const id = await appointmentsRepository.create({
      ...data,
      agreedPrice,
      currency: 'ARS',
      createdBy: currentUser.id
    });

    await logAudit({
      userId: currentUser.id,
      action: 'APPOINTMENT_CREATED',
      entityType: 'appointment',
      entityId: id,
      details: {
        patientId: data.patientId,
        kinesiologistId: data.kinesiologistId,
        startTime: data.startTime,
        agreedPrice
      }
    });

    // Notificar al paciente si dispone de cuenta
    const patient = await patientsRepository.findById(data.patientId);
    if (patient && patient.user_id) {
      await notificationsService.notify({
        userId: patient.user_id,
        patientId: patient.id,
        type: 'APPOINTMENT_BOOKED',
        title: 'Nuevo turno agendado',
        message: `Se ha reservado tu turno para el ${data.startTime.slice(0, 16)}.`,
        metadata: { appointmentId: id, startTime: data.startTime }
      });
    }

    return await appointmentsRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    const currentApp = await this.getDetail(id);

    // Si se modifica o reprograma la fecha/hora del turno, validar días no laborables y ventana de 14 días
    if (fields.startTime || fields.endTime) {
      await holidayService.validateAppointmentDate(fields.startTime || fields.endTime);
    }

    // Validar si el kinesiólogo asignado está de vacaciones en el horario nuevo
    const targetKineId = fields.kinesiologistId !== undefined ? fields.kinesiologistId : currentApp.kinesiologist_id;
    const targetTime = fields.startTime || currentApp.start_time;
    if (targetKineId && targetTime) {
      const dateStr = String(targetTime).slice(0, 10);
      const isAvailable = await vacationsService.isKinesiologistAvailableOnDate(targetKineId, dateStr);
      if (!isAvailable) {
        throw new ConflictError('El profesional seleccionado se encuentra de vacaciones en la fecha indicada');
      }
    }

    await appointmentsRepository.updateWithHistory(id, fields, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'APPOINTMENT_UPDATED',
      entityType: 'appointment',
      entityId: id,
      details: fields
    });

    const updatedApp = await appointmentsRepository.findById(id);
    const patient = await patientsRepository.findById(updatedApp.patient_id);
    if (patient && patient.user_id) {
      if (fields.status === 'cancelled') {
        await notificationsService.notify({
          userId: patient.user_id,
          patientId: patient.id,
          type: 'APPOINTMENT_CANCELLED',
          title: 'Turno cancelado',
          message: `El turno del ${String(updatedApp.start_time).slice(0, 16)} ha sido cancelado. Motivo: ${fields.reason || 'Modificación administrativa'}`,
          metadata: { appointmentId: id, reason: fields.reason }
        });
      } else if (fields.startTime) {
        await notificationsService.notify({
          userId: patient.user_id,
          patientId: patient.id,
          type: 'APPOINTMENT_RESCHEDULED',
          title: 'Turno reprogramado',
          message: `Tu turno ha sido reprogramado para el ${String(updatedApp.start_time).slice(0, 16)}.`,
          metadata: { appointmentId: id, startTime: updatedApp.start_time }
        });
      }
    }

    return updatedApp;
  }

  async cancel(id, reason, currentUser) {
    const appointment = await this.getDetail(id);
    await appointmentsRepository.updateWithHistory(id, { status: 'cancelled', reason }, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'appointment',
      entityId: id,
      details: { reason }
    });

    const patient = await patientsRepository.findById(appointment.patient_id);
    if (patient && patient.user_id) {
      await notificationsService.notify({
        userId: patient.user_id,
        patientId: patient.id,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Turno cancelado',
        message: `El turno del ${String(appointment.start_time).slice(0, 16)} ha sido cancelado. Motivo: ${reason}`,
        metadata: { appointmentId: id, reason }
      });
    }

    return { success: true };
  }

  // ==========================================
  // Gestión de Solicitudes de Reprogramación (Personal)
  // ==========================================

  async getRescheduleRequests(filters) {
    return await appointmentsRepository.findRescheduleRequests(filters);
  }

  async respondRescheduleRequest(requestId, { approved, responseNotes }, currentUser) {
    const request = await appointmentsRepository.findRescheduleRequestById(requestId);
    if (!request) {
      throw new NotFoundError('Solicitud de reprogramación no encontrada');
    }

    if (approved) {
      await holidayService.validateAppointmentDate(request.requested_start_time);

      const result = await appointmentsRepository.approveRescheduleAtomic(requestId, currentUser.id, responseNotes);
      await logAudit({
        userId: currentUser.id,
        action: 'RESCHEDULE_APPROVED',
        entityType: 'appointment_reschedule_request',
        entityId: requestId,
        details: { responseNotes }
      });

      const patient = await patientsRepository.findById(request.patient_id);
      if (patient && patient.user_id) {
        await notificationsService.notify({
          userId: patient.user_id,
          patientId: patient.id,
          type: 'RESCHEDULE_APPROVED',
          title: 'Solicitud de reprogramación aprobada',
          message: `Tu turno ha sido reprogramado para el ${String(request.requested_start_time).slice(0, 16)}.`,
          metadata: { requestId, appointmentId: request.appointment_id }
        });
      }
      return result;
    } else {
      const result = await appointmentsRepository.rejectReschedule(requestId, currentUser.id, responseNotes);
      await logAudit({
        userId: currentUser.id,
        action: 'RESCHEDULE_REJECTED',
        entityType: 'appointment_reschedule_request',
        entityId: requestId,
        details: { responseNotes }
      });

      const patient = await patientsRepository.findById(request.patient_id);
      if (patient && patient.user_id) {
        await notificationsService.notify({
          userId: patient.user_id,
          patientId: patient.id,
          type: 'RESCHEDULE_REJECTED',
          title: 'Solicitud de reprogramación rechazada',
          message: `Tu solicitud de cambio para el ${String(request.requested_start_time).slice(0, 16)} no pudo ser aceptada. Tu turno original se mantiene. Motivo: ${responseNotes || 'No especificado'}`,
          metadata: { requestId, appointmentId: request.appointment_id }
        });
      }
      return result;
    }
  }

  async getProfessionals() {
    return await appointmentsRepository.findProfessionals();
  }

  async getAvailableSlots({ kinesiologistId = 2, serviceId = 1, date }) {
    const service = await servicesRepository.findById(serviceId);
    const durationMinutes = service ? (service.duration_minutes || 45) : 45;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Si el profesional está de vacaciones en esta fecha, no ofrecer disponibilidad
    if (kinesiologistId) {
      const isAvailable = await vacationsService.isKinesiologistAvailableOnDate(kinesiologistId, targetDate);
      if (!isAvailable) {
        return [];
      }
    }

    // No ofrecer horarios en fechas pasadas, posteriores a 14 días, fines de semana ni feriados cerrados
    const dateEvaluation = await holidayService.evaluateDate(targetDate, { enforceWindow: true });
    if (!dateEvaluation.available) {
      return [];
    }

    const existingAppointments = await appointmentsRepository.search({
      kinesiologistId,
      startDate: `${targetDate} 00:00:00`,
      endDate: `${targetDate} 23:59:59`,
      limit: 100
    });

    const activeAppointments = existingAppointments.filter((a) => a.status !== 'cancelled');
    const slots = [];
    const startHour = 8;
    const endHour = 18;
    const todayStr = getClinicDateString();
    const clinicNowStr = getClinicDateTimeString();
    const pad = (n) => String(n).padStart(2, '0');

    for (let h = startHour; h <= endHour; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00`;
      const slotTimeStr = `${targetDate} ${timeStr}:00`;
      const slotStart = new Date(slotTimeStr.replace(' ', 'T'));
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      const slotEndTimeStr = `${targetDate} ${pad(slotEnd.getHours())}:${pad(slotEnd.getMinutes())}:${pad(slotEnd.getSeconds())}`;

      if (targetDate === todayStr && slotTimeStr <= clinicNowStr) {
        continue;
      }

      const hasConflict = activeAppointments.some((app) => {
        const appStart = String(app.start_time).slice(0, 19).replace('T', ' ');
        const appEnd = String(app.end_time).slice(0, 19).replace('T', ' ');
        return (slotTimeStr < appEnd && slotEndTimeStr > appStart);
      });

      if (!hasConflict) {
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

  async getCalendarAvailability(params = {}) {
    return await holidayService.getCalendarAvailability(params);
  }

  async listHolidays(params = {}) {
    return await holidayService.listHolidays(params);
  }

  async configureHoliday(data, currentUser) {
    const result = await holidayService.configureHoliday(data);
    await logAudit({
      userId: currentUser.id,
      action: 'HOLIDAY_CONFIGURED',
      entityType: 'clinic_holiday',
      entityId: result?.id || 0,
      details: data
    });
    return result;
  }

  async updateOptionalDayStatus(data, currentUser) {
    const result = await holidayService.updateOptionalDayStatus(data);
    await logAudit({
      userId: currentUser.id,
      action: 'OPTIONAL_HOLIDAY_STATUS_UPDATED',
      entityType: 'clinic_holiday',
      entityId: result?.id || 0,
      details: data
    });
    return result;
  }
}

export const appointmentsService = new AppointmentsService();

