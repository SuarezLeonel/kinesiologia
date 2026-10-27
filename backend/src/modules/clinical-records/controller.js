import { clinicalRecordsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class ClinicalRecordsController {
  async search(req, res, next) {
    try {
      const records = await clinicalRecordsService.searchByPatient(req.body, req.user);
      return sendSuccess(res, records);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const record = await clinicalRecordsService.getDetail(req.body.id, req.user);
      return sendSuccess(res, record);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const record = await clinicalRecordsService.create(req.body, req.user);
      return sendSuccess(res, record, 'Historia clínica registrada con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await clinicalRecordsService.update(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, 'Historia clínica actualizada con trazabilidad');
    } catch (error) {
      next(error);
    }
  }
}

export const clinicalRecordsController = new ClinicalRecordsController();
