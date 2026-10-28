import { z } from 'zod';

export const treatmentSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive().optional(),
    status: z.enum(['active', 'completed', 'suspended']).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

export const treatmentDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de tratamiento requerido')
  })
});

export const treatmentCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    clinicalRecordId: z.number().int().positive().optional().nullable(),
    title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
    diagnosisSummary: z.string().min(2, 'El diagnóstico debe tener al menos 2 caracteres'),
    objectives: z.string().min(2, 'Los objetivos deben tener al menos 2 caracteres'),
    totalPlannedSessions: z.number().int().positive().default(10),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha de inicio inválido (YYYY-MM-DD)')
  })
});

export const treatmentUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    diagnosisSummary: z.string().min(2).optional(),
    objectives: z.string().min(2).optional(),
    totalPlannedSessions: z.number().int().positive().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha de fin inválido').optional().nullable(),
    status: z.enum(['active', 'completed', 'suspended']).optional()
  })
});

export const treatmentSessionCreateSchema = z.object({
  body: z.object({
    treatmentId: z.number().int().positive('ID de tratamiento requerido'),
    appointmentId: z.number().int().positive().optional().nullable(),
    sessionNumber: z.number().int().positive('El número de sesión debe ser mayor a 0'),
    sessionDate: z.string().min(10, 'Fecha de sesión requerida'),
    performedProcedures: z.string().min(2, 'Procedimientos realizados requeridos'),
    patientEvolution: z.string().min(2, 'Evolución del paciente requerida'),
    painLevelReported: z.number().int().min(0).max(10).optional().nullable(),
    observations: z.string().optional().nullable()
  })
});

export const treatmentSessionSearchSchema = z.object({
  body: z.object({
    treatmentId: z.number().int().positive('ID de tratamiento requerido')
  })
});

export const treatmentExerciseAddSchema = z.object({
  body: z.object({
    treatmentId: z.number().int().positive('ID de tratamiento requerido'),
    exerciseId: z.number().int().positive('ID de ejercicio requerido'),
    customSets: z.number().int().positive().optional().nullable(),
    customRepetitions: z.number().int().positive().optional().nullable(),
    frequencyInstructions: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })
});

export const treatmentExerciseRemoveSchema = z.object({
  body: z.object({
    treatmentId: z.number().int().positive('ID de tratamiento requerido'),
    exerciseId: z.number().int().positive('ID de ejercicio requerido')
  })
});

export const measurementCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    treatmentId: z.number().int().positive().optional().nullable(),
    sessionId: z.number().int().positive().optional().nullable(),
    measurementType: z.enum(['pain_scale', 'range_of_motion', 'muscle_strength', 'functional_capacity']),
    metricName: z.string().min(2, 'Nombre de métrica requerido'),
    valueNumeric: z.number(),
    unit: z.string().min(1, 'Unidad de medida requerida'),
    bodyZone: z.string().optional().nullable(),
    measuredAt: z.string().min(10, 'Fecha de medición requerida'),
    notes: z.string().optional().nullable()
  })
});

export const measurementSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    treatmentId: z.number().int().positive().optional().nullable()
  })
});
