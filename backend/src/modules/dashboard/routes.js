import { Router } from 'express';
import { dashboardController } from './controller.js';
import { authenticateToken } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { dashboardSummarySchema } from './schema.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);

// Regla HTTP: POST para obtener resumen del dashboard
dashboardRouter.post(
  '/summary',
  validate(dashboardSummarySchema),
  asyncHandler((req, res, next) => dashboardController.summary(req, res, next))
);
