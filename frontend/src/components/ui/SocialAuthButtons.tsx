import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth, SocialProvider, OAuthConfig } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography } from '../../theme/tokens';
import { ModalWrapper } from './ModalWrapper';
import { Input } from './Input';
import { Button } from './Button';

// Inicializar el manejador de retorno para WebBrowser en plataformas que lo requieran
WebBrowser.maybeCompleteAuthSession();

interface SocialAuthButtonsProps {
  mode?: 'login' | 'register';
  onError?: (message: string | null) => void;
}

interface ProviderMeta {
  id: SocialProvider;
  name: string;
  brandColor: string;
  envVar: string;
  docUrl: string;
}

const PROVIDERS_META: Record<SocialProvider, ProviderMeta> = {
  google: {
    id: 'google',
    name: 'Google',
    brandColor: '#4285F4',
    envVar: 'GOOGLE_CLIENT_ID',
    docUrl: 'docs/OAUTH_SETUP.md'
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    brandColor: '#0078D4',
    envVar: 'MICROSOFT_CLIENT_ID',
    docUrl: 'docs/OAUTH_SETUP.md'
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    brandColor: '#1877F2',
    envVar: 'FACEBOOK_APP_ID',
    docUrl: 'docs/OAUTH_SETUP.md'
  }
};

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  mode = 'login',
  onError
}) => {
  const { socialLogin, getOAuthConfig } = useAuth();
  const { theme } = useAppTheme();

  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null);

  // Modal para configuración faltante
  const [unconfiguredProvider, setUnconfiguredProvider] = useState<SocialProvider | null>(null);

  // Modal para vinculación explícita de cuenta (seguridad contra account takeover)
  const [linkingState, setLinkingState] = useState<{
    visible: boolean;
    provider: SocialProvider;
    email: string;
    tokens: { idToken?: string; accessToken?: string; code?: string };
    password: string;
    error: string | null;
  } | null>(null);

  // Modal para proveedor sin correo (ej. Facebook sin permiso de email)
  const [missingEmailState, setMissingEmailState] = useState<{
    visible: boolean;
    provider: SocialProvider;
    tokens: { idToken?: string; accessToken?: string; code?: string };
    email: string;
    error: string | null;
  } | null>(null);

  // Obtener redirectUri oficial de expo-auth-session
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'kinesiologia'
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cfg = await getOAuthConfig();
        if (isMounted && cfg) {
          setOAuthConfig(cfg);
        }
      } catch {
        // En caso de error de red, se mantiene el fallback local
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const actionPrefix = mode === 'register' ? 'Registrarse con' : 'Ingresar con';

  /**
   * Inicia el flujo real OAuth 2.0 / OpenID Connect con el proveedor seleccionado.
   */
  const handlePressProvider = async (provider: SocialProvider) => {
    onError?.(null);
    const meta = PROVIDERS_META[provider];

    // Verificar si el proveedor tiene credenciales configuradas
    const isConfigured = Boolean(
      (provider === 'google' && (oauthConfig?.google?.configured || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID)) ||
      (provider === 'microsoft' && (oauthConfig?.microsoft?.configured || process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID)) ||
      (provider === 'facebook' && (oauthConfig?.facebook?.configured || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID))
    );

    if (!isConfigured) {
      setUnconfiguredProvider(provider);
      return;
    }

    setLoadingProvider(provider);

    try {
      if (provider === 'google') {
        const clientId = oauthConfig?.google?.clientId || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
        const discovery = {
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token'
        };

        const randomNonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const authRequest = new AuthSession.AuthRequest({
          clientId,
          redirectUri,
          scopes: ['openid', 'profile', 'email'],
          responseType: AuthSession.ResponseType.IdToken,
          usePKCE: false,
          extraParams: {
            nonce: randomNonce
          }
        });

        const result = await authRequest.promptAsync(discovery);

        if (result.type === 'cancel' || result.type === 'dismiss') {
          onError?.('Inicio de sesión con Google cancelado.');
          return;
        }

        if (result.type === 'error') {
          onError?.(result.error?.message || 'Error en la autorización con Google.');
          return;
        }

        if (result.type === 'success' && result.params) {
          const idToken = result.params.id_token;
          const accessToken = result.params.access_token;
          await processSocialAuthResponse(provider, { idToken, accessToken });
        }
      } else if (provider === 'microsoft') {
        const clientId = oauthConfig?.microsoft?.clientId || process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '';
        const tenant = oauthConfig?.microsoft?.tenantId || 'common';
        const discovery = {
          authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
          tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
        };

        const authRequest = new AuthSession.AuthRequest({
          clientId,
          redirectUri,
          scopes: ['openid', 'profile', 'email', 'User.Read'],
          responseType: AuthSession.ResponseType.Token
        });

        const result = await authRequest.promptAsync(discovery);

        if (result.type === 'cancel' || result.type === 'dismiss') {
          onError?.('Inicio de sesión con Microsoft cancelado.');
          return;
        }

        if (result.type === 'error') {
          onError?.(result.error?.message || 'Error en la autorización con Microsoft.');
          return;
        }

        if (result.type === 'success' && result.params) {
          const accessToken = result.params.access_token;
          const idToken = result.params.id_token;
          await processSocialAuthResponse(provider, { accessToken, idToken });
        }
      } else if (provider === 'facebook') {
        const appId = oauthConfig?.facebook?.appId || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
        const discovery = {
          authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
          tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token'
        };

        const authRequest = new AuthSession.AuthRequest({
          clientId: appId,
          redirectUri,
          scopes: ['public_profile', 'email'],
          responseType: AuthSession.ResponseType.Token
        });

        const result = await authRequest.promptAsync(discovery);

        if (result.type === 'cancel' || result.type === 'dismiss') {
          onError?.('Inicio de sesión con Facebook cancelado.');
          return;
        }

        if (result.type === 'error') {
          onError?.(result.error?.message || 'Error en la autorización con Facebook.');
          return;
        }

        if (result.type === 'success' && result.params) {
          const accessToken = result.params.access_token;
          await processSocialAuthResponse(provider, { accessToken });
        }
      }
    } catch (err: any) {
      onError?.(err?.message || `Error al autenticar con ${meta.name}`);
    } finally {
      setLoadingProvider(null);
    }
  };

  /**
   * Procesa la respuesta del backend para el token obtenido del proveedor.
   */
  const processSocialAuthResponse = async (
    provider: SocialProvider,
    tokens: { idToken?: string; accessToken?: string; code?: string },
    options: { existingPassword?: string; confirmedEmail?: string } = {}
  ) => {
    const res = await socialLogin({
      provider,
      ...tokens,
      existingPassword: options.existingPassword,
      confirmedEmail: options.confirmedEmail
    });

    if (res.requiresLinkingConfirmation && res.email) {
      setLinkingState({
        visible: true,
        provider,
        email: res.email,
        tokens,
        password: '',
        error: null
      });
      return;
    }

    if (res.requiresEmail) {
      setMissingEmailState({
        visible: true,
        provider,
        tokens,
        email: '',
        error: null
      });
      return;
    }

    if (!res.success) {
      onError?.(res.error || `No se pudo completar el inicio de sesión con ${PROVIDERS_META[provider].name}`);
    }
  };

  /**
   * Confirma la vinculación de cuenta existente mediante contraseña.
   */
  const handleConfirmLink = async () => {
    if (!linkingState) return;
    if (!linkingState.password) {
      setLinkingState({ ...linkingState, error: 'Ingrese su contraseña actual para confirmar la vinculación' });
      return;
    }

    setLoadingProvider(linkingState.provider);
    try {
      const res = await socialLogin({
        provider: linkingState.provider,
        ...linkingState.tokens,
        existingPassword: linkingState.password
      });

      if (res.success) {
        setLinkingState(null);
      } else {
        setLinkingState({ ...linkingState, error: res.error || 'Contraseña incorrecta' });
      }
    } catch {
      setLinkingState({ ...linkingState, error: 'Error al verificar la vinculación' });
    } finally {
      setLoadingProvider(null);
    }
  };

  /**
   * Completa el correo en caso de que Facebook no lo haya entregado.
   */
  const handleConfirmMissingEmail = async () => {
    if (!missingEmailState) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(missingEmailState.email.trim())) {
      setMissingEmailState({ ...missingEmailState, error: 'Ingrese un correo electrónico válido' });
      return;
    }

    setLoadingProvider(missingEmailState.provider);
    try {
      const res = await socialLogin({
        provider: missingEmailState.provider,
        ...missingEmailState.tokens,
        confirmedEmail: missingEmailState.email.trim()
      });

      if (res.success) {
        setMissingEmailState(null);
      } else if (res.requiresLinkingConfirmation && res.email) {
        setMissingEmailState(null);
        setLinkingState({
          visible: true,
          provider: missingEmailState.provider,
          email: res.email,
          tokens: missingEmailState.tokens,
          password: '',
          error: null
        });
      } else {
        setMissingEmailState({ ...missingEmailState, error: res.error || 'Error al validar correo' });
      }
    } catch {
      setMissingEmailState({ ...missingEmailState, error: 'Error al procesar el correo' });
    } finally {
      setLoadingProvider(null);
    }
  };

  const renderProviderIcon = (provider: SocialProvider) => {
    if (provider === 'google') {
      return (
        <View style={[styles.logoBadge, { backgroundColor: '#FFFFFF', borderColor: '#DADCE0', borderWidth: 1 }]}>
          <Text style={styles.googleIconText}>G</Text>
        </View>
      );
    }
    if (provider === 'microsoft') {
      return (
        <View style={[styles.logoBadge, { backgroundColor: '#FFFFFF', borderColor: '#DADCE0', borderWidth: 1 }]}>
          <View style={styles.msGrid}>
            <View style={[styles.msTile, { backgroundColor: '#F25022' }]} />
            <View style={[styles.msTile, { backgroundColor: '#7FBA00' }]} />
            <View style={[styles.msTile, { backgroundColor: '#00A4EF' }]} />
            <View style={[styles.msTile, { backgroundColor: '#FFB900' }]} />
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.logoBadge, { backgroundColor: '#1877F2' }]}>
        <Text style={styles.facebookIconText}>f</Text>
      </View>
    );
  };

  const unconfiguredMeta = unconfiguredProvider ? PROVIDERS_META[unconfiguredProvider] : null;

  return (
    <View style={styles.container}>
      {(['google', 'microsoft', 'facebook'] as SocialProvider[]).map((prov) => {
        const meta = PROVIDERS_META[prov];
        const isBusy = loadingProvider === prov;

        return (
          <TouchableOpacity
            key={prov}
            activeOpacity={0.8}
            disabled={Boolean(loadingProvider)}
            onPress={() => handlePressProvider(prov)}
            accessibilityRole="button"
            accessibilityLabel={`${actionPrefix} ${meta.name}`}
            style={[
              styles.socialButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border
              }
            ]}
          >
            {renderProviderIcon(prov)}
            <Text style={[styles.socialButtonText, { color: theme.text }]}>
              {actionPrefix} {meta.name}
            </Text>
            {isBusy ? (
              <ActivityIndicator size="small" color={meta.brandColor} />
            ) : (
              <MaterialIcons name="arrow-forward" size={16} color={theme.textMuted} />
            )}
          </TouchableOpacity>
        );
      })}

      {/* MODAL 1: INFORMACIÓN DE CONFIGURACIÓN PENDIENTE (SIN SIMULACIONES FALSAS) */}
      <ModalWrapper
        visible={Boolean(unconfiguredProvider)}
        onClose={() => setUnconfiguredProvider(null)}
        title={unconfiguredMeta ? `Configuración de ${unconfiguredMeta.name}` : 'Configuración de proveedor'}
        subtitle="Integración OAuth 2.0 / OpenID Connect real"
      >
        {unconfiguredMeta && (
          <View>
            <View style={[styles.noticeBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <MaterialIcons name="lock-outline" size={24} color={unconfiguredMeta.brandColor} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  Credenciales de {unconfiguredMeta.name} pendientes
                </Text>
                <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>
                  Para iniciar sesión de forma real con {unconfiguredMeta.name}, debes registrar la aplicación en la consola oficial del proveedor y configurar las variables de entorno en el servidor.
                </Text>
              </View>
            </View>

            <View style={[styles.configCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.configCardHeading, { color: theme.text }]}>
                Pasos para activar {unconfiguredMeta.name}:
              </Text>

              <Text style={[styles.configStep, { color: theme.textSecondary }]}>
                1. Registra tu aplicación en la consola oficial de {unconfiguredMeta.name}.
              </Text>

              <Text style={[styles.configStep, { color: theme.textSecondary }]}>
                2. Configura el siguiente URI de redirección autorizado:
              </Text>
              <View style={[styles.codeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Text style={[styles.codeText, { color: theme.primary }]}>{redirectUri}</Text>
              </View>

              <Text style={[styles.configStep, { color: theme.textSecondary }]}>
                3. Agrega la variable en tu archivo <Text style={{ fontWeight: 'bold' }}>backend/.env</Text>:
              </Text>
              <View style={[styles.codeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Text style={[styles.codeText, { color: theme.primary }]}>
                  {unconfiguredMeta.envVar}=tu_client_id_aqui
                </Text>
              </View>

              <Text style={[styles.guideNote, { color: theme.textMuted }]}>
                Consulta la guía completa paso a paso en el archivo <Text style={{ fontWeight: 'bold' }}>docs/OAUTH_SETUP.md</Text>.
              </Text>
            </View>

            <Button
              title="Entendido"
              variant="primary"
              onPress={() => setUnconfiguredProvider(null)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </ModalWrapper>

      {/* MODAL 2: VINCULACIÓN SEGURA DE CUENTA EXISTENTE (PROTECCIÓN CONTRA ACCOUNT TAKEOVER) */}
      <ModalWrapper
        visible={Boolean(linkingState?.visible)}
        onClose={() => setLinkingState(null)}
        title="Confirmar vinculación de cuenta"
        subtitle="Verificación de identidad obligatoria"
      >
        {linkingState && (
          <View>
            <View style={[styles.noticeBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <MaterialIcons name="verified-user" size={24} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  Cuenta existente detectada
                </Text>
                <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>
                  Ya existe una cuenta con el correo <Text style={{ fontWeight: 'bold' }}>{linkingState.email}</Text>. Para vincular tu acceso de {PROVIDERS_META[linkingState.provider].name} de forma segura, ingresa tu contraseña actual.
                </Text>
              </View>
            </View>

            {linkingState.error && (
              <View style={[styles.errorBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{linkingState.error}</Text>
              </View>
            )}

            <Input
              label="Contraseña actual de tu cuenta"
              placeholder="••••••••"
              value={linkingState.password}
              onChangeText={(txt) => setLinkingState({ ...linkingState, password: txt, error: null })}
              isPassword
              required
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setLinkingState(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirmar y vincular"
                onPress={handleConfirmLink}
                loading={Boolean(loadingProvider)}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        )}
      </ModalWrapper>

      {/* MODAL 3: INGRESO DE CORREO CUANDO EL PROVEEDOR NO LO ENTREGA (EJ. FACEBOOK) */}
      <ModalWrapper
        visible={Boolean(missingEmailState?.visible)}
        onClose={() => setMissingEmailState(null)}
        title="Correo electrónico requerido"
        subtitle="Completar datos de acceso"
      >
        {missingEmailState && (
          <View>
            <View style={[styles.noticeBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <MaterialIcons name="mail-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  {PROVIDERS_META[missingEmailState.provider].name} no suministró correo
                </Text>
                <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>
                  Por favor ingresa tu correo electrónico para asociarlo a tu cuenta de paciente en KinesioGestión.
                </Text>
              </View>
            </View>

            {missingEmailState.error && (
              <View style={[styles.errorBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{missingEmailState.error}</Text>
              </View>
            )}

            <Input
              label="Correo electrónico"
              placeholder="tu.correo@ejemplo.com"
              value={missingEmailState.email}
              onChangeText={(txt) => setMissingEmailState({ ...missingEmailState, email: txt, error: null })}
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setMissingEmailState(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Continuar"
                onPress={handleConfirmMissingEmail}
                loading={Boolean(loadingProvider)}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        )}
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: '100%'
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  googleIconText: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: '#EA4335'
  },
  facebookIconText: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF'
  },
  msGrid: {
    width: 14,
    height: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2
  },
  msTile: {
    width: 6,
    height: 6
  },
  socialButtonText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  noticeTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  noticeBody: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  configCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  configCardHeading: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs
  },
  configStep: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: 16
  },
  codeBox: {
    padding: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginVertical: 4
  },
  codeText: {
    fontSize: typography.fontSize.tiny,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: typography.fontWeight.semibold
  },
  guideNote: {
    fontSize: typography.fontSize.tiny,
    marginTop: spacing.sm
  },
  errorBanner: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
