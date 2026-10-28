import { z } from 'zod';

export const exerciseSearchSchema = z.object({
  body: z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

export const exerciseDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive()
  })
});

export const exerciseCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    category: z.string().min(2, 'La categoría debe tener al menos 2 caracteres'),
    description: z.string().min(2, 'La descripción debe tener al menos 2 caracteres'),
    instructions: z.string().min(2, 'Las instrucciones deben tener al menos 2 caracteres'),
    defaultSets: z.number().int().positive().optional(),
    defaultRepetitions: z.number().int().positive().optional(),
    mediaUrl: z.string().url('Debe ser una URL válida').optional().nullable()
  })
});

export const exerciseUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    category: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    instructions: z.string().min(2).optional(),
    defaultSets: z.number().int().positive().optional(),
    defaultRepetitions: z.number().int().positive().optional(),
    mediaUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional()
  })
});
