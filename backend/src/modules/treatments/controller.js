import { treatmentsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class TreatmentsController {
  async search(req, res, next) {
    try {
      const results = await treatmentsService.search(req.body, req.user);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const treatment = await treatmentsService.getDetail(req.body.id, req.user);
      return sendSuccess(res, treatment);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await treatmentsService.create(req.body, req.user);
      return sendSuccess(res, created, 'Tratamiento creado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await treatmentsService.update(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, 'Tratamiento actualizado');
    } catch (error) {
      next(error);
    }
  }

  // --- Sesiones ---
  async addSession(req, res, next) {
    try {
      const session = await treatmentsService.addSession(req.body, req.user);
      return sendSuccess(res, session, 'Sesión registrada con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const sessions = await treatmentsService.getSessions(req.body.treatmentId, req.user);
      return sendSuccess(res, sessions);
    } catch (error) {
      next(error);
    }
  }

  // --- Ejercicios ---
  async addExercise(req, res, next) {
    try {
      const exercise = await treatmentsService.addExercise(req.body, req.user);
      return sendSuccess(res, exercise, 'Ejercicio asociado al tratamiento', 201);
    } catch (error) {
      next(error);
    }
  }

  async removeExercise(req, res, next) {
    try {
      const result = await treatmentsService.removeExercise(req.body.treatmentId, req.body.exerciseId, req.user);
      return sendSuccess(res, result, 'Ejercicio removido del tratamiento');
    } catch (error) {
      next(error);
    }
  }

  // --- Mediciones ---
  async addMeasurement(req, res, next) {
    try {
      const measurement = await treatmentsService.addMeasurement(req.body, req.user);
      return sendSuccess(res, measurement, 'Medición registrada con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async getMeasurements(req, res, next) {
    try {
      const measurements = await treatmentsService.getMeasurements(req.body, req.user);
      return sendSuccess(res, measurements);
    } catch (error) {
      next(error);
    }
  }
}

export const treatmentsController = new TreatmentsController();
