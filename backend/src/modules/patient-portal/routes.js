/**
 * @file routes.js
 * @module patient-portal
 * @description Rutas del portal del paciente (/api/v1/patient-portal). Restringido al paciente autenticado.
 */
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
  updateProfileSchema,
  changePasswordSchema,
  logExerciseSchema,
  myExerciseLogsSchema
} from './schema.js';

export const patientPortalRouter = Router();

// Protegido por autenticación
patientPortalRouter.use(authenticateToken);

// Catálogo y consulta de horarios disponibles
patientPortalRouter.post('/catalog', asyncHandler((req, res, next) => patientPortalController.catalog(req, res, next)));
patientPortalRouter.post('/available-slots', validate(availableSlotsSchema), asyncHandler((req, res, next) => patientPortalController.availableSlots(req, res, next)));

// Rutas exclusivas para usuarios con rol 'patient'
patientPortalRouter.use(authorizeRoles('patient'));

// Todos los endpoints utilizan POST de acuerdo con AGENTS.md
patientPortalRouter.post('/dashboard', asyncHandler((req, res, next) => patientPortalController.dashboard(req, res, next)));
patientPortalRouter.post('/my-appointments', asyncHandler((req, res, next) => patientPortalController.myAppointments(req, res, next)));
patientPortalRouter.post('/book-appointment', validate(bookAppointmentSchema), asyncHandler((req, res, next) => patientPortalController.bookAppointment(req, res, next)));
patientPortalRouter.post('/cancel-appointment', validate(cancelAppointmentSchema), asyncHandler((req, res, next) => patientPortalController.cancelAppointment(req, res, next)));
patientPortalRouter.post('/request-reschedule', validate(requestRescheduleSchema), asyncHandler((req, res, next) => patientPortalController.requestReschedule(req, res, next)));
patientPortalRouter.post('/my-reschedule-requests', asyncHandler((req, res, next) => patientPortalController.myRescheduleRequests(req, res, next)));
patientPortalRouter.post('/my-profile', asyncHandler((req, res, next) => patientPortalController.myProfile(req, res, next)));
patientPortalRouter.post('/update-profile', validate(updateProfileSchema), asyncHandler((req, res, next) => patientPortalController.updateProfile(req, res, next)));
patientPortalRouter.post('/change-password', validate(changePasswordSchema), asyncHandler((req, res, next) => patientPortalController.changePassword(req, res, next)));
patientPortalRouter.post('/my-notifications', asyncHandler((req, res, next) => patientPortalController.myNotifications(req, res, next)));

// Ejercicios y rutinas terapéuticas del paciente
patientPortalRouter.post('/my-routines', asyncHandler((req, res, next) => patientPortalController.myRoutines(req, res, next)));
patientPortalRouter.post('/log-exercise', validate(logExerciseSchema), asyncHandler((req, res, next) => patientPortalController.logExercise(req, res, next)));
patientPortalRouter.post('/my-exercise-logs', validate(myExerciseLogsSchema), asyncHandler((req, res, next) => patientPortalController.myExerciseLogs(req, res, next)));
