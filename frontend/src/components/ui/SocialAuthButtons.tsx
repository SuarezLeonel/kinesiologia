import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth, SocialProvider, OAuthConfig } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography } from '../../theme/tokens';
import { ModalWrapper } from './ModalWrapper';
import { Input } from './Input';
import { Button } from './Button';
import { DateInput } from './DateInput';
import { InsuranceSelector } from './InsuranceSelector';

// Inicializar el manejador de retorno para WebBrowser en popup sin interferir con la ventana principal
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  if (window.opener) {
    WebBrowser.maybeCompleteAuthSession();
  }
} else {
  WebBrowser.maybeCompleteAuthSession();
}

interface SocialAuthButtonsProps {
  mode?: 'login' | 'register';
  onError?: (message: string | null) => void;
  initialProfileData?: {
    firstName?: string;
    lastName?: string;
    dni?: string;
    phone?: string;
    birthDate?: string;
    insuranceProvider?: string;
    customInsuranceProvider?: string;
    insuranceNumber?: string;
  };
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
  github: {
    id: 'github',
    name: 'GitHub',
    brandColor: '#24292e',
    envVar: 'GITHUB_CLIENT_ID',
    docUrl: 'docs/OAUTH_SETUP.md'
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    brandColor: '#00A4EF',
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

// Registro global de códigos OAuth ya procesados para evitar reenvíos simultáneos en React StrictMode o entre ventanas
const processedAuthCodes = new Set<string>();

const isAuthCodeAlreadyProcessed = (code: string): boolean => {
  if (!code) return false;
  if (processedAuthCodes.has(code)) return true;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (window.sessionStorage.getItem(`oauth_processed_code_${code}`)) {
        return true;
      }
    } catch {}
  }
  return false;
};

const markAuthCodeAsProcessed = (code: string) => {
  if (!code) return;
  processedAuthCodes.add(code);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`oauth_processed_code_${code}`, '1');
    } catch {}
  }
};

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  mode = 'login',
  onError,
  initialProfileData
}) => {
  const { socialLogin, getOAuthConfig } = useAuth();
  const { theme } = useAppTheme();

  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Modal para configuración faltante
  const [unconfiguredProvider, setUnconfiguredProvider] = useState<SocialProvider | null>(null);

  // Modal para vinculación explícita de cuenta (seguridad contra account takeover)
  const [linkingState, setLinkingState] = useState<{
    visible: boolean;
    provider: SocialProvider;
    email: string;
    tokens: { idToken?: string; accessToken?: string; code?: string; redirectUri?: string };
    password: string;
    error: string | null;
  } | null>(null);

  // Modal para proveedor sin correo (ej. Facebook sin permiso de email)
  const [missingEmailState, setMissingEmailState] = useState<{
    visible: boolean;
    provider: SocialProvider;
    tokens: { idToken?: string; accessToken?: string; code?: string; redirectUri?: string };
    email: string;
    error: string | null;
  } | null>(null);

  // Modal para completar perfil obligatorio en cuenta nueva (nombre, apellido, DNI, teléfono, fecha nac, obra social)
  const [profileCompletionState, setProfileCompletionState] = useState<{
    visible: boolean;
    provider: SocialProvider;
    email: string;
    tokens: { idToken?: string; accessToken?: string; code?: string; redirectUri?: string };
    firstName: string;
    lastName: string;
    dni: string;
    phone: string;
    birthDate: string;
    insuranceProvider: string;
    customInsuranceProvider: string;
    insuranceNumber: string;
    error: string | null;
  } | null>(null);

  // Obtener redirectUri oficial (en web se usa el origen exacto; en móvil el esquema de deep linking)
  const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : AuthSession.makeRedirectUri({
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

    // Manejo de retorno por redirección completa en entorno web (cuando no es popup)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.opener) {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!isAuthCodeAlreadyProcessed(code) && !isSubmittingRef.current) {
          markAuthCodeAsProcessed(code);
          isSubmittingRef.current = true;
          setLoadingProvider('github');
          processSocialAuthResponse('github', {
            code,
            redirectUri: window.location.origin
          }).finally(() => {
            isSubmittingRef.current = false;
            setLoadingProvider(null);
          });
        }
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const actionPrefix = mode === 'register' ? 'Registrarse con' : 'Ingresar con';

  /**
   * Inicia el flujo real OAuth 2.0 / OpenID Connect con el proveedor seleccionado.
   */
  const handlePressProvider = async (provider: SocialProvider) => {
    if (isSubmittingRef.current || loadingProvider) {
      return;
    }

    onError?.(null);
    const meta = PROVIDERS_META[provider];

    // Verificar si el proveedor tiene credenciales configuradas
    const isConfigured = Boolean(
      (provider === 'google' && (oauthConfig?.google?.configured || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID)) ||
      (provider === 'github' && (oauthConfig?.github?.configured || process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID)) ||
      (provider === 'facebook' && (oauthConfig?.facebook?.configured || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID))
    );

    if (!isConfigured) {
      setUnconfiguredProvider(provider);
      return;
    }

    isSubmittingRef.current = true;
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
          await processSocialAuthResponse(provider, {
            idToken,
            accessToken,
            redirectUri: authRequest.redirectUri || redirectUri
          });
        }
      } else if (provider === 'github') {
        const clientId = oauthConfig?.github?.clientId || process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || '';
        const discovery = {
          authorizationEndpoint: 'https://github.com/login/oauth/authorize',
          tokenEndpoint: 'https://github.com/login/oauth/access_token'
        };

        const authRequest = new AuthSession.AuthRequest({
          clientId,
          redirectUri,
          scopes: ['read:user', 'user:email'],
          responseType: AuthSession.ResponseType.Code,
          usePKCE: false
        });

        const result = await authRequest.promptAsync(discovery);

        if (result.type === 'cancel' || result.type === 'dismiss') {
          onError?.('Inicio de sesión con GitHub cancelado.');
          return;
        }

        if (result.type === 'error') {
          onError?.(result.error?.message || 'Error en la autorización con GitHub.');
          return;
        }

        if (result.type === 'success' && result.params) {
          const code = result.params.code;
          if (code && !isAuthCodeAlreadyProcessed(code)) {
            markAuthCodeAsProcessed(code);
            await processSocialAuthResponse(provider, {
              code,
              redirectUri: authRequest.redirectUri || redirectUri
            });
          }
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
          await processSocialAuthResponse(provider, {
            accessToken,
            redirectUri: authRequest.redirectUri || redirectUri
          });
        }
      }
    } catch (err: any) {
      onError?.(err?.message || `Error al autenticar con ${meta.name}`);
    } finally {
      isSubmittingRef.current = false;
      setLoadingProvider(null);
    }
  };

  /**
   * Procesa la respuesta del backend para el token obtenido del proveedor.
   */
  const processSocialAuthResponse = async (
    provider: SocialProvider,
    tokens: { idToken?: string; accessToken?: string; code?: string; redirectUri?: string },
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

    if (res.requiresProfileCompletion && res.email) {
      setProfileCompletionState({
        visible: true,
        provider,
        email: res.email,
        tokens,
        firstName: initialProfileData?.firstName || res.firstName || '',
        lastName: initialProfileData?.lastName || res.lastName || '',
        dni: initialProfileData?.dni || '',
        phone: initialProfileData?.phone || '',
        birthDate: initialProfileData?.birthDate || '1995-01-01',
        insuranceProvider: initialProfileData?.insuranceProvider || 'Particular',
        customInsuranceProvider: initialProfileData?.customInsuranceProvider || '',
        insuranceNumber: initialProfileData?.insuranceNumber || '',
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
   * Confirma y guarda los datos de perfil para una cuenta nueva creada con Google/GitHub/Facebook.
   */
  const handleConfirmProfileCompletion = async () => {
    if (!profileCompletionState) return;

    const trimmedFirstName = profileCompletionState.firstName.trim();
    const trimmedLastName = profileCompletionState.lastName.trim();

    if (trimmedFirstName.length < 2) {
      setProfileCompletionState({
        ...profileCompletionState,
        error: 'El nombre debe tener al menos 2 caracteres'
      });
      return;
    }

    if (trimmedLastName.length < 2) {
      setProfileCompletionState({
        ...profileCompletionState,
        error: 'El apellido debe tener al menos 2 caracteres'
      });
      return;
    }

    const selectedIns = profileCompletionState.insuranceProvider || 'Particular';
    if (selectedIns === 'Otra' && (!profileCompletionState.customInsuranceProvider || !profileCompletionState.customInsuranceProvider.trim())) {
      setProfileCompletionState({
        ...profileCompletionState,
        error: 'Por favor especifique su obra social'
      });
      return;
    }

    const finalProvider = selectedIns === 'Otra'
      ? profileCompletionState.customInsuranceProvider.trim()
      : selectedIns;

    const trimmedInsuranceNumber = profileCompletionState.insuranceNumber?.trim();
    const finalInsurance = finalProvider === 'Particular'
      ? 'Particular'
      : [finalProvider, trimmedInsuranceNumber].filter(Boolean).join(' - ');

    setLoadingProvider(profileCompletionState.provider);
    try {
      const res = await socialLogin({
        provider: profileCompletionState.provider,
        ...profileCompletionState.tokens,
        confirmedEmail: profileCompletionState.email,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        dni: profileCompletionState.dni.trim() || undefined,
        phone: profileCompletionState.phone.trim() || undefined,
        birthDate: profileCompletionState.birthDate.trim() || undefined,
        insuranceProvider: finalInsurance,
        insuranceNumber: trimmedInsuranceNumber || undefined
      });

      if (res.success) {
        setProfileCompletionState(null);
      } else {
        setProfileCompletionState({
          ...profileCompletionState,
          error: res.error || 'Error al completar el registro'
        });
      }
    } catch {
      setProfileCompletionState({
        ...profileCompletionState,
        error: 'Error al enviar datos de registro'
      });
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
      } else if (res.requiresProfileCompletion && res.email) {
        setMissingEmailState(null);
        setProfileCompletionState({
          visible: true,
          provider: missingEmailState.provider,
          email: res.email,
          tokens: missingEmailState.tokens,
          firstName: initialProfileData?.firstName || res.firstName || '',
          lastName: initialProfileData?.lastName || res.lastName || '',
          dni: initialProfileData?.dni || '',
          phone: initialProfileData?.phone || '',
          birthDate: initialProfileData?.birthDate || '1995-01-01',
          insuranceProvider: initialProfileData?.insuranceProvider || 'Particular',
          customInsuranceProvider: initialProfileData?.customInsuranceProvider || '',
          insuranceNumber: initialProfileData?.insuranceNumber || '',
          error: null
        });
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
        <View style={styles.googleIconBadge}>
          <Ionicons name="logo-google" size={14} color="#EA4335" />
        </View>
      );
    }
    if (provider === 'microsoft') {
      return (
        <View style={styles.msGrid}>
          <View style={[styles.msTile, { backgroundColor: '#F25022' }]} />
          <View style={[styles.msTile, { backgroundColor: '#7FBA00' }]} />
          <View style={[styles.msTile, { backgroundColor: '#00A4EF' }]} />
          <View style={[styles.msTile, { backgroundColor: '#FFB900' }]} />
        </View>
      );
    }
    if (provider === 'github') {
      return (
        <View style={styles.githubIconBadge}>
          <Ionicons name="logo-github" size={20} color="#FFFFFF" />
        </View>
      );
    }
    return (
      <View style={styles.facebookIconBadge}>
        <Text style={styles.facebookIconText}>f</Text>
      </View>
    );
  };

  const unconfiguredMeta = unconfiguredProvider ? PROVIDERS_META[unconfiguredProvider] : null;
  const activeProviders: SocialProvider[] = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID
    ? ['google', 'microsoft', 'facebook']
    : ['google', 'github', 'facebook'];

  return (
    <View style={styles.container}>
      {activeProviders.map((prov) => {
        const meta = PROVIDERS_META[prov];
        const isBusy = loadingProvider === prov;

        return (
          <TouchableOpacity
            key={prov}
            activeOpacity={0.85}
            disabled={Boolean(loadingProvider)}
            onPress={() => handlePressProvider(prov)}
            accessibilityRole="button"
            accessibilityLabel={`${actionPrefix} ${meta.name}`}
            style={styles.socialButton}
          >
            <View style={styles.socialIconLeftSlot}>
              {renderProviderIcon(prov)}
            </View>
            {isBusy ? (
              <ActivityIndicator size="small" color="#58B988" />
            ) : (
              <Text style={styles.socialButtonText}>
                {actionPrefix} {meta.name}
              </Text>
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

      {/* MODAL 4: COMPLETAR DATOS DE PERFIL PARA REGISTRO NUEVO CON GOOGLE / GITHUB / FACEBOOK */}
      <ModalWrapper
        visible={Boolean(profileCompletionState?.visible)}
        onClose={() => setProfileCompletionState(null)}
        title="Completar datos de paciente"
        subtitle={`Registro con ${profileCompletionState ? PROVIDERS_META[profileCompletionState.provider].name : 'cuenta social'}`}
      >
        {profileCompletionState && (
          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingBottom: spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.noticeBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <MaterialIcons name="person-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  Correo verificado por {PROVIDERS_META[profileCompletionState.provider].name}
                </Text>
                <Text style={[styles.noticeBody, { color: theme.primary, fontWeight: 'bold' }]}>
                  {profileCompletionState.email}
                </Text>
                <Text style={[styles.noticeBody, { color: theme.textSecondary, marginTop: 2, fontSize: 12 }]}>
                  Escribe tu nombre, apellido y datos clínicos para tu ficha de paciente. No requieres ingresar una contraseña.
                </Text>
              </View>
            </View>

            {profileCompletionState.error && (
              <View style={[styles.errorBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{profileCompletionState.error}</Text>
              </View>
            )}

            <Input
              label="Nombre"
              placeholder="Ej: Lucía"
              value={profileCompletionState.firstName}
              onChangeText={(txt) => setProfileCompletionState({ ...profileCompletionState, firstName: txt, error: null })}
              required
            />

            <Input
              label="Apellido"
              placeholder="Ej: Gómez"
              value={profileCompletionState.lastName}
              onChangeText={(txt) => setProfileCompletionState({ ...profileCompletionState, lastName: txt, error: null })}
              required
            />

            <Input
              label="DNI / Documento"
              placeholder="Ej: 38123456"
              value={profileCompletionState.dni}
              onChangeText={(txt) => setProfileCompletionState({ ...profileCompletionState, dni: txt, error: null })}
              keyboardType="numeric"
            />

            <Input
              label="Teléfono de contacto"
              placeholder="Ej: 11 2345-6789"
              value={profileCompletionState.phone}
              onChangeText={(txt) => setProfileCompletionState({ ...profileCompletionState, phone: txt, error: null })}
              keyboardType="phone-pad"
            />

            <View style={{ marginBottom: spacing.sm }}>
              <DateInput
                label="Fecha de nacimiento"
                value={profileCompletionState.birthDate}
                onChangeDate={(date) => setProfileCompletionState({ ...profileCompletionState, birthDate: date, error: null })}
              />
            </View>

            <View style={{ marginBottom: profileCompletionState.insuranceProvider !== 'Particular' ? spacing.xs : spacing.md }}>
              <InsuranceSelector
                label="Obra social / Cobertura"
                value={profileCompletionState.insuranceProvider}
                onChange={(val) => setProfileCompletionState({ ...profileCompletionState, insuranceProvider: val, error: null })}
                customValue={profileCompletionState.customInsuranceProvider}
                onChangeCustom={(txt) => setProfileCompletionState({ ...profileCompletionState, customInsuranceProvider: txt, error: null })}
              />
            </View>

            {profileCompletionState.insuranceProvider && profileCompletionState.insuranceProvider !== 'Particular' && (
              <Input
                label="N° de afiliado / Credencial (opcional)"
                placeholder="Ej: 1234567801"
                value={profileCompletionState.insuranceNumber}
                onChangeText={(txt) => setProfileCompletionState({ ...profileCompletionState, insuranceNumber: txt, error: null })}
                keyboardType="numeric"
                containerStyle={{ marginBottom: spacing.md }}
              />
            )}

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setProfileCompletionState(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Crear cuenta"
                onPress={handleConfirmProfileCompletion}
                loading={Boolean(loadingProvider)}
                style={{ flex: 1.5 }}
              />
            </View>
          </ScrollView>
        )}
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 4
  },
  socialButton: {
    height: 48,
    backgroundColor: '#15261F',
    borderColor: '#203A2D',
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10
  },
  socialIconLeftSlot: {
    position: 'absolute',
    left: 18,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  googleIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  facebookIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  facebookIconText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: -2
  },
  githubIconBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  msGrid: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2
  },
  msTile: {
    width: 7,
    height: 7
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center'
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
