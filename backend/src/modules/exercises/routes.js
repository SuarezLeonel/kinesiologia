/**
 * @file routes.js
 * @module exercises
 * @description Rutas para catálogo de ejercicios (/api/v1/exercises). Consultas vía POST.
 */
import { Router } from 'express';
import { exercisesController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  exerciseSearchSchema,
  exerciseDetailSchema,
  exerciseCreateSchema,
  exerciseUpdateSchema,
  exerciseToggleActiveSchema
} from './schema.js';

export const exercisesRouter = Router();

exercisesRouter.use(authenticateToken);
// Exclusivo para Kinesiólogos y Administradores (sin acceso para Recepcionista ni Pacientes)
exercisesRouter.use(authorizeRoles('admin', 'kinesiologist'));

// REGLA HTTP ESTRICTA: Solo POST para consultas de catálogo y opciones
exercisesRouter.post('/search', validate(exerciseSearchSchema), asyncHandler((req, res, next) => exercisesController.search(req, res, next)));
exercisesRouter.post('/detail', validate(exerciseDetailSchema), asyncHandler((req, res, next) => exercisesController.detail(req, res, next)));
exercisesRouter.post('/filter-options', asyncHandler((req, res, next) => exercisesController.filterOptions(req, res, next)));

// Crear y editar ejercicio: Kinesiólogos y Administradores
exercisesRouter.post('/', validate(exerciseCreateSchema), asyncHandler((req, res, next) => exercisesController.create(req, res, next)));
exercisesRouter.post('/update', validate(exerciseUpdateSchema), asyncHandler((req, res, next) => exercisesController.update(req, res, next)));
exercisesRouter.patch('/:id', validate(exerciseUpdateSchema), asyncHandler((req, res, next) => exercisesController.update(req, res, next)));

// Desactivación lógica y alternancia de estado (POST y DELETE)
exercisesRouter.post('/toggle-active', validate(exerciseToggleActiveSchema), asyncHandler((req, res, next) => exercisesController.toggleActive(req, res, next)));
exercisesRouter.post('/:id/toggle-active', asyncHandler((req, res, next) => exercisesController.toggleActive(req, res, next)));
exercisesRouter.delete('/:id', asyncHandler((req, res, next) => exercisesController.delete(req, res, next)));
