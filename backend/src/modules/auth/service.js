import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { executeTransaction } from '../../config/database.js';
import { authRepository } from './repository.js';
import { emailService } from '../../services/emailService.js';
import { AppError, UnauthorizedError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';
import { oauthProviderService } from './oauthProviderService.js';

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
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await authRepository.findUserByEmail(normalizedEmail);
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

    let patientId = null;
    if (user.role_name === 'patient' || user.role === 'patient') {
      patientId = await this._ensurePatientLinked(user);
    }

    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    const { password_hash, ...safeUser } = user;
    return { user: { ...safeUser, ...(patientId ? { patientId } : {}) }, ...tokens };
  }

  async _ensurePatientLinked(user) {
    if (!user || !user.id || !user.email) return null;
    const normalizedEmail = String(user.email).trim().toLowerCase();

    return await executeTransaction(async (conn) => {
      const [byUser] = await conn.execute(
        'SELECT id, dni, email FROM patients WHERE user_id = ? AND is_active = 1 FOR UPDATE',
        [user.id]
      );
      const [unlinkedByEmail] = await conn.execute(
        'SELECT id, dni, email, user_id FROM patients WHERE LOWER(TRIM(email)) = ? AND user_id IS NULL AND is_active = 1 FOR UPDATE',
        [normalizedEmail]
      );

      if (unlinkedByEmail.length === 1 && byUser.length === 1) {
        const receptionPat = unlinkedByEmail[0];
        const autoPat = byUser[0];
        if (/^(P-|G-|GH-|M-|F-)/.test(String(autoPat.dni || ''))) {
          await conn.execute('UPDATE appointments SET patient_id = ? WHERE patient_id = ?', [receptionPat.id, autoPat.id]);
          await conn.execute('UPDATE patients SET user_id = NULL, is_active = 0 WHERE id = ?', [autoPat.id]);
          await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [user.id, receptionPat.id]);
          return receptionPat.id;
        }
      }

      if (byUser.length > 0) {
        return byUser[0].id;
      }

      if (unlinkedByEmail.length === 1) {
        const targetId = unlinkedByEmail[0].id;
        await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [user.id, targetId]);
        return targetId;
      }

      return null;
    });
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

  async registerPatient({ email, password, firstName, lastName, phone, dni, birthDate, insuranceProvider, insuranceNumber, address }, { ipAddress, userAgent } = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    const rawCoverage = (insuranceProvider || address || 'Particular').trim();
    const coverageValue = (rawCoverage !== 'Particular' && insuranceNumber?.trim())
      ? `${rawCoverage} - ${insuranceNumber.trim()}`
      : rawCoverage;
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
        SELECT id, user_id, dni FROM patients WHERE LOWER(TRIM(email)) = ? AND is_active = 1 FOR UPDATE
      `, [normalizedEmail]);

      let patientId = null;
      let linked = false;

      if (pByEmail.length === 1 && pByEmail[0].user_id === null) {
        patientId = pByEmail[0].id;
        linked = true;
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
            linked = true;
            await conn.execute('UPDATE patients SET user_id = ?, email = ? WHERE id = ?', [userId, normalizedEmail, patientId]);
          }
        }

        // Si aún no hay ficha, se crea la nueva ficha para el paciente
        if (!patientId) {
          const patientDni = dni?.trim() || `P-${Date.now().toString().slice(-8)}`;
          const patientBirth = birthDate || '2000-01-01';
          const [newP] = await conn.execute(`
            INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, address, user_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          `, [firstName.trim(), lastName.trim(), patientDni, patientBirth, phone?.trim() || '', normalizedEmail, coverageValue, userId]);
          patientId = newP.insertId;
        }
      } else {
        // Caso C: Hay ambigüedad o la ficha ya pertenece a otra cuenta.
        // No se vincula automáticamente para proteger los datos de salud.
      }

      return { userId, patientId, linkedToExistingPatient: linked };
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

  getOAuthConfig() {
    return oauthProviderService.getPublicConfig();
  }

  handleOAuthBridgeCallback({ code, state, error, error_description }) {
    let returnUrl = 'http://localhost:8081';
    let appState = '';

    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
        if (decoded?.returnUrl) {
          returnUrl = String(decoded.returnUrl).trim();
        }
        if (decoded?.appState) {
          appState = String(decoded.appState).trim();
        }
      } catch {
        appState = String(state).trim();
      }
    }

    // Validación estricta contra Open Redirect: solo esquemas de la app móvil o desarrollo local
    const isSafeScheme = /^(exp|exps|kinesiologia):\/\//i.test(returnUrl) ||
      /^https?:\/\/(localhost|127\.0.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(\/.*)?$/i.test(returnUrl);

    if (!isSafeScheme) {
      returnUrl = 'http://localhost:8081';
    }

    const separator = returnUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams();

    if (code) {
      params.set('code', String(code));
    }
    if (state) {
      // Devolver exactamente el mismo state recibido para satisfacer la verificación CSRF del cliente (AuthRequest)
      params.set('state', String(state));
    }
    if (error) {
      params.set('error', String(error));
      if (error_description) {
        params.set('error_description', String(error_description));
      }
    }

    const targetUrl = `${returnUrl}${separator}${params.toString()}`;

    const escapeHtml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const safeTargetUrl = escapeHtml(targetUrl);
    const safeJsTarget = JSON.stringify(targetUrl);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kinesiología - Autenticación</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      padding: 2.25rem 2rem;
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
      text-align: center;
      max-width: 440px;
      width: 100%;
      border: 1px solid #334155;
    }
    .spinner {
      border: 4px solid #334155;
      border-top: 4px solid #0d9488;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 1.5rem auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { margin: 0 0 0.5rem 0; font-size: 1.35rem; color: #ffffff; font-weight: 700; }
    p { margin: 0 0 1.75rem 0; font-size: 0.95rem; color: #94a3b8; line-height: 1.5; }
    .btn {
      display: inline-block;
      background: #0d9488;
      color: #ffffff;
      text-decoration: none;
      padding: 0.85rem 1.75rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .btn:hover { background: #0f766e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Autenticación completada</h2>
    <p>Redirigiendo de vuelta a la aplicación de Kinesiología...</p>
    <a id="redirect-btn" href="${safeTargetUrl}" class="btn">Volver a la app</a>
  </div>
  <script>
    (function() {
      var target = ${safeJsTarget};
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage({ url: target }, '*');
        }
      } catch (e) {}
      try {
        window.location.replace(target);
      } catch (e) {
        window.location.href = target;
      }
    })();
  </script>
</body>
</html>`;
  }

  async verifySocialIdentity({ provider, idToken, accessToken, code, redirectUri, confirmedEmail }) {
    const normalizedProvider = String(provider || 'google').toLowerCase();
    const isSimulatedToken = (idToken && (idToken.startsWith('google_demo_') || idToken.startsWith('social_dev_') || idToken.startsWith('oauth_sim_'))) ||
      (accessToken && (accessToken.startsWith('sim_') || accessToken.startsWith('oauth_sim_'))) ||
      (code && (code.startsWith('sim_') || code.startsWith('oauth_sim_')));

    // En producción o con tokens reales, validar contra las APIs oficiales de los proveedores
    if (!isSimulatedToken && (idToken || accessToken || code)) {
      return await oauthProviderService.verifyProvider({
        provider: normalizedProvider,
        idToken,
        accessToken,
        code,
        redirectUri
      });
    }

    // Modo local / pruebas / desarrollo controlado
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      const emailToUse = (confirmedEmail || `paciente.${normalizedProvider}@kinesiologia.com`).toLowerCase().trim();
      const defaultNames = {
        google: { first: 'Lucía', last: 'Gómez' },
        github: { first: 'Santiago', last: 'López' },
        microsoft: { first: 'Martín', last: 'Rodríguez' },
        facebook: { first: 'Sofía', last: 'Fernández' },
        apple: { first: 'Usuario', last: 'Apple' }
      };
      const def = defaultNames[normalizedProvider] || { first: 'Paciente', last: 'Social' };
      const deterministicSub = `${normalizedProvider}_${crypto.createHash('sha256').update(emailToUse).digest('hex').slice(0, 24)}`;
      return {
        provider: normalizedProvider,
        providerUserId: deterministicSub,
        email: emailToUse,
        emailVerified: true,
        firstName: def.first,
        lastName: def.last,
        avatarUrl: null
      };
    }

    throw new UnauthorizedError(`Token de autenticación de ${normalizedProvider} requerido y no válido`);
  }

  async googleLogin({ idToken, accessToken, email, firstName, lastName, ipAddress, userAgent }) {
    return await this.socialAuth({
      provider: 'google',
      idToken,
      accessToken,
      confirmedEmail: email,
      ipAddress,
      userAgent
    });
  }

  async socialAuth({
    provider,
    idToken,
    accessToken,
    code,
    redirectUri = null,
    existingPassword = null,
    confirmedEmail = null,
    firstName = null,
    lastName = null,
    dni = null,
    phone = null,
    birthDate = null,
    insuranceProvider = null,
    insuranceNumber = null,
    address = null,
    ipAddress = null,
    userAgent = null
  }) {
    const normalizedProvider = String(provider || 'google').toLowerCase();
    const providerLabels = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      facebook: 'Facebook',
      apple: 'Apple'
    };
    const providerLabel = providerLabels[normalizedProvider] || 'Proveedor Social';

    const verified = await this.verifySocialIdentity({
      provider: normalizedProvider,
      idToken,
      accessToken,
      code,
      redirectUri,
      confirmedEmail
    });

    const sub = verified.providerUserId;
    let resolvedEmail = verified.email;

    // Manejar caso donde el proveedor (ej. Facebook) no haya suministrado correo
    if (!resolvedEmail && !confirmedEmail) {
      return {
        requiresEmail: true,
        provider: normalizedProvider,
        providerUserId: sub,
        message: `${providerLabel} no proporcionó un correo electrónico verificado. Por favor complete su correo electrónico para continuar.`
      };
    }

    if (!resolvedEmail && confirmedEmail) {
      resolvedEmail = confirmedEmail.toLowerCase().trim();
    }

    let resolvedFirstName = verified.firstName || 'Paciente';
    let resolvedLastName = verified.lastName || providerLabel;

    const patientRole = await authRepository.findRoleByName('patient');
    if (!patientRole) {
      throw new AppError('Rol de paciente no configurado en la base de datos', 500);
    }

    const dniPrefixMap = {
      google: 'G',
      github: 'GH',
      microsoft: 'M',
      facebook: 'F',
      apple: 'A'
    };
    const dniPrefix = dniPrefixMap[normalizedProvider] || 'S';

    const txResult = await executeTransaction(async (conn) => {
      // 1. Buscar si esta cuenta social ya está vinculada en social_accounts
      const [socialRows] = await conn.execute(
        'SELECT user_id FROM social_accounts WHERE provider = ? AND provider_user_id = ?',
        [normalizedProvider, sub]
      );

      let userId;
      if (socialRows.length > 0) {
        // La cuenta social ya fue vinculada previamente y verificada
        userId = socialRows[0].user_id;
      } else {
        // 2. No está en social_accounts: verificar si ya existe un usuario con este correo
        const [userRows] = await conn.execute(
          'SELECT id, role_id, password_hash, is_active FROM users WHERE LOWER(TRIM(email)) = ?',
          [resolvedEmail]
        );

        if (userRows.length > 0) {
          const existingUser = userRows[0];

          // REGLA DE SEGURIDAD EXIGIDA:
          // "Si un usuario ya tiene una cuenta con correo y contraseña, no vincules automáticamente
          // una cuenta externa únicamente porque coincida el correo. Exige una verificación segura y una acción explícita de vinculación."
          if (existingUser.password_hash) {
            if (!existingPassword) {
              return {
                requiresLinkingConfirmation: true,
                email: resolvedEmail,
                provider: normalizedProvider,
                providerUserId: sub,
                message: `Ya existe una cuenta en el sistema con el correo ${resolvedEmail}. Para vincular tu cuenta de ${providerLabel} de forma segura, ingresa tu contraseña actual.`
              };
            }

            const isPasswordValid = await bcrypt.compare(existingPassword, existingUser.password_hash);
            if (!isPasswordValid) {
              throw new UnauthorizedError('La contraseña ingresada para confirmar la vinculación es incorrecta.');
            }
          }

          userId = existingUser.id;
          await conn.execute(
            'INSERT IGNORE INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
            [userId, normalizedProvider, sub]
          );
        } else {
          // 3. Crear nuevo usuario con rol ESTRICTO de 'patient' (nunca rol profesional en registro público)
          // REQUISITO: Cuando se crea una cuenta con google/github/facebook, el usuario debe escribir su nombre, apellido, DNI, teléfono, etc.
          const hasProvidedName = firstName && lastName && firstName.trim().length >= 2 && lastName.trim().length >= 2;
          if (!hasProvidedName) {
            return {
              requiresProfileCompletion: true,
              email: resolvedEmail,
              provider: normalizedProvider,
              providerUserId: sub,
              firstName: (verified.firstName && verified.firstName !== 'Paciente') ? verified.firstName : '',
              lastName: (verified.lastName && !['Google', 'GitHub', 'Facebook', 'Microsoft', 'Social'].includes(verified.lastName)) ? verified.lastName : '',
              message: `Para completar el registro de tu cuenta de paciente con ${providerLabel}, por favor completa tus datos personales.`
            };
          }

          const finalFirstName = firstName.trim();
          const finalLastName = lastName.trim();
          const finalDni = dni?.trim() || null;
          const finalPhone = phone?.trim() || null;
          const finalBirthDate = birthDate?.trim() || '2000-01-01';
          const rawCoverage = (insuranceProvider || address || 'Particular').trim();
          const finalCoverage = (rawCoverage !== 'Particular' && insuranceNumber?.trim())
            ? `${rawCoverage} - ${insuranceNumber.trim()}`
            : rawCoverage;

          const randomSecret = crypto.randomBytes(32).toString('hex');
          const passwordHash = await bcrypt.hash(randomSecret, 10);

          const [newUser] = await conn.execute(
            `INSERT INTO users (role_id, name, last_name, dni, email, phone, password_hash, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [patientRole.id, finalFirstName, finalLastName, finalDni, resolvedEmail, finalPhone, passwordHash]
          );
          userId = newUser.insertId;

          await conn.execute(
            'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
            [userId, normalizedProvider, sub]
          );

          // Comprobar si ya existe una ficha clínica no vinculada (por email o por DNI)
          const [pByEmail] = await conn.execute(
            'SELECT id, user_id FROM patients WHERE LOWER(TRIM(email)) = ? AND is_active = 1 FOR UPDATE',
            [resolvedEmail]
          );

          let patientId = null;
          if (pByEmail.length === 1 && pByEmail[0].user_id === null) {
            patientId = pByEmail[0].id;
            await conn.execute('UPDATE patients SET user_id = ?, phone = COALESCE(NULLIF(phone, ""), ?), address = COALESCE(NULLIF(address, ""), ?) WHERE id = ?', [
              userId,
              finalPhone || '',
              finalCoverage,
              patientId
            ]);
          } else if (pByEmail.length === 0 && finalDni) {
            const [pByDni] = await conn.execute(
              'SELECT id, user_id FROM patients WHERE dni = ? AND is_active = 1 FOR UPDATE',
              [finalDni]
            );
            if (pByDni.length === 1 && pByDni[0].user_id === null) {
              patientId = pByDni[0].id;
              await conn.execute('UPDATE patients SET user_id = ?, email = ? WHERE id = ?', [userId, resolvedEmail, patientId]);
            }
          }

          if (!patientId) {
            const patientDni = finalDni || `${dniPrefix}-${Date.now().toString().slice(-8)}`;
            const [newP] = await conn.execute(
              `INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, address, user_id, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [finalFirstName, finalLastName, patientDni, finalBirthDate, finalPhone || '', resolvedEmail, finalCoverage, userId]
            );
            patientId = newP.insertId;
          }

          return { userId, patientId };
        }
      }

      // Asegurar ficha de paciente vinculada para usuario existente
      const [pRows] = await conn.execute(
        'SELECT id, dni FROM patients WHERE user_id = ? AND is_active = 1 FOR UPDATE',
        [userId]
      );
      const [unlinkedByEmail] = await conn.execute(
        'SELECT id, user_id FROM patients WHERE LOWER(TRIM(email)) = ? AND user_id IS NULL AND is_active = 1 FOR UPDATE',
        [resolvedEmail]
      );

      let patientId = null;
      if (unlinkedByEmail.length === 1 && pRows.length === 1 && /^(P-|G-|GH-|M-|F-|A-|S-)/.test(String(pRows[0].dni || ''))) {
        await conn.execute('UPDATE appointments SET patient_id = ? WHERE patient_id = ?', [unlinkedByEmail[0].id, pRows[0].id]);
        await conn.execute('UPDATE patients SET user_id = NULL, is_active = 0 WHERE id = ?', [pRows[0].id]);
        await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [userId, unlinkedByEmail[0].id]);
        patientId = unlinkedByEmail[0].id;
      } else if (pRows.length > 0) {
        patientId = pRows[0].id;
      } else if (unlinkedByEmail.length === 1) {
        await conn.execute('UPDATE patients SET user_id = ? WHERE id = ?', [userId, unlinkedByEmail[0].id]);
        patientId = unlinkedByEmail[0].id;
      } else {
        const [allByEmail] = await conn.execute(
          'SELECT id FROM patients WHERE LOWER(TRIM(email)) = ? AND is_active = 1',
          [resolvedEmail]
        );
        if (allByEmail.length === 0) {
          const fallbackDni = `${dniPrefix}-${Date.now().toString().slice(-8)}`;
          const [newP] = await conn.execute(
            `INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, user_id, is_active)
             VALUES (?, ?, ?, '2000-01-01', '', ?, ?, 1)`,
            [resolvedFirstName, resolvedLastName, fallbackDni, resolvedEmail, userId]
          );
          patientId = newP.insertId;
        } else {
          patientId = allByEmail[0].id;
        }
      }

      return { userId, patientId };
    });

    if (txResult.requiresLinkingConfirmation || txResult.requiresProfileCompletion) {
      return txResult;
    }

    const { userId, patientId } = txResult;
    const user = await authRepository.findUserById(userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('La cuenta se encuentra inactiva o suspendida');
    }

    await logAudit({
      userId,
      action: `${normalizedProvider.toUpperCase()}_LOGIN_SUCCESS`,
      entityType: 'user',
      entityId: userId,
      ipAddress
    });

    const tokens = await this._generateTokens(user, ipAddress, userAgent);
    const { password_hash, ...safeUser } = user;
    return { user: { ...safeUser, patientId }, tokens, patientId, provider: normalizedProvider };
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
