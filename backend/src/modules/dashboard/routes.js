/**
 * @file routes.js
 * @module dashboard
 * @description Rutas del dashboard (/api/v1/dashboard). Filtra datos financieros según el rol del usuario autenticado.
 */
import { Router } from 'express';
import { dashboardController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { dashboardSummarySchema } from './schema.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);
dashboardRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));

// Regla HTTP: POST para obtener resumen del dashboard
dashboardRouter.post(
  '/summary',
  validate(dashboardSummarySchema),
  asyncHandler((req, res, next) => dashboardController.summary(req, res, next))
);
