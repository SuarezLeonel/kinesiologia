import { Router } from 'express';
import { usersController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  userSearchSchema,
  userDetailSchema,
  userCreateSchema,
  userUpdateSchema
} from './schema.js';

export const usersRouter = Router();

// Todos los endpoints protegidos, exclusivos de Admin con permiso users:manage
usersRouter.use(authenticateToken);
usersRouter.use(authorizeRoles('admin'));
usersRouter.use(authorizePermission('users:manage'));

// Regla HTTP estricta: POST para consultas con filtros/id en body
usersRouter.post('/search', validate(userSearchSchema), asyncHandler((req, res, next) => usersController.search(req, res, next)));
usersRouter.post('/detail', validate(userDetailSchema), asyncHandler((req, res, next) => usersController.detail(req, res, next)));
usersRouter.post('/', validate(userCreateSchema), asyncHandler((req, res, next) => usersController.create(req, res, next)));
usersRouter.patch('/:id', validate(userUpdateSchema), asyncHandler((req, res, next) => usersController.update(req, res, next)));
usersRouter.delete('/:id', asyncHandler((req, res, next) => usersController.delete(req, res, next)));
