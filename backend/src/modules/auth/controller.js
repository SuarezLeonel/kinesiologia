/**
 * @file controller.js
 * @module auth
 * @description Controlador HTTP para autenticación, registro, login social y recuperación de contraseña.
 * Procesa credenciales, entrega pares de tokens JWT y gestiona el flujo de recuperación.
 */
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

  async oauthCallback(req, res, next) {
    try {
      const { code, state, error, error_description } = req.query;
      const html = authService.handleOAuthBridgeCallback({ code, state, error, error_description });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailWeb(req, res) {
    const token = req.query.token;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (!token) {
      return res.status(400).send(renderVerificationWebPage({
        success: false,
        title: 'Enlace incompleto',
        message: 'No se suministró un token de verificación en el enlace.'
      }));
    }

    try {
      const result = await authService.verifyEmail(String(token));
      return res.status(200).send(renderVerificationWebPage({
        success: true,
        title: '¡Tu cuenta fue verificada!',
        message: result.message
      }));
    } catch (error) {
      return res.status(error.statusCode || 400).send(renderVerificationWebPage({
        success: false,
        title: 'No se pudo verificar la cuenta',
        message: error.message || 'El enlace de verificación es inválido o ha expirado.'
      }));
    }
  }

  async resendVerificationEmail(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.resendVerificationEmail(email);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

function renderVerificationWebPage({ success, title, message }) {
  const primaryColor = success ? '#0D9488' : '#D97706';
  const badgeBg = success ? '#E6FFFA' : '#FEF3C7';
  const badgeBorder = success ? '#99F6E4' : '#FDE68A';
  const badgeText = success ? '#0F766E' : '#B45309';
  const icon = success ? '✓' : '!';
  const actionHref = 'kinesiologia://login?verified=true';
  const fallbackHref = 'http://localhost:8081';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — KinesioGestión</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #1E293B;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #FFFFFF;
      max-width: 460px;
      width: 100%;
      border-radius: 16px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #E2E8F0;
    }
    .brand-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      border-radius: 12px;
      background-color: #E8F0EC;
      color: #537C68;
      font-weight: 800;
      font-size: 18px;
      margin-bottom: 12px;
      border: 1px solid #C4D9CD;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 24px;
    }
    .status-badge {
      width: 64px;
      height: 64px;
      line-height: 64px;
      border-radius: 50%;
      background-color: ${badgeBg};
      border: 2px solid ${badgeBorder};
      color: ${badgeText};
      font-size: 32px;
      font-weight: bold;
      margin: 0 auto 20px auto;
    }
    h2 {
      font-size: 22px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #64748B;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background-color: ${primaryColor};
      color: #FFFFFF;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .fallback-link {
      display: block;
      margin-top: 16px;
      font-size: 13px;
      color: #64748B;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-badge">KG</div>
    <div class="brand-title">KinesioGestión</div>
    <div class="status-badge">${icon}</div>
    <h2>${title}</h2>
    <p>${message}</p>
    <a href="${actionHref}" class="btn">Abrir KinesioGestión</a>
    <a href="${fallbackHref}" class="fallback-link">O ingresar desde la web</a>
  </div>
</body>
</html>`;
}

export const authController = new AuthController();
