import { exercisesRepository } from './repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class ExercisesService {
  async search(filters) {
    return await exercisesRepository.search(filters);
  }

  async getDetail(id) {
    const exercise = await exercisesRepository.findById(id);
    if (!exercise) {
      throw new NotFoundError('Ejercicio no encontrado');
    }
    return exercise;
  }

  async create(data, currentUser) {
    const id = await exercisesRepository.create(data);

    await logAudit({
      userId: currentUser.id,
      action: 'EXERCISE_CREATED',
      entityType: 'exercise',
      entityId: id,
      details: { name: data.name, category: data.category }
    });

    return await exercisesRepository.findById(id);
  }

  async update(id, fields, currentUser) {
    await this.getDetail(id);
    await exercisesRepository.update(id, fields);

    await logAudit({
      userId: currentUser.id,
      action: 'EXERCISE_UPDATED',
      entityType: 'exercise',
      entityId: id,
      details: fields
    });

    return await exercisesRepository.findById(id);
  }

  async delete(id, currentUser) {
    await this.getDetail(id);
    await exercisesRepository.softDelete(id);

    await logAudit({
      userId: currentUser.id,
      action: 'EXERCISE_DEACTIVATED',
      entityType: 'exercise',
      entityId: id
    });

    return { success: true };
  }
}

export const exercisesService = new ExercisesService();
