/**
 * @file routes.js
 * @module vacations
 * @description Rutas de Express para el módulo de vacaciones (/api/v1/vacations).
 * Regla de negocio estricta: solo solicitudes POST y autorización de roles en backend.
 */
import { Router } from 'express';
import { vacationsController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  vacationSearchSchema,
  vacationPreviewSchema,
  vacationCreateSchema,
  vacationCancelSchema,
  vacationAffectedAppointmentsSchema,
  vacationReassignAppointmentSchema,
  vacationCancellationNotificationsSearchSchema,
  vacationMarkNotificationSentSchema
} from './schema.js';

export const vacationsRouter = Router();

vacationsRouter.use(authenticateToken);
vacationsRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));

// Consultas y búsquedas (POST por regla de negocio)
vacationsRouter.post('/search', validate(vacationSearchSchema), asyncHandler((req, res, next) => vacationsController.search(req, res, next)));
vacationsRouter.post('/preview', validate(vacationPreviewSchema), asyncHandler((req, res, next) => vacationsController.preview(req, res, next)));
vacationsRouter.post('/create', validate(vacationCreateSchema), asyncHandler((req, res, next) => vacationsController.create(req, res, next)));
vacationsRouter.post('/cancel', validate(vacationCancelSchema), asyncHandler((req, res, next) => vacationsController.cancel(req, res, next)));
vacationsRouter.post('/affected-appointments', validate(vacationAffectedAppointmentsSchema), asyncHandler((req, res, next) => vacationsController.getAffectedAppointments(req, res, next)));
vacationsRouter.post('/reassign-appointment', validate(vacationReassignAppointmentSchema), asyncHandler((req, res, next) => vacationsController.reassignAppointment(req, res, next)));
vacationsRouter.post('/active-alerts', asyncHandler((req, res, next) => vacationsController.getActiveAlerts(req, res, next)));
vacationsRouter.post('/alerts', asyncHandler((req, res, next) => vacationsController.getActiveAlerts(req, res, next)));
vacationsRouter.post(
  '/cancellation-notifications',
  authorizeRoles('admin', 'receptionist'),
  validate(vacationCancellationNotificationsSearchSchema),
  asyncHandler((req, res, next) => vacationsController.getCancellationNotifications(req, res, next))
);
vacationsRouter.post(
  '/mark-notification-sent',
  authorizeRoles('admin', 'receptionist'),
  validate(vacationMarkNotificationSentSchema),
  asyncHandler((req, res, next) => vacationsController.markCancellationNotificationSent(req, res, next))
);
