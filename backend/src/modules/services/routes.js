/**
 * @file routes.js
 * @module services
 * @description Rutas para el catálogo de servicios (/api/v1/services). Alta y edición exclusiva para Administrador.
 */
import { Router } from 'express';
import { servicesController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  serviceSearchSchema,
  serviceDetailSchema,
  serviceCreateSchema,
  serviceUpdateSchema
} from './schema.js';

export const servicesRouter = Router();

servicesRouter.use(authenticateToken);

// Catálogo visible para todos los roles autenticados (Admin, Kinesiólogo, Recepcionista)
servicesRouter.post('/search', validate(serviceSearchSchema), asyncHandler((req, res, next) => servicesController.search(req, res, next)));
servicesRouter.post('/detail', validate(serviceDetailSchema), asyncHandler((req, res, next) => servicesController.detail(req, res, next)));

// Gestión de tarifas y prestaciones: Exclusivo de Administrador
servicesRouter.post('/', authorizeRoles('admin'), validate(serviceCreateSchema), asyncHandler((req, res, next) => servicesController.create(req, res, next)));
servicesRouter.patch('/:id', authorizeRoles('admin'), validate(serviceUpdateSchema), asyncHandler((req, res, next) => servicesController.update(req, res, next)));
