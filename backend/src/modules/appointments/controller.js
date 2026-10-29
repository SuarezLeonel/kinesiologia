import { appointmentsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class AppointmentsController {
  async search(req, res, next) {
    try {
      const appointments = await appointmentsService.search(req.body);
      return sendSuccess(res, appointments);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const appointment = await appointmentsService.getDetail(req.body.id);
      return sendSuccess(res, appointment);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await appointmentsService.create(req.body, req.user);
      return sendSuccess(res, created, 'Turno creado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await appointmentsService.update(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, 'Turno actualizado con trazabilidad');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const reason = req.body?.reason || 'Cancelación de turno';
      const result = await appointmentsService.cancel(req.params.id, reason, req.user);
      return sendSuccess(res, result, 'Turno cancelado');
    } catch (error) {
      next(error);
    }
  }

  async getRescheduleRequests(req, res, next) {
    try {
      const requests = await appointmentsService.getRescheduleRequests(req.body);
      return sendSuccess(res, requests);
    } catch (error) {
      next(error);
    }
  }

  async respondRescheduleRequest(req, res, next) {
    try {
      const result = await appointmentsService.respondRescheduleRequest(
        req.body.requestId,
        { approved: req.body.approved, responseNotes: req.body.responseNotes },
        req.user
      );
      return sendSuccess(res, result, req.body.approved ? 'Reprogramación aprobada y turno actualizado' : 'Reprogramación rechazada');
    } catch (error) {
      next(error);
    }
  }

  async getProfessionals(req, res, next) {
    try {
      const professionals = await appointmentsService.getProfessionals();
      return sendSuccess(res, professionals);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req, res, next) {
    try {
      const slots = await appointmentsService.getAvailableSlots(req.body || {});
      return sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentsController = new AppointmentsController();
