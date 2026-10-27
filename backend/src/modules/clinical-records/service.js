import { clinicalRecordsRepository } from './repository.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

export class ClinicalRecordsService {
  async searchByPatient(params, currentUser) {
    // La recepcionista NO puede acceder a notas clínicas ni diagnósticos
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a historias clínicas');
    }
    return await clinicalRecordsRepository.searchByPatient(params);
  }

  async getDetail(id, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a historias clínicas');
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
    const id = await clinicalRecordsRepository.create({
      ...data,
      authorId: currentUser.id
    });
    return await clinicalRecordsRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    if (currentUser.role !== 'kinesiologist' && currentUser.role !== 'admin') {
      throw new ForbiddenError('Solo profesionales autorizados pueden modificar historias clínicas');
    }
    await this.getDetail(id, currentUser);
    await clinicalRecordsRepository.updateWithVersion(id, fields, currentUser.id);
    return await clinicalRecordsRepository.findById(id);
  }
}

export const clinicalRecordsService = new ClinicalRecordsService();
