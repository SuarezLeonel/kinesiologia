import { exercisesService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class ExercisesController {
  async search(req, res, next) {
    try {
      const results = await exercisesService.search(req.body);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const exercise = await exercisesService.getDetail(req.body.id);
      return sendSuccess(res, exercise);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await exercisesService.create(req.body, req.user);
      return sendSuccess(res, created, 'Ejercicio registrado', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await exercisesService.update(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, 'Ejercicio actualizado');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await exercisesService.delete(req.params.id, req.user);
      return sendSuccess(res, result, 'Ejercicio desactivado');
    } catch (error) {
      next(error);
    }
  }
}

export const exercisesController = new ExercisesController();
