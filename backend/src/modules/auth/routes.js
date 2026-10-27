import { Router } from 'express';
import { authController } from './controller.js';
import { validate } from '../../middlewares/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  socialLoginSchema
} from './schema.js';

export const authRouter = Router();

// Todos los endpoints usan POST según AGENTS.md y REQUISITOS.md
authRouter.post('/register', validate(registerSchema), (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', validate(loginSchema), (req, res, next) => authController.login(req, res, next));
authRouter.post('/refresh', validate(refreshSchema), (req, res, next) => authController.refresh(req, res, next));
authRouter.post('/logout', validate(refreshSchema), (req, res, next) => authController.logout(req, res, next));
authRouter.post('/forgot-password', validate(forgotPasswordSchema), (req, res, next) => authController.forgotPassword(req, res, next));
authRouter.post('/reset-password', validate(resetPasswordSchema), (req, res, next) => authController.resetPassword(req, res, next));
authRouter.post('/social', validate(socialLoginSchema), (req, res, next) => authController.social(req, res, next));
