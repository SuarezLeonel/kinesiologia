import { Router } from 'express';
import { query } from '../../config/database.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { validate } from '../../middlewares/validate.js';
import { z } from 'zod';

export const exercisesRouter = Router();
exercisesRouter.use(authenticateToken);

const exerciseSearchSchema = z.object({
  body: z.object({
    category: z.string().optional(),
    search: z.string().optional()
  })
});

const exerciseCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    category: z.string().min(2),
    description: z.string().min(2),
    instructions: z.string().min(2),
    defaultSets: z.number().int().positive().optional(),
    defaultRepetitions: z.number().int().positive().optional(),
    mediaUrl: z.string().url().optional()
  })
});

// REGLA HTTP ESTRICTA: Solo POST para consultas de catálogo
exercisesRouter.post('/search', validate(exerciseSearchSchema), async (req, res, next) => {
  try {
    const { category, search } = req.body;
    const conditions = ['is_active = 1'];
    const params = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (search) { conditions.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = await query(`SELECT * FROM exercises ${where} ORDER BY name ASC`, params);
    return sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// Crear ejercicio: Solo Kinesiólogos y Administradores
exercisesRouter.post('/', authorizeRoles('admin', 'kinesiologist'), validate(exerciseCreateSchema), async (req, res, next) => {
  try {
    const { name, category, description, instructions, defaultSets, defaultRepetitions, mediaUrl } = req.body;
    const result = await query(`
      INSERT INTO exercises (name, category, description, instructions, default_sets, default_repetitions, media_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [name, category, description, instructions, defaultSets || null, defaultRepetitions || null, mediaUrl || null]);
    return sendSuccess(res, { id: result.insertId, ...req.body }, 'Ejercicio registrado', 201);
  } catch (err) {
    next(err);
  }
});
