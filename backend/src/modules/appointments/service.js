import { appointmentsRepository } from './repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
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
    const id = await appointmentsRepository.create({
      ...data,
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
        startTime: data.startTime
      }
    });

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
    await this.getDetail(id);
    await appointmentsRepository.updateWithHistory(id, { status: 'cancelled', reason }, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'appointment',
      entityId: id,
      details: { reason }
    });

    return { success: true };
  }
}

export const appointmentsService = new AppointmentsService();
