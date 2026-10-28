import { z } from 'zod';

export const paymentSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

export const paymentDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive()
  })
});

export const paymentCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    amount: z.number().positive('El importe debe ser mayor a 0'),
    paymentMethod: z.enum(['cash', 'transfer', 'debit_card', 'credit_card', 'insurance']),
    currency: z.string().default('ARS'),
    receiptNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    serviceId: z.number().int().positive().optional().nullable(),
    packageSessions: z.number().int().positive().optional().nullable()
  })
});

export const sessionConsumeSchema = z.object({
  body: z.object({
    packageId: z.number().int().positive('ID de paquete requerido'),
    sessionId: z.number().int().positive().optional().nullable(),
    reason: z.string().default('Consumo de sesión')
  })
});

export const packageSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    status: z.enum(['active', 'exhausted', 'expired']).optional()
  })
});
