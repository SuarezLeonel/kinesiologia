/**
 * @file schema.js
 * @module auth
 * @description Esquemas Zod para autenticación: login, registro, reseteo de contraseña y OAuth social.
 */
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    email: z.string().email('Email no válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    phone: z.string().optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email no válido'),
    password: z.string().min(1, 'La contraseña es requerida')
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token es requerido')
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Email no válido')
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token de recuperación requerido'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
  })
});

export const socialLoginSchema = z.object({
  body: z.object({
    provider: z.enum(['google', 'facebook', 'github', 'microsoft', 'apple']),
    idToken: z.string().min(1).optional(),
    accessToken: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    codeVerifier: z.string().optional(),
    registrationToken: z.string().min(1).optional(),
    redirectUri: z.string().optional(),
    existingPassword: z.string().min(1).optional(),
    confirmedEmail: z.string().email().optional(),
    // Datos de perfil para completar registro nuevo (todo excepto correo y contraseña)
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').optional(),
    dni: z.string().max(20).optional(),
    phone: z.string().optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)').optional(),
    insuranceProvider: z.string().optional(),
    insuranceNumber: z.string().optional(),
    address: z.string().optional()
  }).refine((data) => Boolean(data.idToken || data.accessToken || data.code || data.registrationToken), {
    message: 'Debe proporcionar un token de autenticación del proveedor (idToken, accessToken, code o registrationToken)'
  })
});

export const oauthConfigSchema = z.object({
  body: z.record(z.any()).optional()
});

export const patientRegisterSchema = z.object({
  body: z.object({
    email: z.string().email('Email no válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    phone: z.string().optional(),
    dni: z.string().max(20).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)').optional(),
    insuranceProvider: z.string().optional(),
    insuranceNumber: z.string().optional(),
    address: z.string().optional(),
    role: z.string().optional() // Ignored on server, never grants admin
  })
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Token de Google requerido').optional(),
    email: z.string().email('Email no válido').optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional()
  }).refine((data) => Boolean(data.idToken || data.email), {
    message: 'Token o correo electrónico de Google requerido'
  })
});

