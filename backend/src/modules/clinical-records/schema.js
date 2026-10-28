import { z } from 'zod';

export const clinicalRecordSearchSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

export const clinicalRecordDetailSchema = z.object({
  body: z.object({
    id: z.number().int().positive('ID de historia clínica requerido')
  })
});

export const clinicalRecordCreateSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive().optional(),
    patient_id: z.coerce.number().int().positive().optional(),
    consultationReason: z.string().min(3).optional(),
    consultation_reason: z.string().min(3).optional(),
    reason_for_consultation: z.string().min(3).optional(),
    medicalHistory: z.string().optional(),
    medical_history: z.string().optional(),
    initialEvaluation: z.string().min(3).optional(),
    initial_evaluation: z.string().min(3).optional(),
    subjective_assessment: z.string().optional(),
    objective_assessment: z.string().optional(),
    diagnosis: z.string().min(3),
    reportedPainLevel: z.coerce.number().min(0).max(10).optional(),
    reported_pain_level: z.coerce.number().min(0).max(10).optional(),
    pain_scale_initial: z.coerce.number().min(0).max(10).optional(),
    treatmentPlan: z.string().optional(),
    treatment_plan: z.string().optional(),
    mobilityEvaluation: z.string().optional(),
    functionalLimitations: z.string().optional(),
    treatmentGoals: z.string().optional(),
    generalObservations: z.string().optional()
  }).transform((val) => {
    const consultationReason = val.consultationReason || val.consultation_reason || val.reason_for_consultation || 'Evaluación kinésica';
    const initialEvaluation = val.initialEvaluation || val.initial_evaluation || [val.subjective_assessment, val.objective_assessment].filter(Boolean).join(' | ') || 'Evaluación inicial';
    const reportedPainLevel = val.reportedPainLevel ?? val.reported_pain_level ?? val.pain_scale_initial ?? 5;
    return {
      patientId: val.patientId || val.patient_id,
      consultationReason,
      medicalHistory: val.medicalHistory || val.medical_history,
      initialEvaluation,
      diagnosis: val.diagnosis,
      reportedPainLevel,
      mobilityEvaluation: val.mobilityEvaluation,
      functionalLimitations: val.functionalLimitations,
      treatmentGoals: val.treatmentGoals || val.treatmentPlan || val.treatment_plan,
      generalObservations: val.generalObservations
    };
  }).refine((val) => Boolean(val.patientId && val.diagnosis), {
    message: 'Paciente y diagnóstico son obligatorios'
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
