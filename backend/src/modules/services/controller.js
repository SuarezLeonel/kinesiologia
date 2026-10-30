/**
 * @file controller.js
 * @module services
 * @description Controlador HTTP para el catálogo de servicios clínicos y tarifario del consultorio.
 */
import { servicesService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class ServicesController {
  async search(req, res, next) {
    try {
      const results = await servicesService.search(req.body);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const item = await servicesService.getDetail(req.body.id);
      return sendSuccess(res, item);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await servicesService.create(req.body, req.user);
      return sendSuccess(res, created, 'Servicio registrado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await servicesService.update(req.params.id, req.body, req.user);
      return sendSuccess(res, updated, 'Servicio actualizado');
    } catch (error) {
      next(error);
    }
  }
}

export const servicesController = new ServicesController();
