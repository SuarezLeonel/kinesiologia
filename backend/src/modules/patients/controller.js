import { patientsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class PatientsController {
  async search(req, res, next) {
    try {
      const results = await patientsService.search(req.body, req.user);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const patient = await patientsService.getDetail(req.body.id);
      return sendSuccess(res, patient);
    } catch (error) {
      next(error);
    }
  }

  async checkDuplicate(req, res, next) {
    try {
      const result = await patientsService.checkDuplicate(req.body);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const patient = await patientsService.create(req.body);
      return sendSuccess(res, patient, 'Paciente registrado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await patientsService.update(req.params.id, req.body);
      return sendSuccess(res, updated, 'Paciente actualizado');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await patientsService.delete(req.params.id);
      return sendSuccess(res, result, 'Paciente desactivado');
    } catch (error) {
      next(error);
    }
  }
}

export const patientsController = new PatientsController();
