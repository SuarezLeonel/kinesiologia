import { z } from 'zod';

export const appointmentSearchSchema = z.object({
  body: z.object({
    kinesiologistId: z.number().int().positive().optional(),
    patientId: z.number().int().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(['pending', 'confirmed', 'attended', 'cancelled', 'absent']).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

export const appointmentDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de turno requerido')
  })
});

export const appointmentCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive(),
    kinesiologistId: z.number().int().positive(),
    serviceId: z.number().int().positive(),
    startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)),
    endTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/)),
    notes: z.string().optional()
  })
});

export const appointmentUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'attended', 'cancelled', 'absent']).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    notes: z.string().optional(),
    reason: z.string().optional()
  })
});
