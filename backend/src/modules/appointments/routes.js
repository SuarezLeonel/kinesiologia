/**
 * @file routes.js
 * @module appointments
 * @description Rutas de Express para el módulo de agenda y turnos (/api/v1/appointments).
 * Aplica regla estricta de cero uso de GET (todo vía POST) y autorización por roles (RBAC).
 */
import { Router } from 'express';
import { appointmentsController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  appointmentSearchSchema,
  appointmentDetailSchema,
  appointmentCreateSchema,
  appointmentUpdateSchema,
  rescheduleRequestsSearchSchema,
  rescheduleRespondSchema
} from './schema.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticateToken);
// Admin, Kinesiólogo y Recepcionista pueden gestionar agenda
appointmentsRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));
appointmentsRouter.use(authorizePermission('appointments:manage'));

// Regla HTTP: Solo POST para consultas
appointmentsRouter.post('/professionals', asyncHandler((req, res, next) => appointmentsController.getProfessionals(req, res, next)));
appointmentsRouter.post('/available-slots', asyncHandler((req, res, next) => appointmentsController.getAvailableSlots(req, res, next)));
appointmentsRouter.post('/search', validate(appointmentSearchSchema), asyncHandler((req, res, next) => appointmentsController.search(req, res, next)));
appointmentsRouter.post('/detail', validate(appointmentDetailSchema), asyncHandler((req, res, next) => appointmentsController.detail(req, res, next)));
appointmentsRouter.post('/reschedule-requests', validate(rescheduleRequestsSearchSchema), asyncHandler((req, res, next) => appointmentsController.getRescheduleRequests(req, res, next)));
appointmentsRouter.post('/reschedule-requests/respond', validate(rescheduleRespondSchema), asyncHandler((req, res, next) => appointmentsController.respondRescheduleRequest(req, res, next)));
appointmentsRouter.post('/', validate(appointmentCreateSchema), asyncHandler((req, res, next) => appointmentsController.create(req, res, next)));
appointmentsRouter.post('/create', validate(appointmentCreateSchema), asyncHandler((req, res, next) => appointmentsController.create(req, res, next)));
appointmentsRouter.patch('/:id', validate(appointmentUpdateSchema), asyncHandler((req, res, next) => appointmentsController.update(req, res, next)));
appointmentsRouter.delete('/:id', asyncHandler((req, res, next) => appointmentsController.delete(req, res, next)));

