import { z } from 'zod';

export const clinicalRecordSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive('ID de paciente requerido'),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  })
});

export const clinicalRecordDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de historia clínica requerido')
  })
});

export const clinicalRecordCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive(),
    consultationReason: z.string().min(3),
    medicalHistory: z.string().optional(),
    initialEvaluation: z.string().min(3),
    diagnosis: z.string().min(3),
    reportedPainLevel: z.number().min(0).max(10).optional(),
    mobilityEvaluation: z.string().optional(),
    functionalLimitations: z.string().optional(),
    treatmentGoals: z.string().optional(),
    generalObservations: z.string().optional()
  })
});

export const clinicalRecordUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),
  body: z.object({
    consultationReason: z.string().min(3).optional(),
    diagnosis: z.string().min(3).optional(),
    initialEvaluation: z.string().min(3).optional(),
    reportedPainLevel: z.number().min(0).max(10).optional(),
    generalObservations: z.string().optional(),
    changeReason: z.string().min(3, 'El motivo del cambio es obligatorio para trazabilidad')
  })
});
