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

  // --- Ejercicios (Directo) ---
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

  // ========================================================
  // --- RUTINAS TERAPÉUTICAS ---
  // ========================================================

  async searchRoutines(req, res, next) {
    try {
      const routines = await treatmentsService.searchRoutines(req.body, req.user);
      return sendSuccess(res, routines);
    } catch (error) {
      next(error);
    }
  }

  async routineDetail(req, res, next) {
    try {
      const routineId = req.body?.id || req.params?.id;
      const routine = await treatmentsService.getRoutineDetail(routineId, req.user);
      return sendSuccess(res, routine);
    } catch (error) {
      next(error);
    }
  }

  async createRoutine(req, res, next) {
    try {
      const created = await treatmentsService.createRoutine(req.body, req.user);
      return sendSuccess(res, created, 'Rutina terapéutica prescrita con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateRoutine(req, res, next) {
    try {
      const updated = await treatmentsService.updateRoutine(req.body, req.user);
      return sendSuccess(res, updated, 'Rutina terapéutica actualizada con registro histórico');
    } catch (error) {
      next(error);
    }
  }

  async updateRoutineStatus(req, res, next) {
    try {
      const updated = await treatmentsService.updateRoutineStatus(req.body.id, req.body.status, req.user);
      return sendSuccess(res, updated, 'Estado de rutina actualizado');
    } catch (error) {
      next(error);
    }
  }

  // --- Seguimiento y Evolución Clínica Integral del Paciente ---
  async patientTracking(req, res, next) {
    try {
      const tracking = await treatmentsService.getPatientTracking(req.body.patientId, req.body.treatmentId, req.user);
      return sendSuccess(res, tracking);
    } catch (error) {
      next(error);
    }
  }
}

export const treatmentsController = new TreatmentsController();
