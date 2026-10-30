/**
 * @file schema.js
 * @module services
 * @description Esquemas Zod para creación y actualización de aranceles de servicios clínicos.
 */
import { z } from 'zod';

export const serviceSearchSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    search: z.string().optional()
  })
});

export const serviceDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive()
  })
});

export const serviceCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().default(45),
    defaultPrice: z.number().min(0, 'El precio no puede ser negativo')
  })
});

export const serviceUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    defaultPrice: z.number().min(0).optional(),
    isActive: z.boolean().optional()
  })
});
