import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { executeTransaction } from '../../config/database.js';
import { authRepository } from './repository.js';
import { emailService } from '../../services/emailService.js';
import { AppError, UnauthorizedError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

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

  // ==========================================
  // Registro e Inicio de Sesión de Pacientes
  // ==========================================

  async registerPatient({ email, password, firstName, lastName, phone, dni, birthDate }, { ipAddress, userAgent } = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('Ya existe una cuenta de usuario con ese correo electrónico');
    }

    const patientRole = await authRepository.findRoleByName('patient');
    if (!patientRole) {
      throw new AppError('Rol de paciente no configurado', 500);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { userId, patientId, linkedToExistingPatient } = await executeTransaction(async (conn) => {
      // 1. Crear usuario estrictamente con rol patient y activo
      const [uRes] = await conn.execute(`
        INSERT INTO users (role_id, name, last_name, email, password_hash, phone, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [patientRole.id, firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, phone?.trim() || null]);

      const userId = uRes.insertId;

      // 2. Comprobación segura de ficha de paciente existente
      // Caso A: Existe una única ficha previa con este email no vinculada (user_id IS NULL)
      const [pByEmail] = await conn.execute(`
        SELECT id, user_id, dni FROM patients WHERE email = ? AND is_active = 1 FOR UPDATE
      `, [normalizedEmail]);

      let patientId = null;

      if (pByEmail.length === 1 && pByEmail[0].user_id === null) {
        patientId = pByEmail[0].id;
        await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [userId, patientId]);
      } else if (pByEmail.length === 0) {
        // Caso B: No existe por email. Si envió DNI, comprobar si ya existe ficha con ese DNI
        if (dni) {
          const [pByDni] = await conn.execute(`
            SELECT id, user_id FROM patients WHERE dni = ? AND is_active = 1 FOR UPDATE
          `, [dni.trim()]);
          if (pByDni.length > 0) {
            if (pByDni[0].user_id !== null) {
              throw new ConflictError('El documento de identidad ingresado ya se encuentra vinculado a otra cuenta');
            }
            patientId = pByDni[0].id;
            await conn.execute('UPDATE patients SET user_id = ?, email = COALESCE(email, ?) WHERE id = ?', [userId, normalizedEmail, patientId]);
          }
        }

        // Si aún no hay ficha, se crea la nueva ficha para el paciente
        if (!patientId) {
          const patientDni = dni?.trim() || `P-${Date.now().toString().slice(-8)}`;
          const patientBirth = birthDate || '2000-01-01';
          const [newP] = await conn.execute(`
            INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, user_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `, [firstName.trim(), lastName.trim(), patientDni, patientBirth, phone?.trim() || '', normalizedEmail, userId]);
          patientId = newP.insertId;
        }
      } else {
        // Caso C: Hay ambigüedad o la ficha ya pertenece a otra cuenta.
        // No se vincula automáticamente para proteger los datos de salud.
      }

      return { userId, patientId, linkedToExistingPatient: Boolean(patientId && pByEmail.length === 1) };
    });

    await logAudit({
      userId,
      action: 'PATIENT_ACCOUNT_REGISTERED',
      entityType: 'user',
      entityId: userId,
      ipAddress,
      details: { patientId, linked: Boolean(patientId) }
    });

    const user = await authRepository.findUserById(userId);
    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    const { password_hash, ...safeUser } = user;
    return { user: { ...safeUser, patientId }, tokens, linkedToExistingPatient, patientId };
  }

  async verifyGoogleToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedError('Token de Google inválido');
    }
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!res.ok) {
        throw new Error('Google tokeninfo invalid response');
      }
      const data = await res.json();
      if (!data.sub || !data.email) {
        throw new Error('Google token missing sub or email');
      }
      const isVerified = data.email_verified === 'true' || data.email_verified === true;
      if (!isVerified) {
        throw new UnauthorizedError('El correo electrónico de Google no está verificado');
      }
      return {
        sub: data.sub,
        email: data.email.toLowerCase().trim(),
        firstName: data.given_name || data.name || 'Paciente',
        lastName: data.family_name || 'Google'
      };
    } catch (err) {
      throw new UnauthorizedError('Token de autenticación de Google inválido o no verificado');
    }
  }

  async googleLogin({ idToken, ipAddress, userAgent }) {
    const googleUser = await this.verifyGoogleToken(idToken);
    const { sub, email, firstName, lastName } = googleUser;

    const patientRole = await authRepository.findRoleByName('patient');
    if (!patientRole) {
      throw new AppError('Rol de paciente no configurado', 500);
    }

    const { userId, patientId } = await executeTransaction(async (conn) => {
      // 1. Buscar vinculación social existente
      const [socialRows] = await conn.execute(`
        SELECT user_id FROM social_accounts WHERE provider = 'google' AND provider_user_id = ?
      `, [sub]);

      let userId;
      if (socialRows.length > 0) {
        userId = socialRows[0].user_id;
      } else {
        // 2. Buscar si ya existe usuario con este email
        const [userRows] = await conn.execute(`
          SELECT id, is_active FROM users WHERE email = ?
        `, [email]);

        if (userRows.length > 0) {
          userId = userRows[0].id;
          await conn.execute(`
            INSERT IGNORE INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, 'google', ?)
          `, [userId, sub]);
        } else {
          // 3. Crear nuevo usuario paciente con contraseña segura no adivinable
          const randomSecret = crypto.randomBytes(32).toString('hex');
          const passwordHash = await bcrypt.hash(randomSecret, 10);
          const [newUser] = await conn.execute(`
            INSERT INTO users (role_id, name, last_name, email, password_hash, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
          `, [patientRole.id, firstName, lastName, email, passwordHash]);
          userId = newUser.insertId;

          await conn.execute(`
            INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, 'google', ?)
          `, [userId, sub]);

          // Comprobar ficha de paciente existente por email seguro
          const [patientRows] = await conn.execute(`
            SELECT id, user_id FROM patients WHERE email = ? AND is_active = 1 FOR UPDATE
          `, [email]);

          if (patientRows.length === 1 && patientRows[0].user_id === null) {
            await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [userId, patientRows[0].id]);
          } else if (patientRows.length === 0) {
            const fallbackDni = `G-${Date.now().toString().slice(-8)}`;
            await conn.execute(`
              INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, user_id, is_active)
              VALUES (?, ?, ?, '2000-01-01', '', ?, ?, 1)
            `, [firstName, lastName, fallbackDni, email, userId]);
          }
        }
      }

      let patientId = null;
      const [pRows] = await conn.execute('SELECT id FROM patients WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId]);
      if (pRows.length > 0) {
        patientId = pRows[0].id;
      }

      return { userId, patientId };
    });

    const user = await authRepository.findUserById(userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('La cuenta se encuentra inactiva o suspendida');
    }

    await logAudit({
      userId,
      action: 'GOOGLE_LOGIN_SUCCESS',
      entityType: 'user',
      entityId: userId,
      ipAddress
    });

    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    const { password_hash, ...safeUser } = user;
    return { user: { ...safeUser, patientId }, tokens, patientId };
  }

  async socialAuth({ provider, idToken }) {
    if (provider === 'google') {
      return await this.googleLogin({ idToken });
    }
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
