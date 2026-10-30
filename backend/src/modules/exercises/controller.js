/**
 * @file controller.js
 * @module exercises
 * @description Controlador HTTP para el catálogo de más de 90 ejercicios kinésicos.
 */
import { exercisesService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class ExercisesController {
  async search(req, res, next) {
    try {
      const results = await exercisesService.search(req.body, req.user);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const exerciseId = req.body?.id || req.params?.id;
      const exercise = await exercisesService.getDetail(exerciseId);
      return sendSuccess(res, exercise);
    } catch (error) {
      next(error);
    }
  }

  async filterOptions(req, res, next) {
    try {
      const options = await exercisesService.getFilterOptions();
      return sendSuccess(res, options);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await exercisesService.create(req.body, req.user);
      return sendSuccess(res, created, 'Ejercicio terapéutico registrado en catálogo', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const id = req.params?.id || req.body?.id;
      const updated = await exercisesService.update(id, req.body, req.user);
      return sendSuccess(res, updated, 'Ejercicio terapéutico actualizado');
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req, res, next) {
    try {
      const id = req.body?.id || req.params?.id;
      const result = await exercisesService.toggleActive(id, req.body?.isActive, req.user);
      const msg = result.isActive
        ? 'Ejercicio reactivado exitosamente en el catálogo'
        : 'Ejercicio desactivado lógicamente del catálogo';
      return sendSuccess(res, result, msg);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const id = req.params?.id || req.body?.id;
      const result = await exercisesService.delete(id, req.user);
      return sendSuccess(res, result, 'Ejercicio desactivado lógicamente');
    } catch (error) {
      next(error);
    }
  }
}

export const exercisesController = new ExercisesController();
