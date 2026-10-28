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
    patientId: z.number().int().positive().optional(),
    patient_id: z.number().int().positive().optional(),
    kinesiologistId: z.number().int().positive().optional(),
    kinesiologist_id: z.number().int().positive().optional(),
    serviceId: z.number().int().positive().optional(),
    service_id: z.number().int().positive().optional(),
    startTime: z.string().optional(),
    start_time: z.string().optional(),
    endTime: z.string().optional(),
    end_time: z.string().optional(),
    scheduled_at: z.string().optional(),
    duration_minutes: z.number().optional(),
    durationMinutes: z.number().optional(),
    notes: z.string().optional(),
    reason: z.string().optional()
  }).transform((val) => {
    const patientId = val.patientId || val.patient_id;
    const kinesiologistId = val.kinesiologistId || val.kinesiologist_id;
    const serviceId = val.serviceId || val.service_id || 1;
    let startTime = val.startTime || val.start_time || val.scheduled_at;
    let endTime = val.endTime || val.end_time;
    const duration = val.duration_minutes || val.durationMinutes || 45;

    if (startTime && !endTime) {
      const d = new Date(startTime.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        const endD = new Date(d.getTime() + duration * 60000);
        endTime = endD.toISOString().slice(0, 19).replace('T', ' ');
      }
    }

    return {
      patientId,
      kinesiologistId,
      serviceId,
      startTime,
      endTime: endTime || startTime,
      notes: val.notes || val.reason
    };
  }).refine((val) => Boolean(val.patientId && val.kinesiologistId && val.serviceId && val.startTime), {
    message: 'Paciente, profesional, prestación y horario son obligatorios'
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
