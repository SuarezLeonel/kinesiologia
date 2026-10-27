import { Router } from 'express';
import { usersController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  userSearchSchema,
  userDetailSchema,
  userCreateSchema,
  userUpdateSchema
} from './schema.js';

export const usersRouter = Router();

// Todos los endpoints protegidos, exclusivos de Admin
usersRouter.use(authenticateToken);
usersRouter.use(authorizeRoles('admin'));

// Regla HTTP estricta: POST para consultas con filtros/id en body
usersRouter.post('/search', validate(userSearchSchema), (req, res, next) => usersController.search(req, res, next));
usersRouter.post('/detail', validate(userDetailSchema), (req, res, next) => usersController.detail(req, res, next));
usersRouter.post('/', validate(userCreateSchema), (req, res, next) => usersController.create(req, res, next));
usersRouter.patch('/:id', validate(userUpdateSchema), (req, res, next) => usersController.update(req, res, next));
usersRouter.delete('/:id', (req, res, next) => usersController.delete(req, res, next));
