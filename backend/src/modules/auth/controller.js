import { authService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      return sendSuccess(res, result, 'Usuario registrado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Inicio de sesión exitoso');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.refresh({
        refreshToken: req.body.refreshToken,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Tokens renovados con éxito');
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout({ refreshToken: req.body.refreshToken });
      return sendSuccess(res, null, 'Sesión cerrada con éxito');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword({ email: req.body.email });
      return sendSuccess(res, result, 'Instrucciones enviadas si el correo existe');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword({
        token: req.body.token,
        newPassword: req.body.newPassword
      });
      return sendSuccess(res, result, 'Contraseña restablecida correctamente');
    } catch (error) {
      next(error);
    }
  }

  async social(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.socialAuth({
        ...req.body,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Autenticación social procesada');
    } catch (error) {
      next(error);
    }
  }

  async registerPatient(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.registerPatient(req.body, { ipAddress, userAgent });
      return sendSuccess(res, result, 'Cuenta de paciente registrada con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async google(req, res, next) {
    try {
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.googleLogin({
        idToken: req.body.idToken,
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Inicio de sesión con Google exitoso');
    } catch (error) {
      next(error);
    }
  }

  async oauthConfig(req, res, next) {
    try {
      const result = authService.getOAuthConfig();
      return sendSuccess(res, result, 'Configuración de proveedores OAuth');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
