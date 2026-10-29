import { Router } from 'express';
import { exercisesController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  exerciseSearchSchema,
  exerciseDetailSchema,
  exerciseCreateSchema,
  exerciseUpdateSchema
} from './schema.js';

export const exercisesRouter = Router();

exercisesRouter.use(authenticateToken);
// Exclusivo para Kinesiólogos y Administradores (sin acceso para Recepcionista)
exercisesRouter.use(authorizeRoles('admin', 'kinesiologist'));

// REGLA HTTP ESTRICTA: Solo POST para consultas de catálogo
exercisesRouter.post('/search', validate(exerciseSearchSchema), asyncHandler((req, res, next) => exercisesController.search(req, res, next)));
exercisesRouter.post('/detail', validate(exerciseDetailSchema), asyncHandler((req, res, next) => exercisesController.detail(req, res, next)));

// Crear y editar ejercicio: Kinesiólogos y Administradores
exercisesRouter.post('/', validate(exerciseCreateSchema), asyncHandler((req, res, next) => exercisesController.create(req, res, next)));
exercisesRouter.patch('/:id', validate(exerciseUpdateSchema), asyncHandler((req, res, next) => exercisesController.update(req, res, next)));
exercisesRouter.delete('/:id', asyncHandler((req, res, next) => exercisesController.delete(req, res, next)));
