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
    patientId: z.coerce.number().int().positive().optional(),
    patient_id: z.coerce.number().int().positive().optional(),
    amount: z.coerce.number().positive('El importe debe ser mayor a 0'),
    paymentMethod: z.string().optional(),
    payment_method: z.string().optional(),
    currency: z.string().default('ARS'),
    receiptNumber: z.string().optional().nullable(),
    receipt_number: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    serviceId: z.coerce.number().int().positive().optional().nullable(),
    service_id: z.coerce.number().int().positive().optional().nullable(),
    packageSessions: z.coerce.number().int().positive().optional().nullable(),
    package_sessions: z.coerce.number().int().positive().optional().nullable()
  }).transform((val) => {
    let method = val.paymentMethod || val.payment_method || 'cash';
    if (method === 'bank_transfer' || method === 'qr_mercadopago') {
      method = 'transfer';
    }
    return {
      patientId: val.patientId || val.patient_id,
      amount: val.amount,
      paymentMethod: method,
      currency: val.currency || 'ARS',
      receiptNumber: val.receiptNumber || val.receipt_number || null,
      notes: val.notes || null,
      serviceId: val.serviceId || val.service_id || null,
      packageSessions: val.packageSessions || val.package_sessions || null
    };
  }).refine((val) => Boolean(val.patientId && ['cash', 'transfer', 'debit_card', 'credit_card', 'insurance'].includes(val.paymentMethod)), {
    message: 'ID de paciente y método de pago válido son obligatorios'
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
