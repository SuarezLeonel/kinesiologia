/**
 * @file routes.js
 * @module auth
 * @description Rutas de autenticación pública y privada (/api/v1/auth).
 * Configura rate limiters específicos por IP/Email y endpoints de OAuth y recuperación.
 */
import { Router } from 'express';
import { authController } from './controller.js';
import { validate } from '../../middlewares/validate.js';
import { createRateLimiter } from '../../middlewares/rateLimit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { config } from '../../config/env.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  socialLoginSchema,
  patientRegisterSchema,
  googleAuthSchema,
  oauthConfigSchema,
  verifyEmailSchema,
  resendVerificationSchema
} from './schema.js';

export const authRouter = Router();

const isTest = config.nodeEnv === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

const buildAuthKeyGenerator = (useEmailKey) => (req) => {
  const cfIp = req.headers['cf-connecting-ip'];
  const xff = req.headers['x-forwarded-for'];
  const ip = cfIp ? String(cfIp).trim() : (xff ? String(xff).split(',')[0].trim() : (req.ip || '127.0.0.1'));
  if (useEmailKey && req.body?.email) {
    return `${ip}_${String(req.body.email).toLowerCase().trim()}`;
  }
  return ip;
};

const createAuthLimiter = (
  max,
  windowMinutes,
  message,
  { useEmailKey = false, preserveInDevelopment = false } = {}
) =>
  createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: isTest ? 1000 : max,
    preserveInDevelopment,
    keyGenerator: buildAuthKeyGenerator(useEmailKey),
    message
  });

// Limitadores específicos para mitigación de ataques de fuerza bruta y credential stuffing (OWASP A07 / API4)
// Login y recuperación de contraseña mantienen su protección incluso cuando NODE_ENV=development.
const loginLimiter = createAuthLimiter(
  10,
  15,
  'Demasiados intentos de inicio de sesión. Por motivos de seguridad, reintente en 15 minutos.',
  { useEmailKey: true, preserveInDevelopment: true }
);
const registerLimiter = createAuthLimiter(
  20,
  60,
  'Demasiadas solicitudes de registro desde esta conexión. Reintente en una hora.',
  { preserveInDevelopment: false }
);
const forgotPasswordLimiter = createAuthLimiter(
  20,
  15,
  'Demasiadas solicitudes de recuperación de contraseña. Reintente en 15 minutos.',
  { useEmailKey: true, preserveInDevelopment: true }
);
const resetPasswordLimiter = createAuthLimiter(
  15,
  15,
  'Demasiados intentos de restablecimiento de contraseña. Reintente en 15 minutos.',
  { useEmailKey: true, preserveInDevelopment: true }
);
const resendVerificationLimiter = createAuthLimiter(
  5,
  15,
  'Demasiadas solicitudes de reenvío de correo de verificación. Por motivos de seguridad, reintente en 15 minutos.',
  { useEmailKey: true, preserveInDevelopment: false }
);

// Todos los endpoints usan POST según AGENTS.md y REQUISITOS.md
authRouter.post('/register', registerLimiter, validate(registerSchema), asyncHandler((req, res, next) => authController.register(req, res, next)));
authRouter.post('/register-patient', registerLimiter, validate(patientRegisterSchema), asyncHandler((req, res, next) => authController.registerPatient(req, res, next)));
authRouter.post('/login', loginLimiter, validate(loginSchema), asyncHandler((req, res, next) => authController.login(req, res, next)));
authRouter.post('/google', validate(googleAuthSchema), asyncHandler((req, res, next) => authController.google(req, res, next)));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler((req, res, next) => authController.refresh(req, res, next)));
authRouter.post('/logout', validate(refreshSchema), asyncHandler((req, res, next) => authController.logout(req, res, next)));
authRouter.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), asyncHandler((req, res, next) => authController.forgotPassword(req, res, next)));
authRouter.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), asyncHandler((req, res, next) => authController.resetPassword(req, res, next)));
authRouter.post('/verify-email', validate(verifyEmailSchema), asyncHandler((req, res, next) => authController.verifyEmail(req, res, next)));
authRouter.post('/resend-verification-email', resendVerificationLimiter, validate(resendVerificationSchema), asyncHandler((req, res, next) => authController.resendVerificationEmail(req, res, next)));
authRouter.post('/social', validate(socialLoginSchema), asyncHandler((req, res, next) => authController.social(req, res, next)));
authRouter.post('/oauth-config', validate(oauthConfigSchema), asyncHandler((req, res, next) => authController.oauthConfig(req, res, next)));
// Enlace web de verificación al hacer clic en el correo electrónico desde clientes de mail
authRouter.get('/verify-email', asyncHandler((req, res, next) => authController.verifyEmailWeb(req, res, next)));
// Callback bridge OAuth para redirección universal de navegadores (Google, GitHub, Facebook) hacia Expo Go, Standalone APK y Web
authRouter.get('/oauth/callback', asyncHandler((req, res, next) => authController.oauthCallback(req, res, next)));

