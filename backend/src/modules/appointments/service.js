import { appointmentsRepository } from './repository.js';
import { servicesRepository } from '../services/repository.js';
import { patientsRepository } from '../patients/repository.js';
import { notificationsService } from '../notifications/service.js';
import { NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class AppointmentsService {
  async search(filters) {
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
    await this.getDetail(id);
    await appointmentsRepository.updateWithHistory(id, fields, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'APPOINTMENT_UPDATED',
      entityType: 'appointment',
      entityId: id,
      details: fields
    });

    return await appointmentsRepository.findById(id);
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
}

export const appointmentsService = new AppointmentsService();

