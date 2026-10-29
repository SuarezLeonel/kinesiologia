import crypto from 'crypto';
import { config } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors.js';

// Cache de intercambio en memoria para deduplicar solicitudes concurrentes del mismo 'code' de un solo uso
const githubCodeExchangePromises = new Map();
const githubCodeExchangeResults = new Map();

export class OAuthProviderService {
  /**
   * Verifica la identidad del usuario contra Google OAuth 2.0 / OpenID Connect.
   * @param {{ idToken?: string, accessToken?: string, code?: string, redirectUri?: string }} params
   * @returns {Promise<{ provider: 'google', providerUserId: string, email: string, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyGoogle({ idToken, accessToken, code, redirectUri }) {
    if (!idToken && !accessToken && !code) {
      throw new UnauthorizedError('Token o código de autenticación de Google requerido');
    }

    // 0. Si se proporciona un código de autorización (Authorization Code Flow), canjearlo por tokens
    if (!idToken && !accessToken && code) {
      if (!config.oauth?.google?.clientId || !config.oauth?.google?.clientSecret) {
        throw new UnauthorizedError('Credenciales de Google no configuradas en el servidor');
      }

      const tokenParams = new URLSearchParams({
        client_id: config.oauth.google.clientId,
        client_secret: config.oauth.google.clientSecret,
        code: String(code).trim(),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri ? String(redirectUri).trim() : 'http://localhost:8081'
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('Google token exchange error:', errText);
        throw new UnauthorizedError('Error al canjear el código de autorización con Google');
      }

      const tokenData = await tokenRes.json();
      idToken = tokenData.id_token;
      accessToken = tokenData.access_token;
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
   * Verifica la identidad del usuario contra GitHub OAuth 2.0 / API.
   * Cuenta con deduplicación y cache para evitar fallos por doble intercambio del código único.
   * @param {{ code?: string, accessToken?: string, redirectUri?: string }} params
   * @returns {Promise<{ provider: 'github', providerUserId: string, email: string|null, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyGithub({ code, accessToken, redirectUri }) {
    let token = accessToken;
    const trimmedCode = code ? String(code).trim() : null;

    if (!token && trimmedCode) {
      // 1. Si ya se intercambió este código recientemente, devolver el resultado cacheado
      if (githubCodeExchangeResults.has(trimmedCode)) {
        return githubCodeExchangeResults.get(trimmedCode);
      }

      // 2. Si ya hay una solicitud en vuelo para este mismo código, esperar la misma promesa
      if (githubCodeExchangePromises.has(trimmedCode)) {
        return await githubCodeExchangePromises.get(trimmedCode);
      }

      const exchangePromise = (async () => {
        if (!config.oauth?.github?.clientId || !config.oauth?.github?.clientSecret) {
          throw new UnauthorizedError('Credenciales de GitHub no configuradas en el servidor');
        }

        const bodyPayload = {
          client_id: config.oauth.github.clientId,
          client_secret: config.oauth.github.clientSecret,
          code: trimmedCode
        };

        if (redirectUri) {
          bodyPayload.redirect_uri = String(redirectUri).trim().replace(/\/+$/, '');
        }

        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!tokenRes.ok) {
          throw new UnauthorizedError('Error al intercambiar el código de autorización con GitHub');
        }

        const tokenData = await tokenRes.json();
        if (tokenData.error || !tokenData.access_token) {
          console.error('GitHub OAuth token exchange failed:', {
            error: tokenData.error,
            description: tokenData.error_description
          });
          throw new UnauthorizedError(tokenData.error_description || 'Código de autorización de GitHub inválido o expirado');
        }

        return await this._fetchGithubUserProfile(tokenData.access_token);
      })();

      githubCodeExchangePromises.set(trimmedCode, exchangePromise);

      try {
        const result = await exchangePromise;
        githubCodeExchangeResults.set(trimmedCode, result);
        setTimeout(() => {
          githubCodeExchangeResults.delete(trimmedCode);
        }, 120000); // 2 minutos de TTL
        return result;
      } finally {
        githubCodeExchangePromises.delete(trimmedCode);
      }
    }

    if (!token) {
      throw new UnauthorizedError('Token o código de autorización de GitHub requerido');
    }

    return await this._fetchGithubUserProfile(token);
  }

  /**
   * Obtiene y normaliza los datos del perfil de usuario y sus correos verificados desde GitHub.
   * @param {string} token Access Token de GitHub
   */
  async _fetchGithubUserProfile(token) {
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'KinesioGestion-App'
        }
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.id) {
          let email = userData.email ? String(userData.email).toLowerCase().trim() : null;
          let emailVerified = Boolean(email);

          if (!email) {
            try {
              const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'KinesioGestion-App'
                }
              });
              if (emailsRes.ok) {
                const emails = await emailsRes.json();
                if (Array.isArray(emails) && emails.length > 0) {
                  const primaryVerified = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
                  if (primaryVerified?.email) {
                    email = String(primaryVerified.email).toLowerCase().trim();
                    emailVerified = Boolean(primaryVerified.verified);
                  }
                }
              }
            } catch {
              // Continúa con los datos disponibles si falla la lista de correos
            }
          }

          const rawName = userData.name || userData.login || 'Paciente';
          const nameParts = rawName.trim().split(/\s+/);
          const firstName = nameParts[0] || 'Paciente';
          const lastName = nameParts.slice(1).join(' ') || 'GitHub';

          return {
            provider: 'github',
            providerUserId: String(userData.id),
            email,
            emailVerified,
            firstName,
            lastName,
            avatarUrl: userData.avatar_url || null
          };
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
    }

    throw new UnauthorizedError('Token de GitHub inválido, expirado o rechazado por el proveedor');
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
   * @param {{ accessToken?: string, code?: string, redirectUri?: string }} params
   * @returns {Promise<{ provider: 'facebook', providerUserId: string, email: string|null, emailVerified: boolean, firstName: string, lastName: string, avatarUrl: string|null }>}
   */
  async verifyFacebook({ accessToken, code, redirectUri }) {
    let token = accessToken;

    if (!token && code) {
      if (!config.oauth?.facebook?.appId || !config.oauth?.facebook?.appSecret) {
        throw new UnauthorizedError('Credenciales de Facebook no configuradas en el servidor');
      }

      const fbTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${config.oauth.facebook.appId}&client_secret=${config.oauth.facebook.appSecret}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri || '')}`;
      const tokenRes = await fetch(fbTokenUrl);
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData.access_token;
      } else {
        const errText = await tokenRes.text();
        console.error('Facebook token exchange error:', errText);
        throw new UnauthorizedError('Error al canjear el código de autorización con Facebook');
      }
    }

    if (!token) {
      throw new UnauthorizedError('Token o código de autenticación de Facebook requerido');
    }

    try {
      let url = `https://graph.facebook.com/v19.0/me?fields=id,first_name,last_name,name,email,picture.width(200).height(200)&access_token=${encodeURIComponent(token)}`;

      // Si FACEBOOK_APP_SECRET está configurado, generar appsecret_proof para validación criptográfica contra Meta
      if (config.oauth?.facebook?.appSecret) {
        const appsecretProof = crypto
          .createHmac('sha256', config.oauth.facebook.appSecret)
          .update(token)
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
   * @param {{ provider: 'google'|'github'|'microsoft'|'facebook', idToken?: string, accessToken?: string, code?: string, redirectUri?: string }} params
   */
  async verifyProvider({ provider, idToken, accessToken, code, redirectUri }) {
    const normalized = String(provider || '').toLowerCase();
    switch (normalized) {
      case 'google':
        return await this.verifyGoogle({ idToken, accessToken, code, redirectUri });
      case 'github':
        return await this.verifyGithub({ code, accessToken, redirectUri });
      case 'microsoft':
        return await this.verifyMicrosoft({ accessToken, idToken });
      case 'facebook':
        return await this.verifyFacebook({ accessToken: accessToken || idToken, code, redirectUri });
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
      github: {
        configured: Boolean(config.oauth?.github?.clientId),
        clientId: config.oauth?.github?.clientId || null
      },
      facebook: {
        configured: Boolean(config.oauth?.facebook?.appId),
        appId: config.oauth?.facebook?.appId || null
      }
    };
  }
}

export const oauthProviderService = new OAuthProviderService();

