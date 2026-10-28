import { Router } from 'express';
import { clinicalRecordsController } from './controller.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  clinicalRecordSearchSchema,
  clinicalRecordDetailSchema,
  clinicalRecordCreateSchema,
  clinicalRecordUpdateSchema
} from './schema.js';

export const clinicalRecordsRouter = Router();

clinicalRecordsRouter.use(authenticateToken);
// Acceso exclusivo para administradores y kinesiólogos (recepcionistas bloqueadas)
clinicalRecordsRouter.use(authorizeRoles('admin', 'kinesiologist'));

// Regla HTTP: Solo POST para consultas de historias clínicas
clinicalRecordsRouter.post('/search', authorizePermission('clinical_records:read'), validate(clinicalRecordSearchSchema), asyncHandler((req, res, next) => clinicalRecordsController.search(req, res, next)));
clinicalRecordsRouter.post('/detail', authorizePermission('clinical_records:read'), validate(clinicalRecordDetailSchema), asyncHandler((req, res, next) => clinicalRecordsController.detail(req, res, next)));
clinicalRecordsRouter.post('/', authorizePermission('clinical_records:write'), validate(clinicalRecordCreateSchema), asyncHandler((req, res, next) => clinicalRecordsController.create(req, res, next)));
clinicalRecordsRouter.post('/create', authorizePermission('clinical_records:write'), validate(clinicalRecordCreateSchema), asyncHandler((req, res, next) => clinicalRecordsController.create(req, res, next)));
clinicalRecordsRouter.patch('/:id', authorizePermission('clinical_records:write'), validate(clinicalRecordUpdateSchema), asyncHandler((req, res, next) => clinicalRecordsController.update(req, res, next)));
