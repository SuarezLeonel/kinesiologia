import { Router } from 'express';
import { patientsController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import {
  patientSearchSchema,
  patientDetailSchema,
  patientCreateSchema,
  patientUpdateSchema
} from './schema.js';

export const patientsRouter = Router();

patientsRouter.use(authenticateToken);
// Admin, Kinesiólogo y Recepcionista pueden consultar pacientes (datos administrativos)
patientsRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));

// Consultas vía POST
patientsRouter.post('/search', validate(patientSearchSchema), (req, res, next) => patientsController.search(req, res, next));
patientsRouter.post('/detail', validate(patientDetailSchema), (req, res, next) => patientsController.detail(req, res, next));
patientsRouter.post('/', validate(patientCreateSchema), (req, res, next) => patientsController.create(req, res, next));
patientsRouter.patch('/:id', validate(patientUpdateSchema), (req, res, next) => patientsController.update(req, res, next));
// Solo Admin y Kinesiólogo pueden desactivar pacientes
patientsRouter.delete('/:id', authorizeRoles('admin', 'kinesiologist'), (req, res, next) => patientsController.delete(req, res, next));
