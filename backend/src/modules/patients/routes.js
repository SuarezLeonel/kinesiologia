import { Router } from 'express';
import { patientsController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  patientSearchSchema,
  patientDetailSchema,
  patientCreateSchema,
  patientUpdateSchema,
  patientCheckDuplicateSchema
} from './schema.js';

export const patientsRouter = Router();

patientsRouter.use(authenticateToken);
// Admin, Kinesiólogo y Recepcionista pueden consultar pacientes (datos administrativos)
patientsRouter.use(authorizeRoles('admin', 'kinesiologist', 'receptionist'));

// Consultas vía POST con verificación de permisos y asyncHandler
patientsRouter.post('/check-duplicate', authorizePermission('patients:write'), validate(patientCheckDuplicateSchema), asyncHandler((req, res, next) => patientsController.checkDuplicate(req, res, next)));
patientsRouter.post('/search', authorizePermission('patients:read'), validate(patientSearchSchema), asyncHandler((req, res, next) => patientsController.search(req, res, next)));
patientsRouter.post('/detail', authorizePermission('patients:read'), validate(patientDetailSchema), asyncHandler((req, res, next) => patientsController.detail(req, res, next)));
patientsRouter.post('/', authorizePermission('patients:write'), validate(patientCreateSchema), asyncHandler((req, res, next) => patientsController.create(req, res, next)));
patientsRouter.post('/create', authorizePermission('patients:write'), validate(patientCreateSchema), asyncHandler((req, res, next) => patientsController.create(req, res, next)));
patientsRouter.patch('/:id', authorizePermission('patients:write'), validate(patientUpdateSchema), asyncHandler((req, res, next) => patientsController.update(req, res, next)));
// Solo Admin y Kinesiólogo pueden desactivar pacientes
patientsRouter.delete('/:id', authorizeRoles('admin', 'kinesiologist'), authorizePermission('patients:write'), asyncHandler((req, res, next) => patientsController.delete(req, res, next)));
