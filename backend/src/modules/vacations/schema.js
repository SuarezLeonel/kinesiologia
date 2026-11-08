/**
 * @file schema.js
 * @module vacations
 * @description Esquemas de validación Zod para el módulo de vacaciones de kinesiólogos.
 */
import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const vacationSearchSchema = z.object({
  body: z.object({
    kinesiologistId: z.union([z.number().int().positive(), z.literal('all')]).optional(),
    kinesiologist_id: z.union([z.number().int().positive(), z.literal('all')]).optional(),
    startDate: z.string().regex(dateRegex, 'Formato AAAA-MM-DD').optional(),
    endDate: z.string().regex(dateRegex, 'Formato AAAA-MM-DD').optional(),
    status: z.enum(['scheduled', 'active', 'completed', 'cancelled', 'all']).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  }).transform((val) => ({
    ...val,
    kinesiologistId: val.kinesiologistId !== undefined ? val.kinesiologistId : val.kinesiologist_id
  }))
});

export const vacationPreviewSchema = z.object({
  body: z.object({
    kinesiologistId: z.number().int().positive().optional(),
    kinesiologist_id: z.number().int().positive().optional(),
    startDate: z.string().regex(dateRegex, 'Fecha de inicio requerida en formato AAAA-MM-DD'),
    endDate: z.string().regex(dateRegex, 'Fecha de finalización requerida en formato AAAA-MM-DD')
  }).transform((val) => ({
    ...val,
    kinesiologistId: val.kinesiologistId !== undefined ? val.kinesiologistId : val.kinesiologist_id
  })).refine((val) => val.endDate >= val.startDate, {
    message: 'La fecha de finalización debe ser igual o posterior a la fecha de inicio',
    path: ['endDate']
  })
});

export const vacationCreateSchema = z.object({
  body: z.object({
    kinesiologistId: z.number().int().positive().optional(),
    kinesiologist_id: z.number().int().positive().optional(),
    startDate: z.string().regex(dateRegex, 'Fecha de inicio requerida en formato AAAA-MM-DD'),
    endDate: z.string().regex(dateRegex, 'Fecha de finalización requerida en formato AAAA-MM-DD'),
    notes: z.string().max(255, 'Máximo 255 caracteres').optional()
  }).transform((val) => ({
    ...val,
    kinesiologistId: val.kinesiologistId !== undefined ? val.kinesiologistId : val.kinesiologist_id
  })).refine((val) => val.endDate >= val.startDate, {
    message: 'La fecha de finalización debe ser igual o posterior a la fecha de inicio',
    path: ['endDate']
  })
});

export const vacationCancelSchema = z.object({
  body: z.object({
    id: z.number().int().positive().optional(),
    vacationId: z.number().int().positive().optional(),
    reason: z.string().max(255).optional()
  }).transform((val) => ({
    ...val,
    id: val.id !== undefined ? val.id : val.vacationId
  })).refine((val) => val.id !== undefined, {
    message: 'ID de período de vacaciones requerido',
    path: ['id']
  })
});

export const vacationAffectedAppointmentsSchema = z.object({
  body: z.object({
    vacationId: z.number().int().positive().optional(),
    kinesiologistId: z.number().int().positive().optional(),
    startDate: z.string().regex(dateRegex).optional(),
    endDate: z.string().regex(dateRegex).optional()
  })
});

export const vacationReassignAppointmentSchema = z.object({
  body: z.object({
    appointmentId: z.number().int().positive('ID de turno requerido'),
    targetKinesiologistId: z.union([z.number().int().positive(), z.null()]).optional(),
    newKinesiologistId: z.union([z.number().int().positive(), z.null()]).optional(),
    kinesiologistId: z.union([z.number().int().positive(), z.null()]).optional(),
    newStartTime: z.string().optional(),
    notes: z.string().max(255).optional(),
    notifyPatient: z.boolean().optional().default(true)
  }).transform((val) => {
    let target = val.targetKinesiologistId;
    if (target === undefined && val.newKinesiologistId !== undefined) {
      target = val.newKinesiologistId;
    }
    if (target === undefined && val.kinesiologistId !== undefined) {
      target = val.kinesiologistId;
    }
    return {
      ...val,
      targetKinesiologistId: target
    };
  })
});
