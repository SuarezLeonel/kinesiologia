/**
 * @file schema.js
 * @module treatments
 * @description Esquemas Zod para rutinas terapéuticas y ejecución de sesiones en consultorio.
 */
import { z } from 'zod';

export const treatmentSearchSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive().optional(),
    status: z.enum(['active', 'completed', 'suspended']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

export const treatmentDetailSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('ID de tratamiento requerido')
  })
});

export const treatmentCreateSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive('ID de paciente requerido'),
    clinicalRecordId: z.coerce.number().int().positive().optional().nullable(),
    title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
    diagnosisSummary: z.string().min(2, 'El diagnóstico debe tener al menos 2 caracteres'),
    objectives: z.string().min(2, 'Los objetivos deben tener al menos 2 caracteres'),
    totalPlannedSessions: z.coerce.number().int().positive().default(10),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha de inicio inválido (YYYY-MM-DD)')
  })
});

export const treatmentUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    diagnosisSummary: z.string().min(2).optional(),
    objectives: z.string().min(2).optional(),
    totalPlannedSessions: z.coerce.number().int().positive().optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha de fin inválido').optional().nullable(),
    status: z.enum(['active', 'completed', 'suspended']).optional()
  })
});

export const treatmentSessionCreateSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive('ID de tratamiento requerido'),
    appointmentId: z.coerce.number().int().positive().optional().nullable(),
    sessionNumber: z.coerce.number().int().positive('El número de sesión debe ser mayor a 0'),
    sessionDate: z.string().min(10, 'Fecha de sesión requerida'),
    performedProcedures: z.string().min(2, 'Procedimientos realizados requeridos'),
    patientEvolution: z.string().min(2, 'Evolución del paciente requerida'),
    painLevelReported: z.coerce.number().int().min(0).max(10).optional().nullable(),
    observations: z.string().optional().nullable(),
    routineId: z.coerce.number().int().positive().optional().nullable(),
    exercises: z.array(z.object({
      exerciseId: z.coerce.number().int().positive('ID de ejercicio requerido'),
      routineExerciseId: z.coerce.number().int().positive().optional().nullable(),
      setsCompleted: z.coerce.number().int().positive('Series realizadas requeridas'),
      repsCompleted: z.coerce.number().int().positive('Repeticiones realizadas requeridas'),
      resistanceLoad: z.string().max(120).optional().nullable(),
      toleranceLevel: z.enum(['Excelente', 'Buena', 'Regular', 'Mala', 'Intolerancia']).default('Buena'),
      painLevelReported: z.coerce.number().int().min(0).max(10).optional().nullable(),
      clinicalObservations: z.string().optional().nullable(),
      futureModificationsSuggested: z.string().optional().nullable()
    })).optional().default([])
  })
});

export const patientTrackingSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive('ID de paciente requerido'),
    treatmentId: z.coerce.number().int().positive().optional()
  })
});

export const treatmentSessionSearchSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive('ID de tratamiento requerido')
  })
});

export const treatmentExerciseAddSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive('ID de tratamiento requerido'),
    exerciseId: z.coerce.number().int().positive('ID de ejercicio requerido'),
    customSets: z.coerce.number().int().positive().optional().nullable(),
    customRepetitions: z.coerce.number().int().positive().optional().nullable(),
    frequencyInstructions: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })
});

export const treatmentExerciseRemoveSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive('ID de tratamiento requerido'),
    exerciseId: z.coerce.number().int().positive('ID de ejercicio requerido')
  })
});

export const measurementCreateSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive('ID de paciente requerido'),
    treatmentId: z.coerce.number().int().positive().optional().nullable(),
    sessionId: z.coerce.number().int().positive().optional().nullable(),
    measurementType: z.enum(['pain_scale', 'range_of_motion', 'muscle_strength', 'functional_capacity']),
    metricName: z.string().min(2, 'Nombre de métrica requerido'),
    valueNumeric: z.coerce.number(),
    unit: z.string().min(1, 'Unidad de medida requerida'),
    bodyZone: z.string().optional().nullable(),
    measuredAt: z.string().min(10, 'Fecha de medición requerida'),
    notes: z.string().optional().nullable()
  })
});

export const measurementSearchSchema = z.object({
  body: z.object({
    patientId: z.coerce.number().int().positive('ID de paciente requerido'),
    treatmentId: z.coerce.number().int().positive().optional().nullable()
  })
});

// ========================================================
// ESQUEMAS DE RUTINAS TERAPÉUTICAS Y PRESCRIPCIÓN CLÍNICA
// ========================================================

export const routineExerciseItemSchema = z.object({
  exerciseId: z.coerce.number().int().positive('ID de ejercicio requerido'),
  sets: z.coerce.number().int().positive('Series debe ser mayor a 0').optional().nullable().default(3),
  repetitions: z.coerce.number().int().positive('Repeticiones debe ser mayor a 0').optional().nullable().default(10),
  durationSeconds: z.coerce.number().int().positive('Duración debe ser en segundos').optional().nullable(),
  restSeconds: z.coerce.number().int().nonnegative('Descanso debe ser 0 o mayor').optional().nullable().default(60),
  weeklyFrequency: z.string().optional().nullable().default('3 veces por semana'),
  bodySide: z.enum(['Bilateral', 'Izquierdo', 'Derecho', 'No aplica']).default('Bilateral'),
  resistanceLoad: z.string().optional().nullable(),
  customInstructions: z.string().optional().nullable(),
  executionOrder: z.coerce.number().int().positive().default(1)
});

export const routineSearchSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive().optional(),
    patientId: z.coerce.number().int().positive().optional(),
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
    includeHistory: z.boolean().optional().default(true)
  })
});

export const routineDetailSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('ID de rutina requerido')
  })
});

export const routineCreateSchema = z.object({
  body: z.object({
    treatmentId: z.coerce.number().int().positive('ID de tratamiento requerido'),
    name: z.string().min(2, 'El nombre de la rutina debe tener al menos 2 caracteres'),
    description: z.string().optional().nullable(),
    status: z.enum(['draft', 'active', 'completed', 'archived']).default('active'),
    validFrom: z.string().optional().nullable(),
    validUntil: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    exercises: z.array(routineExerciseItemSchema).min(1, 'Debe incluir al menos 1 ejercicio en la rutina')
  })
});

export const routineUpdateSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('ID de rutina requerido'),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    description: z.string().optional().nullable(),
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
    changeReason: z.string().optional().nullable(),
    validFrom: z.string().optional().nullable(),
    validUntil: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    exercises: z.array(routineExerciseItemSchema).min(1, 'Debe incluir al menos 1 ejercicio en la rutina')
  })
});

export const routineStatusUpdateSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('ID de rutina requerido'),
    status: z.enum(['draft', 'active', 'completed', 'archived'])
  })
});
