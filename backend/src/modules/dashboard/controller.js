import { dashboardService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class DashboardController {
  async summary(req, res, next) {
    try {
      const result = await dashboardService.getSummary({
        date: req.body?.date,
        currentUser: req.user
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
