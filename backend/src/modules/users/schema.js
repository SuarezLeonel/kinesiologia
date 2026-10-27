import { z } from 'zod';

export const userSearchSchema = z.object({
  body: z.object({
    roleId: z.number().int().optional(),
    search: z.string().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  })
});

export const userDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de usuario requerido')
  })
});

export const userCreateSchema = z.object({
  body: z.object({
    roleId: z.number().int().positive(),
    name: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional()
  })
});

export const userUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),
  body: z.object({
    roleId: z.number().int().positive().optional(),
    name: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional()
  })
});
