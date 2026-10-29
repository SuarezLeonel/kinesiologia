import { z } from 'zod';

export const exerciseSearchSchema = z.object({
  body: z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    bodyZone: z.string().optional(),
    body_zone: z.string().optional(),
    muscleGroup: z.string().optional(),
    muscle_group: z.string().optional(),
    therapeuticObjective: z.string().optional(),
    therapeutic_objective: z.string().optional(),
    difficultyLevel: z.string().optional(),
    difficulty_level: z.string().optional(),
    equipmentNeeded: z.string().optional(),
    equipment_needed: z.string().optional(),
    isActive: z.union([
      z.boolean(),
      z.string().transform(v => v === 'true' || v === '1'),
      z.number().transform(v => v === 1)
    ]).optional(),
    is_active: z.union([
      z.boolean(),
      z.string().transform(v => v === 'true' || v === '1'),
      z.number().transform(v => v === 1)
    ]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
  })
});

export const exerciseDetailSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('Identificador de ejercicio inválido')
  })
});

export const exerciseCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    category: z.string().min(2, 'La categoría debe tener al menos 2 caracteres'),
    description: z.string().min(2, 'La descripción debe tener al menos 2 caracteres'),
    instructions: z.string().min(2, 'Las instrucciones técnicas deben tener al menos 2 caracteres'),
    bodyZone: z.string().optional().nullable(),
    body_zone: z.string().optional().nullable(),
    muscleGroup: z.string().optional().nullable(),
    muscle_group: z.string().optional().nullable(),
    therapeuticObjective: z.string().optional().nullable(),
    therapeutic_objective: z.string().optional().nullable(),
    equipmentNeeded: z.string().optional().nullable(),
    equipment_needed: z.string().optional().nullable(),
    difficultyLevel: z.enum(['Bajo', 'Medio', 'Alto']).default('Bajo'),
    difficulty_level: z.enum(['Bajo', 'Medio', 'Alto']).optional(),
    contraindications: z.string().optional().nullable(),
    defaultSets: z.coerce.number().int().positive('Debe ser mayor a 0').optional().nullable(),
    default_sets: z.coerce.number().int().positive().optional().nullable(),
    defaultRepetitions: z.coerce.number().int().positive('Debe ser mayor a 0').optional().nullable(),
    default_repetitions: z.coerce.number().int().positive().optional().nullable(),
    mediaUrl: z.string().url('Debe ser una URL válida (http/https)').optional().nullable().or(z.literal('')),
    media_url: z.string().url('Debe ser una URL válida (http/https)').optional().nullable().or(z.literal('')),
    isActive: z.boolean().optional(),
    is_active: z.boolean().optional()
  })
});

export const exerciseUpdateSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    category: z.string().min(2, 'La categoría debe tener al menos 2 caracteres').optional(),
    description: z.string().min(2, 'La descripción debe tener al menos 2 caracteres').optional(),
    instructions: z.string().min(2, 'Las instrucciones técnicas deben tener al menos 2 caracteres').optional(),
    bodyZone: z.string().optional().nullable(),
    body_zone: z.string().optional().nullable(),
    muscleGroup: z.string().optional().nullable(),
    muscle_group: z.string().optional().nullable(),
    therapeuticObjective: z.string().optional().nullable(),
    therapeutic_objective: z.string().optional().nullable(),
    equipmentNeeded: z.string().optional().nullable(),
    equipment_needed: z.string().optional().nullable(),
    difficultyLevel: z.enum(['Bajo', 'Medio', 'Alto']).optional(),
    difficulty_level: z.enum(['Bajo', 'Medio', 'Alto']).optional(),
    contraindications: z.string().optional().nullable(),
    defaultSets: z.coerce.number().int().positive().optional().nullable(),
    default_sets: z.coerce.number().int().positive().optional().nullable(),
    defaultRepetitions: z.coerce.number().int().positive().optional().nullable(),
    default_repetitions: z.coerce.number().int().positive().optional().nullable(),
    mediaUrl: z.string().url('Debe ser una URL válida (http/https)').optional().nullable().or(z.literal('')),
    media_url: z.string().url('Debe ser una URL válida (http/https)').optional().nullable().or(z.literal('')),
    isActive: z.boolean().optional(),
    is_active: z.boolean().optional()
  })
});

export const exerciseToggleActiveSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('Identificador de ejercicio inválido'),
    isActive: z.boolean().optional()
  })
});
