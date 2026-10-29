import { exercisesRepository } from './repository.js';
import { NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class ExercisesService {
  async search(filters = {}, currentUser = null) {
    const cleanFilters = {
      search: filters.search || undefined,
      category: filters.category || undefined,
      bodyZone: filters.bodyZone || filters.body_zone || undefined,
      muscleGroup: filters.muscleGroup || filters.muscle_group || undefined,
      therapeuticObjective: filters.therapeuticObjective || filters.therapeutic_objective || undefined,
      difficultyLevel: filters.difficultyLevel || filters.difficulty_level || undefined,
      equipmentNeeded: filters.equipmentNeeded || filters.equipment_needed || undefined,
      page: filters.page || 1,
      limit: filters.limit || 20
    };

    // Si el usuario es kinesiólogo y no especificó isActive, por defecto consultar activos
    if (filters.isActive !== undefined) {
      cleanFilters.isActive = Boolean(filters.isActive);
    } else if (filters.is_active !== undefined) {
      cleanFilters.isActive = Boolean(filters.is_active);
    } else if (currentUser && currentUser.role === 'kinesiologist') {
      cleanFilters.isActive = true;
    }

    return await exercisesRepository.search(cleanFilters);
  }

  async getDetail(id) {
    const exercise = await exercisesRepository.findById(id);
    if (!exercise) {
      throw new NotFoundError('Ejercicio terapéutico no encontrado');
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
      details: {
        name: data.name,
        category: data.category,
        bodyZone: data.bodyZone || data.body_zone,
        difficultyLevel: data.difficultyLevel || data.difficulty_level
      }
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

  async toggleActive(id, requestedStatus, currentUser) {
    const existing = await this.getDetail(id);
    const newStatus = requestedStatus !== undefined ? Boolean(requestedStatus) : !existing.isActive;

    await exercisesRepository.toggleActive(id, newStatus);

    await logAudit({
      userId: currentUser.id,
      action: newStatus ? 'EXERCISE_ACTIVATED' : 'EXERCISE_DEACTIVATED',
      entityType: 'exercise',
      entityId: id,
      details: { previousStatus: existing.isActive, newStatus }
    });

    return await exercisesRepository.findById(id);
  }

  async delete(id, currentUser) {
    const existing = await this.getDetail(id);
    
    // Regla estricta: Desactivación lógica para preservar el historial clínico y evitar errores relacionales
    await exercisesRepository.softDelete(id);

    await logAudit({
      userId: currentUser.id,
      action: 'EXERCISE_DEACTIVATED',
      entityType: 'exercise',
      entityId: id,
      details: { previousStatus: existing.isActive, newStatus: false, reason: 'Soft delete' }
    });

    return {
      success: true,
      id: existing.id,
      isActive: false,
      message: 'Ejercicio desactivado lógicamente para preservar el historial clínico'
    };
  }

  async getFilterOptions() {
    return await exercisesRepository.getFilterOptions();
  }
}

export const exercisesService = new ExercisesService();
