import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './controller.js';
import { validate } from '../../middlewares/validate.js';
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
  oauthConfigSchema
} from './schema.js';

export const authRouter = Router();

const isTest = config.nodeEnv === 'test';

const createLimiter = (max, windowMinutes, message, useEmailKey = false) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: isTest ? 1000 : max,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    const cfIp = req.headers['cf-connecting-ip'];
    const xff = req.headers['x-forwarded-for'];
    const ip = cfIp ? String(cfIp).trim() : (xff ? String(xff).split(',')[0].trim() : (req.ip || '127.0.0.1'));
    if (useEmailKey && req.body?.email) {
      return `${ip}_${String(req.body.email).toLowerCase().trim()}`;
    }
    return ip;
  },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message
    }
  }
});

const forgotPasswordLimiter = createLimiter(20, 15, 'Demasiadas solicitudes de recuperación de contraseña. Reintente en 15 minutos.', true);
const resetPasswordLimiter = createLimiter(15, 15, 'Demasiados intentos de restablecimiento de contraseña. Reintente en 15 minutos.', true);

// Todos los endpoints usan POST según AGENTS.md y REQUISITOS.md
authRouter.post('/register', validate(registerSchema), asyncHandler((req, res, next) => authController.register(req, res, next)));
authRouter.post('/register-patient', validate(patientRegisterSchema), asyncHandler((req, res, next) => authController.registerPatient(req, res, next)));
authRouter.post('/login', validate(loginSchema), asyncHandler((req, res, next) => authController.login(req, res, next)));
authRouter.post('/google', validate(googleAuthSchema), asyncHandler((req, res, next) => authController.google(req, res, next)));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler((req, res, next) => authController.refresh(req, res, next)));
authRouter.post('/logout', validate(refreshSchema), asyncHandler((req, res, next) => authController.logout(req, res, next)));
authRouter.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), asyncHandler((req, res, next) => authController.forgotPassword(req, res, next)));
authRouter.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), asyncHandler((req, res, next) => authController.resetPassword(req, res, next)));
authRouter.post('/social', validate(socialLoginSchema), asyncHandler((req, res, next) => authController.social(req, res, next)));
authRouter.post('/oauth-config', validate(oauthConfigSchema), asyncHandler((req, res, next) => authController.oauthConfig(req, res, next)));
// Callback bridge OAuth para redirección universal de navegadores (Google, GitHub, Facebook) hacia Expo Go, Standalone APK y Web
authRouter.get('/oauth/callback', asyncHandler((req, res, next) => authController.oauthCallback(req, res, next)));

