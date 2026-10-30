/**
 * @file controller.js
 * @module clinical-records
 * @description Controlador HTTP para historias clínicas y evaluaciones kinésicas.
 * Exclusivo para kinesiólogos y administradores.
 */
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

  async exportPdf(req, res, next) {
    try {
      const { buffer, filename, record } = await clinicalRecordsService.exportPdf(req.body.id, req.user);

      if (req.body.format === 'base64') {
        return sendSuccess(res, {
          pdfBase64: buffer.toString('base64'),
          filename,
          recordId: record.id
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
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
