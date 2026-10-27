import { patientsRepository } from './repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export class PatientsService {
  async search(filters, currentUser) {
    // Si es kinesiólogo, por defecto puede filtrar o ver sus propios pacientes asignados o todos si la política de consultorio lo permite
    return await patientsRepository.search(filters);
  }

  async getDetail(id) {
    const patient = await patientsRepository.findById(id);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }
    return patient;
  }

  async create(data) {
    const existing = await patientsRepository.findByDni(data.dni);
    if (existing) {
      throw new ConflictError('Ya existe un paciente con ese DNI');
    }
    const id = await patientsRepository.create(data);
    return await patientsRepository.findById(id);
  }

  async update(id, fields) {
    await this.getDetail(id);
    await patientsRepository.update(id, fields);
    return await patientsRepository.findById(id);
  }

  async delete(id) {
    await this.getDetail(id);
    await patientsRepository.softDelete(id);
    return { success: true };
  }
}

export const patientsService = new PatientsService();
