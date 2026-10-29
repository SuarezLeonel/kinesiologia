import { patientsRepository } from './repository.js';
import { authRepository } from '../auth/repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import bcrypt from 'bcryptjs';

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
    const normalizedEmail = data.email ? String(data.email).trim().toLowerCase() : null;
    data.email = normalizedEmail;

    const existingDni = await patientsRepository.findByDni(data.dni);
    if (existingDni) {
      const err = new ConflictError(`Ya existe un paciente con el DNI ${data.dni}`);
      err.duplicatePatient = existingDni;
      throw err;
    }

    if (normalizedEmail) {
      const existingEmail = await patientsRepository.findByEmail(normalizedEmail);
      if (existingEmail) {
        const isPlaceholderDni = /^(P-|G-)/.test(String(existingEmail.dni || ''));
        if (isPlaceholderDni) {
          await patientsRepository.update(existingEmail.id, {
            firstName: data.firstName,
            lastName: data.lastName,
            dni: data.dni,
            birthDate: data.birthDate,
            phone: data.phone,
            email: normalizedEmail,
            address: data.address,
            assignedKinesiologistId: data.assignedKinesiologistId
          });
          return await patientsRepository.findById(existingEmail.id);
        }
        const err = new ConflictError(`Ya existe un paciente con el correo electrónico ${normalizedEmail}`);
        err.duplicatePatient = existingEmail;
        throw err;
      }

      const existingUser = await patientsRepository.findPatientUserByEmail(normalizedEmail);
      if (existingUser) {
        data.userId = existingUser.id;
      } else if (data.password && data.password.length >= 8) {
        const anyExistingUser = await authRepository.findUserByEmail(normalizedEmail);
        if (anyExistingUser) {
          throw new ConflictError(`El correo electrónico ${normalizedEmail} ya pertenece a otra cuenta del sistema`);
        }
        const patientRole = await authRepository.findRoleByName('patient');
        const roleId = patientRole ? patientRole.id : 4;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        const createdUserId = await authRepository.createUser({
          roleId,
          name: data.firstName,
          lastName: data.lastName,
          dni: data.dni,
          email: normalizedEmail,
          passwordHash,
          phone: data.phone
        });
        data.userId = createdUserId;
      }
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
