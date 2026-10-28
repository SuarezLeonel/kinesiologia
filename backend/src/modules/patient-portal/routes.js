import { Router } from 'express';
import { patientPortalController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  availableSlotsSchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  requestRescheduleSchema,
  updateProfileSchema
} from './schema.js';

export const patientPortalRouter = Router();

// Protegido: Solo usuarios con rol 'patient'
patientPortalRouter.use(authenticateToken);
patientPortalRouter.use(authorizeRoles('patient'));

// Todos los endpoints utilizan POST de acuerdo con AGENTS.md
patientPortalRouter.post('/dashboard', asyncHandler((req, res, next) => patientPortalController.dashboard(req, res, next)));
patientPortalRouter.post('/my-appointments', asyncHandler((req, res, next) => patientPortalController.myAppointments(req, res, next)));
patientPortalRouter.post('/catalog', asyncHandler((req, res, next) => patientPortalController.catalog(req, res, next)));
patientPortalRouter.post('/available-slots', validate(availableSlotsSchema), asyncHandler((req, res, next) => patientPortalController.availableSlots(req, res, next)));
patientPortalRouter.post('/book-appointment', validate(bookAppointmentSchema), asyncHandler((req, res, next) => patientPortalController.bookAppointment(req, res, next)));
patientPortalRouter.post('/cancel-appointment', validate(cancelAppointmentSchema), asyncHandler((req, res, next) => patientPortalController.cancelAppointment(req, res, next)));
patientPortalRouter.post('/request-reschedule', validate(requestRescheduleSchema), asyncHandler((req, res, next) => patientPortalController.requestReschedule(req, res, next)));
patientPortalRouter.post('/my-reschedule-requests', asyncHandler((req, res, next) => patientPortalController.myRescheduleRequests(req, res, next)));
patientPortalRouter.post('/my-profile', asyncHandler((req, res, next) => patientPortalController.myProfile(req, res, next)));
patientPortalRouter.post('/update-profile', validate(updateProfileSchema), asyncHandler((req, res, next) => patientPortalController.updateProfile(req, res, next)));
patientPortalRouter.post('/my-notifications', asyncHandler((req, res, next) => patientPortalController.myNotifications(req, res, next)));
