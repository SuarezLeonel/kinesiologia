import { paymentsService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class PaymentsController {
  async search(req, res, next) {
    try {
      const results = await paymentsService.search(req.body);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async cajaSummary(req, res, next) {
    try {
      const summary = await paymentsService.getCajaSummary(req.body?.date);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const payment = await paymentsService.getDetail(req.body.id);
      return sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await paymentsService.create(req.body, req.user);
      return sendSuccess(res, created, 'Pago registrado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async consumeSession(req, res, next) {
    try {
      const result = await paymentsService.consumeSession(req.body, req.user);
      return sendSuccess(res, result, 'Sesión descontada correctamente');
    } catch (error) {
      next(error);
    }
  }

  async searchPackages(req, res, next) {
    try {
      const packages = await paymentsService.searchPackages(req.body);
      return sendSuccess(res, packages);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentsController = new PaymentsController();
