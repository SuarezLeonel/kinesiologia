import crypto from 'crypto';
import { config } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors.js';

export class OAuthProviderService {
  /**
   * Verifica la identidad del usuario contra Google OAuth 2.0 / OpenID Connect.
   * @param {{ idToken?: string, accessToken?: string }} params
   * @returns {Promise<{ provider: 'google', providerUserId: string, email: string, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyGoogle({ idToken, accessToken }) {
    if (!idToken && !accessToken) {
      throw new UnauthorizedError('Token de autenticación de Google requerido');
    }

    // 1. Verificación primaria mediante tokeninfo de OpenID Connect
    if (idToken) {
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sub && data.email) {
            const isVerified = data.email_verified === 'true' || data.email_verified === true;
            if (!isVerified) {
              throw new UnauthorizedError('El correo electrónico de Google no está verificado por el proveedor');
            }

            // Validar audiencia si el Client ID está configurado en el servidor
            if (config.oauth?.google?.clientId && data.aud && data.aud !== config.oauth.google.clientId) {
              throw new UnauthorizedError('El token de Google no corresponde al cliente configurado en esta aplicación');
            }

            return {
              provider: 'google',
              providerUserId: String(data.sub),
              email: String(data.email).toLowerCase().trim(),
              emailVerified: true,
              firstName: data.given_name || data.name || 'Paciente',
              lastName: data.family_name || 'Google',
              avatarUrl: data.picture || null
            };
          }
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
      }
    }

    // 2. Verificación secundaria mediante UserInfo con Bearer token
    if (accessToken) {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.sub && data.email) {
            const isVerified = data.email_verified === true || data.email_verified === 'true';
            if (!isVerified) {
              throw new UnauthorizedError('El correo electrónico de Google no está verificado por el proveedor');
            }

            return {
              provider: 'google',
              providerUserId: String(data.sub),
              email: String(data.email).toLowerCase().trim(),
              emailVerified: true,
              firstName: data.given_name || data.name || 'Paciente',
              lastName: data.family_name || 'Google',
              avatarUrl: data.picture || null
            };
          }
        }
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
      }
    }

    throw new UnauthorizedError('Token de Google inválido, expirado o rechazado por el proveedor');
  }

  /**
   * Verifica la identidad del usuario contra Microsoft Identity Platform (OpenID Connect / Graph).
   * @param {{ accessToken?: string, idToken?: string }} params
   * @returns {Promise<{ provider: 'microsoft', providerUserId: string, email: string, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyMicrosoft({ accessToken, idToken }) {
    const bearer = accessToken || idToken;
    if (!bearer) {
      throw new UnauthorizedError('Token de autenticación de Microsoft requerido');
    }

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${bearer}` }
      });

      if (res.ok) {
        const data = await res.json();
        const rawEmail = data.mail || data.userPrincipalName;
        if (data.id && rawEmail) {
          // Normalizar correo electrónico
          const email = String(rawEmail).toLowerCase().trim();
          return {
            provider: 'microsoft',
            providerUserId: String(data.id),
            email,
            emailVerified: true,
            firstName: data.givenName || data.displayName || 'Paciente',
            lastName: data.surname || 'Microsoft',
            avatarUrl: null
          };
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
    }

    throw new UnauthorizedError('Token de Microsoft inválido, expirado o rechazado por el proveedor');
  }

  /**
   * Verifica la identidad del usuario contra Meta Graph API (Facebook Login).
   * @param {{ accessToken: string }} params
   * @returns {Promise<{ provider: 'facebook', providerUserId: string, email: string|null, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyFacebook({ accessToken }) {
    if (!accessToken) {
      throw new UnauthorizedError('Token de autenticación de Facebook requerido');
    }

    try {
      let url = `https://graph.facebook.com/v19.0/me?fields=id,first_name,last_name,name,email,picture.width(200).height(200)&access_token=${encodeURIComponent(accessToken)}`;

      // Si FACEBOOK_APP_SECRET está configurado, generar appsecret_proof para validación criptográfica contra Meta
      if (config.oauth?.facebook?.appSecret) {
        const appsecretProof = crypto
          .createHmac('sha256', config.oauth.facebook.appSecret)
          .update(accessToken)
          .digest('hex');
        url += `&appsecret_proof=${appsecretProof}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          const hasEmail = Boolean(data.email && typeof data.email === 'string');
          const email = hasEmail ? data.email.toLowerCase().trim() : null;

          return {
            provider: 'facebook',
            providerUserId: String(data.id),
            email,
            emailVerified: hasEmail,
            firstName: data.first_name || data.name || 'Paciente',
            lastName: data.last_name || 'Facebook',
            avatarUrl: data.picture?.data?.url || null
          };
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
    }

    throw new UnauthorizedError('Token de Facebook inválido, expirado o rechazado por el proveedor');
  }

  /**
   * Valida cualquier token según el proveedor especificado.
   * @param {{ provider: 'google'|'microsoft'|'facebook', idToken?: string, accessToken?: string }} params
   */
  async verifyProvider({ provider, idToken, accessToken }) {
    const normalized = String(provider || '').toLowerCase();
    switch (normalized) {
      case 'google':
        return await this.verifyGoogle({ idToken, accessToken });
      case 'microsoft':
        return await this.verifyMicrosoft({ accessToken, idToken });
      case 'facebook':
        return await this.verifyFacebook({ accessToken: accessToken || idToken });
      default:
        throw new UnauthorizedError(`Proveedor de autenticación no soportado: ${provider}`);
    }
  }

  /**
   * Devuelve la configuración pública de los proveedores configurados.
   * Nunca expone secrets ni credenciales privadas.
   */
  getPublicConfig() {
    return {
      google: {
        configured: Boolean(config.oauth?.google?.clientId),
        clientId: config.oauth?.google?.clientId || null
      },
      microsoft: {
        configured: Boolean(config.oauth?.microsoft?.clientId),
        clientId: config.oauth?.microsoft?.clientId || null,
        tenantId: config.oauth?.microsoft?.tenantId || 'common'
      },
      facebook: {
        configured: Boolean(config.oauth?.facebook?.appId),
        appId: config.oauth?.facebook?.appId || null
      }
    };
  }
}

export const oauthProviderService = new OAuthProviderService();

