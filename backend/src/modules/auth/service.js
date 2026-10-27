import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { authRepository } from './repository.js';
import { AppError, UnauthorizedError, ConflictError } from '../../utils/errors.js';

export class AuthService {
  async register({ name, lastName, email, password, phone }) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictError('El correo electrónico ya se encuentra registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Los registros por API estándar se crean como kinesiólogo o paciente según política; rol 2 = kinesiólogo
    const userId = await authRepository.createUser({
      name,
      lastName,
      email,
      passwordHash,
      phone,
      roleId: 2
    });

    const user = await authRepository.findUserById(userId);
    const tokens = await this._generateTokens(user);
    return { user, ...tokens };
  }

  async login({ email, password, ipAddress, userAgent }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Credenciales incorrectas');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Cuenta de usuario inactiva');
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
    } catch (err) {
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
    // Generar token seguro firmado temporal (15m)
    const resetToken = jwt.sign({ userId: user.id, purpose: 'reset-password' }, config.jwt.accessSecret, { expiresIn: '15m' });
    // En producción se enviaría email; aquí se retorna token para validación en pruebas
    return { sent: true, resetToken: config.nodeEnv === 'development' ? resetToken : undefined };
  }

  async resetPassword({ token, newPassword }) {
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
      if (payload.purpose !== 'reset-password') {
        throw new Error();
      }
    } catch (err) {
      throw new UnauthorizedError('Token de restablecimiento inválido o expirado');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña y revocar sesiones previas
    const { query } = await import('../../config/database.js');
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, payload.userId]);
    await authRepository.revokeAllUserRefreshTokens(payload.userId);
    return { success: true };
  }

  async socialAuth({ provider, idToken }) {
    // Si no hay credenciales de proveedores configuradas, no simular la integración
    throw new AppError(`El proveedor OAuth ${provider} requiere credenciales activas del cliente en backend/.env`, 501, 'NOT_IMPLEMENTED');
  }

  async _generateTokens(user, ipAddress = null, userAgent = null) {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role_name || user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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
