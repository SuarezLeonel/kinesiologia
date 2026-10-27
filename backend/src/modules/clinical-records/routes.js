import { Router } from 'express';
import { clinicalRecordsController } from './controller.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
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
clinicalRecordsRouter.post('/search', validate(clinicalRecordSearchSchema), (req, res, next) => clinicalRecordsController.search(req, res, next));
clinicalRecordsRouter.post('/detail', validate(clinicalRecordDetailSchema), (req, res, next) => clinicalRecordsController.detail(req, res, next));
clinicalRecordsRouter.post('/', validate(clinicalRecordCreateSchema), (req, res, next) => clinicalRecordsController.create(req, res, next));
clinicalRecordsRouter.patch('/:id', validate(clinicalRecordUpdateSchema), (req, res, next) => clinicalRecordsController.update(req, res, next));
