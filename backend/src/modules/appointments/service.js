import { appointmentsRepository } from './repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

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
    // Validar superposición de horarios del kinesiólogo
    const hasOverlap = await appointmentsRepository.checkOverlap(data.kinesiologistId, data.startTime, data.endTime);
    if (hasOverlap) {
      throw new ConflictError('El profesional ya tiene un turno agendado en ese horario');
    }

    const id = await appointmentsRepository.create({
      ...data,
      createdBy: currentUser.id
    });
    return await appointmentsRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    const current = await this.getDetail(id);

    // Si modifica horario, verificar superposición
    const targetStart = fields.startTime || current.start_time;
    const targetEnd = fields.endTime || current.end_time;
    if (fields.startTime || fields.endTime) {
      const hasOverlap = await appointmentsRepository.checkOverlap(current.kinesiologist_id, targetStart, targetEnd, id);
      if (hasOverlap) {
        throw new ConflictError('El nuevo horario genera una superposición de turnos');
      }
    }

    await appointmentsRepository.updateWithHistory(id, fields, currentUser.id);
    return await appointmentsRepository.findById(id);
  }

  async cancel(id, reason, currentUser) {
    await this.getDetail(id);
    await appointmentsRepository.updateWithHistory(id, { status: 'cancelled', reason }, currentUser.id);
    return { success: true };
  }
}

export const appointmentsService = new AppointmentsService();
