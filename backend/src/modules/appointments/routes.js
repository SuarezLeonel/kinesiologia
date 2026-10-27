import { Router } from 'express';
import { appointmentsController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  appointmentSearchSchema,
  appointmentDetailSchema,
  appointmentCreateSchema,
  appointmentUpdateSchema
} from './schema.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticateToken);
// Admin, Kinesiólogo y Recepcionista pueden gestionar agenda
appointmentsRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));

// Regla HTTP: Solo POST para consultas
appointmentsRouter.post('/search', validate(appointmentSearchSchema), (req, res, next) => appointmentsController.search(req, res, next));
appointmentsRouter.post('/detail', validate(appointmentDetailSchema), (req, res, next) => appointmentsController.detail(req, res, next));
appointmentsRouter.post('/', validate(appointmentCreateSchema), (req, res, next) => appointmentsController.create(req, res, next));
appointmentsRouter.patch('/:id', validate(appointmentUpdateSchema), (req, res, next) => appointmentsController.update(req, res, next));
appointmentsRouter.delete('/:id', (req, res, next) => appointmentsController.delete(req, res, next));
