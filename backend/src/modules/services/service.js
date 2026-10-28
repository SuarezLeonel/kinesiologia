import { servicesRepository } from './repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class ServicesService {
  async search(filters) {
    return await servicesRepository.search(filters);
  }

  async getDetail(id) {
    const service = await servicesRepository.findById(id);
    if (!service) {
      throw new NotFoundError('Servicio o prestación no encontrada');
    }
    return service;
  }

  async create(data, currentUser) {
    const id = await servicesRepository.create(data);

    await logAudit({
      userId: currentUser.id,
      action: 'SERVICE_CREATED',
      entityType: 'service',
      entityId: id,
      details: { name: data.name, price: data.defaultPrice }
    });

    return await servicesRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    await this.getDetail(id);
    await servicesRepository.update(id, fields);

    await logAudit({
      userId: currentUser.id,
      action: 'SERVICE_UPDATED',
      entityType: 'service',
      entityId: id,
      details: fields
    });

    return await servicesRepository.findById(id);
  }
}

export const servicesService = new ServicesService();
