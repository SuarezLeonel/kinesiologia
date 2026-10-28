import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { authRepository } from './repository.js';
import { emailService } from '../../services/emailService.js';
import { AppError, UnauthorizedError, ConflictError } from '../../utils/errors.js';

export class AuthService {
  async register({ name, lastName, email, password, phone }) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictError('El correo electrónico ya se encuentra registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // El registro público nunca otorga privilegios clínicos: rol de menor privilegio
    // y cuenta inactiva hasta aprobación de un administrador. No se emiten tokens.
    const role = await authRepository.findRoleByName('receptionist');
    if (!role) {
      throw new AppError('Rol por defecto no configurado', 500, 'ROLE_NOT_CONFIGURED');
    }
    const userId = await authRepository.createUser({
      name,
      lastName,
      email,
      passwordHash,
      phone,
      roleId: role.id,
      isActive: false
    });

    const user = await authRepository.findUserById(userId);
    return {
      user,
      pendingApproval: true,
      message: 'Cuenta creada. Un administrador debe aprobarla antes de poder iniciar sesión.'
    };
  }

  async login({ email, password, ipAddress, userAgent }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Credenciales incorrectas');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Cuenta inactiva o pendiente de aprobación');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Credenciales incorrectas');
    }

    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    const { password_hash, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async refresh({ refreshToken, ipAddress, userAgent }) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh' || !payload.userId) {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await authRepository.findRefreshToken(tokenHash);

    if (!storedToken || storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
      throw new UnauthorizedError('Refresh token revocado o expirado');
    }

    // Rotación: revocar el token anterior
    await authRepository.revokeRefreshToken(tokenHash);

    const user = await authRepository.findUserById(storedToken.user_id);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Usuario inactivo o no encontrado');
    }

    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    return tokens;
  }

  async logout({ refreshToken }) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await authRepository.revokeRefreshToken(tokenHash);
    }
    return true;
  }

  async forgotPassword({ email }) {
    const user = await authRepository.findUserByEmail(email);
    // Para mitigar user enumeration, siempre respondemos afirmativamente
    if (!user) {
      return { sent: true };
    }

    // 1. Generar código numérico de 6 dígitos para ingreso en la app
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(resetCode).digest('hex');

    // 2. Generar token criptográfico firmado con secreto dedicado para enlace
    const resetToken = jwt.sign(
      { type: 'password_reset', userId: user.id },
      config.jwt.resetSecret,
      { expiresIn: config.jwt.resetExpiresIn, jwtid: crypto.randomUUID() }
    );
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(jwt.decode(resetToken).exp * 1000);

    // Guardar ambos en la base de datos vinculados al usuario
    await authRepository.savePasswordResetToken({
      userId: user.id,
      tokenHash: codeHash,
      expiresAt
    });
    await authRepository.savePasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    // Enviar correo electrónico real (o vía Ethereal si no hay SMTP configurado)
    const emailResult = await emailService.sendPasswordResetEmail({
      to: user.email,
      name: `${user.name} ${user.last_name || ''}`.trim(),
      resetCode,
      resetToken
    });

    return {
      sent: true,
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl,
      // Para pruebas automatizadas de integración
      resetToken: config.nodeEnv !== 'production' ? resetToken : undefined
    };
  }

  async resetPassword({ token, newPassword, ipAddress = null }) {
    const cleanToken = String(token || '').trim();
    let userId = null;
    let tokenHashToInvalidate = null;

    // Caso A: Código de 6 dígitos numéricos
    if (/^\d{6}$/.test(cleanToken)) {
      const codeHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
      const stored = await authRepository.findPasswordResetToken(codeHash);
      if (!stored || stored.used_at || new Date(stored.expires_at) < new Date()) {
        throw new UnauthorizedError('El código de verificación es inválido, ya fue utilizado o ha expirado');
      }
      userId = stored.user_id;
      tokenHashToInvalidate = codeHash;
    } else {
      // Caso B: Token JWT firmado
      try {
        const payload = jwt.verify(cleanToken, config.jwt.resetSecret);
        if (payload.type !== 'password_reset' || !payload.userId) {
          throw new Error();
        }
        userId = payload.userId;
      } catch {
        throw new UnauthorizedError('Token de restablecimiento inválido o expirado');
      }

      const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
      const stored = await authRepository.findPasswordResetToken(tokenHash);

      if (!stored || stored.used_at || new Date(stored.expires_at) < new Date()) {
        throw new UnauthorizedError('El token de restablecimiento ya ha sido utilizado o ha expirado');
      }
      tokenHashToInvalidate = tokenHash;
    }

    // Invalidar token de un solo uso
    await authRepository.markPasswordResetTokenUsed(tokenHashToInvalidate);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y revocar sesiones previas
    const { query } = await import('../../config/database.js');
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await authRepository.revokeAllUserRefreshTokens(userId);

    // Registrar en auditoría
    const { logAudit } = await import('../../utils/auditLogger.js');
    await logAudit({
      userId,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: userId,
      ipAddress
    });

    return { success: true, message: 'Contraseña actualizada con éxito' };
  }

  async socialAuth({ provider, idToken: _idToken }) {
    // Si no hay credenciales de proveedores configuradas, no simular la integración
    throw new AppError(`El proveedor OAuth ${provider} requiere credenciales activas del cliente en backend/.env`, 501, 'NOT_IMPLEMENTED');
  }

  async _generateTokens(user, ipAddress = null, userAgent = null) {
    const accessToken = jwt.sign(
      { type: 'access', userId: user.id, email: user.email, role: user.role_name || user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshToken = jwt.sign(
      { type: 'refresh', userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn, jwtid: crypto.randomUUID() }
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(jwt.decode(refreshToken).exp * 1000);

    await authRepository.saveRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
