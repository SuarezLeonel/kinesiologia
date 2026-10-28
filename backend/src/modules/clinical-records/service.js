import { clinicalRecordsRepository } from './repository.js';
import { patientsRepository } from '../patients/repository.js';
import { query } from '../../config/database.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class ClinicalRecordsService {
  async searchByPatient(params, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a historias clínicas ni diagnósticos');
    }
    return await clinicalRecordsRepository.searchByPatient(params);
  }

  async getDetail(id, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a historias clínicas ni diagnósticos');
    }
    const record = await clinicalRecordsRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Historia clínica no encontrada');
    }
    return record;
  }

  async create(data, currentUser) {
    if (currentUser.role !== 'kinesiologist' && currentUser.role !== 'admin') {
      throw new ForbiddenError('Solo profesionales autorizados pueden emitir historias clínicas');
    }

    // Verificar paciente y pertenencia clínica
    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }

    if (currentUser.role === 'kinesiologist') {
      const isAssigned = patient.assigned_kinesiologist_id === currentUser.id;
      if (!isAssigned) {
        // Verificar si tiene turno previo o asignado
        const rel = await query(
          'SELECT id FROM appointments WHERE patient_id = ? AND kinesiologist_id = ? LIMIT 1',
          [data.patientId, currentUser.id]
        );
        if (!rel.length) {
          throw new ForbiddenError('No posee autorización clínica sobre pacientes no asignados');
        }
      }
    }

    const id = await clinicalRecordsRepository.create({
      ...data,
      authorId: currentUser.id
    });

    await logAudit({
      userId: currentUser.id,
      action: 'CLINICAL_RECORD_CREATED',
      entityType: 'clinical_record',
      entityId: id,
      details: { patientId: data.patientId }
    });

    return await clinicalRecordsRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    if (currentUser.role !== 'kinesiologist' && currentUser.role !== 'admin') {
      throw new ForbiddenError('Solo profesionales autorizados pueden modificar historias clínicas');
    }
    const current = await this.getDetail(id, currentUser);

    if (currentUser.role === 'kinesiologist' && current.author_id !== currentUser.id) {
      throw new ForbiddenError('Solo el profesional autor o un administrador pueden editar esta historia clínica');
    }

    await clinicalRecordsRepository.updateWithVersion(id, fields, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'CLINICAL_RECORD_UPDATED',
      entityType: 'clinical_record',
      entityId: id,
      details: { fields: Object.keys(fields), reason: fields.changeReason }
    });

    return await clinicalRecordsRepository.findById(id);
  }
}

export const clinicalRecordsService = new ClinicalRecordsService();
