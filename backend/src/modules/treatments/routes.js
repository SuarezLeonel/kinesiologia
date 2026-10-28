import { Router } from 'express';
import { query } from '../../config/database.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit } from '../../utils/auditLogger.js';
import { z } from 'zod';

export const treatmentsRouter = Router();
treatmentsRouter.use(authenticateToken);
treatmentsRouter.use(authorizeRoles('admin', 'kinesiologist'));
treatmentsRouter.use(authorizePermission('treatments:manage'));

const treatmentSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive().optional(),
    status: z.enum(['active', 'completed', 'suspended']).optional()
  })
});

const treatmentCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive(),
    title: z.string().min(2),
    diagnosisSummary: z.string().min(2),
    objectives: z.string().min(2),
    totalPlannedSessions: z.number().int().positive().default(10),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  })
});

// Regla HTTP: Solo POST para consultas de tratamientos
treatmentsRouter.post('/search', validate(treatmentSearchSchema), asyncHandler(async (req, res) => {
  const { patientId, status } = req.body;
  const conditions = [];
  const params = [];
  if (patientId) { conditions.push('t.patient_id = ?'); params.push(patientId); }
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT t.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
           u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
    FROM treatments t
    JOIN patients p ON t.patient_id = p.id
    JOIN users u ON t.kinesiologist_id = u.id
    ${where}
    ORDER BY t.start_date DESC
  `;
  const rows = await query(sql, params);
  return sendSuccess(res, rows);
}));

treatmentsRouter.post('/', validate(treatmentCreateSchema), asyncHandler(async (req, res) => {
  const data = req.body;
  const result = await query(`
    INSERT INTO treatments (patient_id, kinesiologist_id, title, diagnosis_summary, objectives, total_planned_sessions, start_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `, [data.patientId, req.user.id, data.title, data.diagnosisSummary, data.objectives, data.totalPlannedSessions, data.startDate]);

  await logAudit({
    userId: req.user.id,
    action: 'TREATMENT_CREATED',
    entityType: 'treatment',
    entityId: result.insertId,
    details: { patientId: data.patientId, title: data.title }
  });

  return sendSuccess(res, { id: result.insertId, ...data }, 'Tratamiento creado', 201);
}));
