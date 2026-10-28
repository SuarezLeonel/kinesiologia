import { Router } from 'express';
import { paymentsController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  paymentSearchSchema,
  paymentDetailSchema,
  paymentCreateSchema,
  sessionConsumeSchema,
  packageSearchSchema
} from './schema.js';

export const paymentsRouter = Router();

paymentsRouter.use(authenticateToken);
// Cobros y paquetes autorizados para Admin y Recepcionista
paymentsRouter.use(authorizeRoles('admin', 'receptionist'));
paymentsRouter.use(authorizePermission('payments:manage'));

// REGLA HTTP ESTRICTA: Solo POST para consultas de pagos
paymentsRouter.post('/search', validate(paymentSearchSchema), asyncHandler((req, res, next) => paymentsController.search(req, res, next)));
paymentsRouter.post('/detail', validate(paymentDetailSchema), asyncHandler((req, res, next) => paymentsController.detail(req, res, next)));
paymentsRouter.post('/', validate(paymentCreateSchema), asyncHandler((req, res, next) => paymentsController.create(req, res, next)));
paymentsRouter.post('/consume-session', validate(sessionConsumeSchema), asyncHandler((req, res, next) => paymentsController.consumeSession(req, res, next)));
paymentsRouter.post('/packages/search', validate(packageSearchSchema), asyncHandler((req, res, next) => paymentsController.searchPackages(req, res, next)));
