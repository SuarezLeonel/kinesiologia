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
    provider: z.enum(['google', 'facebook', 'apple']),
    idToken: z.string().min(1, 'ID Token del proveedor es requerido')
  })
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
    role: z.string().optional() // Ignored on server, never grants admin
  })
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(10, 'Token de Google requerido')
  })
});

