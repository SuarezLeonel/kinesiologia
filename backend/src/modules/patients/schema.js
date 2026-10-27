import { z } from 'zod';

export const patientSearchSchema = z.object({
  body: z.object({
    search: z.string().optional(),
    assignedKinesiologistId: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  })
});

export const patientDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de paciente requerido')
  })
});

export const patientCreateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    dni: z.string().min(6).max(20),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
    phone: z.string().min(6),
    email: z.string().email().optional(),
    address: z.string().optional(),
    assignedKinesiologistId: z.number().int().positive().optional()
  })
});

export const patientUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().min(6).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    assignedKinesiologistId: z.number().int().positive().optional(),
    isActive: z.boolean().optional()
  })
});
