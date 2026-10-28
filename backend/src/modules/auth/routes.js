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
  socialLoginSchema
} from './schema.js';

export const authRouter = Router();

const isTest = config.nodeEnv === 'test';

const createLimiter = (max, windowMinutes, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: isTest ? 1000 : max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message
    }
  }
});

const loginLimiter = createLimiter(5, 15, 'Demasiados intentos de inicio de sesión. Por favor reintente en 15 minutos.');
const forgotPasswordLimiter = createLimiter(3, 15, 'Demasiadas solicitudes de recuperación de contraseña. Reintente en 15 minutos.');
const resetPasswordLimiter = createLimiter(5, 15, 'Demasiados intentos de restablecimiento de contraseña. Reintente en 15 minutos.');

// Todos los endpoints usan POST según AGENTS.md y REQUISITOS.md
authRouter.post('/register', validate(registerSchema), asyncHandler((req, res, next) => authController.register(req, res, next)));
authRouter.post('/login', loginLimiter, validate(loginSchema), asyncHandler((req, res, next) => authController.login(req, res, next)));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler((req, res, next) => authController.refresh(req, res, next)));
authRouter.post('/logout', validate(refreshSchema), asyncHandler((req, res, next) => authController.logout(req, res, next)));
authRouter.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), asyncHandler((req, res, next) => authController.forgotPassword(req, res, next)));
authRouter.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), asyncHandler((req, res, next) => authController.resetPassword(req, res, next)));
authRouter.post('/social', validate(socialLoginSchema), asyncHandler((req, res, next) => authController.social(req, res, next)));
