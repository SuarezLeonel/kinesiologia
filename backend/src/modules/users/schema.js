/**
 * @file schema.js
 * @module users
 * @description Esquemas Zod para actualización de roles y estado activo de usuarios.
 */
import { z } from 'zod';

export const userSearchSchema = z.object({
  body: z.object({
    roleId: z.coerce.number().int().optional(),
    role: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  }).default({})
});

export const userDetailSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive('ID de usuario requerido')
  })
});

export const userCreateSchema = z.object({
  body: z.object({
    roleId: z.coerce.number().int().positive().optional(),
    role: z.string().optional(),
    name: z.string().min(2).optional(),
    firstName: z.string().min(2).optional(),
    first_name: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    last_name: z.string().min(2).optional(),
    dni: z.string().min(6).max(20).optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    phone: z.string().optional(),
    licenseNumber: z.string().optional(),
    license_number: z.string().optional(),
    specialty: z.string().optional()
  }).transform((val) => {
    const roleMap = {
      admin: 1,
      kinesiologist: 2,
      kinesiologo: 2,
      receptionist: 3,
      recepcionista: 3,
      patient: 4,
      paciente: 4
    };
    const resolvedRoleId = val.roleId || (val.role ? roleMap[String(val.role).toLowerCase()] : undefined);
    return {
      roleId: resolvedRoleId,
      name: (val.name || val.firstName || val.first_name || '').trim(),
      lastName: (val.lastName || val.last_name || '').trim(),
      dni: val.dni ? val.dni.trim() : undefined,
      email: val.email.trim().toLowerCase(),
      password: val.password,
      phone: val.phone ? val.phone.trim() : undefined,
      licenseNumber: (val.licenseNumber || val.license_number || '').trim() || undefined,
      specialty: val.specialty ? val.specialty.trim() : undefined
    };
  }).refine((val) => Boolean(val.roleId) && Boolean(val.name) && Boolean(val.lastName), {
    message: 'Rol, nombre y apellido son obligatorios'
  })
});

export const userUpdateSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),
  body: z.object({
    roleId: z.coerce.number().int().positive().optional(),
    name: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    dni: z.string().optional(),
    phone: z.string().optional(),
    licenseNumber: z.string().optional(),
    specialty: z.string().optional(),
    isActive: z.boolean().optional()
  })
});
