/**
 * @file schema.js
 * @module dashboard
 * @description Esquemas Zod para filtros de fecha en el dashboard.
 */
import { z } from 'zod';

export const dashboardSummarySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional()
  })
});
