import { z } from 'zod';

export const availableSlotsSchema = z.object({
  body: z.object({
    kinesiologistId: z.coerce.number().int().positive('ID de profesional requerido').default(2),
    serviceId: z.coerce.number().int().positive('ID de prestación requerido').default(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha AAAA-MM-DD').optional()
  })
});

export const bookAppointmentSchema = z.object({
  body: z.object({
    kinesiologistId: z.coerce.number().int().positive('ID de profesional requerido'),
    serviceId: z.coerce.number().int().positive('ID de prestación requerido'),
    startTime: z.string().min(16, 'Horario de inicio requerido (AAAA-MM-DD HH:MM:SS)'),
    notes: z.string().max(255).optional()
  })
});

export const cancelAppointmentSchema = z.object({
  body: z.object({
    appointmentId: z.number().int().positive('ID de turno requerido'),
    reason: z.string().min(3, 'Indique el motivo de la cancelación')
  })
});

export const requestRescheduleSchema = z.object({
  body: z.object({
    appointmentId: z.number().int().positive('ID de turno requerido'),
    requestedStartTime: z.string().min(16, 'Nuevo horario de inicio requerido (AAAA-MM-DD HH:MM:SS)'),
    reason: z.string().min(3, 'Indique el motivo de la solicitud de reprogramación')
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    phone: z.string().min(6, 'Ingrese un teléfono válido').optional()
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Ingrese su contraseña actual'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
  })
});
