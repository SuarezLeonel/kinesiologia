/**
 * @file controller.js
 * @module vacations
 * @description Controlador HTTP para el módulo de vacaciones de kinesiólogos.
 */
import { vacationsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class VacationsController {
  async search(req, res, next) {
    try {
      const vacations = await vacationsService.search(req.body, req.user);
      return sendSuccess(res, vacations);
    } catch (error) {
      next(error);
    }
  }

  async preview(req, res, next) {
    try {
      const preview = await vacationsService.preview(req.body, req.user);
      return sendSuccess(res, preview);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await vacationsService.create(req.body, req.user);
      return sendSuccess(res, created, 'Período de vacaciones registrado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await vacationsService.cancel(req.body.id, req.body.reason, req.user);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getAffectedAppointments(req, res, next) {
    try {
      const appointments = await vacationsService.getAffectedAppointments(req.body, req.user);
      return sendSuccess(res, appointments);
    } catch (error) {
      next(error);
    }
  }

  async reassignAppointment(req, res, next) {
    try {
      const updated = await vacationsService.reassignAppointment(req.body, req.user);
      return sendSuccess(res, updated, 'Turno reasignado y reorganizado exitosamente');
    } catch (error) {
      next(error);
    }
  }

  async getActiveAlerts(req, res, next) {
    try {
      const alerts = await vacationsService.getActiveAlerts(req.user);
      return sendSuccess(res, alerts);
    } catch (error) {
      next(error);
    }
  }
}

export const vacationsController = new VacationsController();

