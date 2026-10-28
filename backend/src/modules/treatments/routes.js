import { Router } from 'express';
import { treatmentsController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  treatmentSearchSchema,
  treatmentDetailSchema,
  treatmentCreateSchema,
  treatmentUpdateSchema,
  treatmentSessionCreateSchema,
  treatmentSessionSearchSchema,
  treatmentExerciseAddSchema,
  treatmentExerciseRemoveSchema,
  measurementCreateSchema,
  measurementSearchSchema
} from './schema.js';

export const treatmentsRouter = Router();

treatmentsRouter.use(authenticateToken);
// Tratamientos clínicos autorizados para Admin y Kinesiólogo
treatmentsRouter.use(authorizeRoles('admin', 'kinesiologist'));
treatmentsRouter.use(authorizePermission('treatments:manage'));

// REGLA HTTP ESTRICTA: Solo POST para consultas de tratamientos
treatmentsRouter.post('/search', validate(treatmentSearchSchema), asyncHandler((req, res, next) => treatmentsController.search(req, res, next)));
treatmentsRouter.post('/detail', validate(treatmentDetailSchema), asyncHandler((req, res, next) => treatmentsController.detail(req, res, next)));
treatmentsRouter.post('/', validate(treatmentCreateSchema), asyncHandler((req, res, next) => treatmentsController.create(req, res, next)));
treatmentsRouter.patch('/:id', validate(treatmentUpdateSchema), asyncHandler((req, res, next) => treatmentsController.update(req, res, next)));

// --- Sesiones de Tratamiento ---
treatmentsRouter.post('/sessions/search', validate(treatmentSessionSearchSchema), asyncHandler((req, res, next) => treatmentsController.getSessions(req, res, next)));
treatmentsRouter.post('/sessions', validate(treatmentSessionCreateSchema), asyncHandler((req, res, next) => treatmentsController.addSession(req, res, next)));

// --- Ejercicios Asignados al Tratamiento ---
treatmentsRouter.post('/exercises/add', validate(treatmentExerciseAddSchema), asyncHandler((req, res, next) => treatmentsController.addExercise(req, res, next)));
treatmentsRouter.post('/exercises/remove', validate(treatmentExerciseRemoveSchema), asyncHandler((req, res, next) => treatmentsController.removeExercise(req, res, next)));

// --- Mediciones de Evolución ---
treatmentsRouter.post('/measurements/search', validate(measurementSearchSchema), asyncHandler((req, res, next) => treatmentsController.getMeasurements(req, res, next)));
treatmentsRouter.post('/measurements', validate(measurementCreateSchema), asyncHandler((req, res, next) => treatmentsController.addMeasurement(req, res, next)));
