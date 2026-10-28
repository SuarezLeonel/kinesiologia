import { patientsRepository } from './repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export class PatientsService {
  async search(filters, _currentUser) {
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

  async checkDuplicate({ dni, email }) {
    if (dni) {
      const byDni = await patientsRepository.findByDni(dni);
      if (byDni) {
        return {
          hasDuplicate: true,
          isDuplicate: true,
          duplicateField: 'dni',
          message: `Ya existe una ficha registrada con el DNI ${dni}`,
          patient: byDni,
          existingPatient: byDni
        };
      }
    }
    if (email) {
      const byEmail = await patientsRepository.findByEmail(email);
      if (byEmail) {
        return {
          hasDuplicate: true,
          isDuplicate: true,
          duplicateField: 'email',
          message: `Ya existe una ficha registrada con el correo ${email}`,
          patient: byEmail,
          existingPatient: byEmail
        };
      }
    }
    return { hasDuplicate: false, isDuplicate: false };
  }

  async create(data) {
    const existingDni = await patientsRepository.findByDni(data.dni);
    if (existingDni) {
      const err = new ConflictError(`Ya existe un paciente con el DNI ${data.dni}`);
      err.duplicatePatient = existingDni;
      throw err;
    }
    if (data.email) {
      const existingEmail = await patientsRepository.findByEmail(data.email);
      if (existingEmail) {
        const err = new ConflictError(`Ya existe un paciente con el correo electrónico ${data.email}`);
        err.duplicatePatient = existingEmail;
        throw err;
      }
    }
    // La ficha administrativa se crea sin cuenta de usuario ni credenciales
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
