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
    firstName: z.string().min(2).optional(),
    first_name: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    last_name: z.string().min(2).optional(),
    dni: z.string().min(6).max(20),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    phone: z.string().min(6),
    email: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
    assignedKinesiologistId: z.number().int().positive().optional().nullable(),
    assigned_kinesiologist_id: z.number().int().positive().optional().nullable()
  }).transform((val) => ({
    firstName: (val.firstName || val.first_name || '').trim(),
    lastName: (val.lastName || val.last_name || '').trim(),
    dni: val.dni.trim(),
    birthDate: val.birthDate || val.birth_date,
    phone: val.phone.trim(),
    email: val.email || undefined,
    address: val.address || undefined,
    assignedKinesiologistId: val.assignedKinesiologistId || val.assigned_kinesiologist_id || undefined
  })).refine(val => Boolean(val.firstName) && Boolean(val.lastName) && Boolean(val.birthDate), {
    message: 'Nombre, apellido y fecha de nacimiento son obligatorios'
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

export const patientCheckDuplicateSchema = z.object({
  body: z.object({
    dni: z.string().optional(),
    email: z.string().optional()
  })
});
