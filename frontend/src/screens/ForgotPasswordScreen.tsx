import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Input, Button, Card } from '../components/ui';

const forgotSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido')
});

const resetSchema = z
  .object({
    token: z
      .string()
      .min(6, 'Ingrese el código de 6 dígitos recibido por correo')
      .max(500, 'Código inválido'),
    newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme la contraseña')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  });

type ForgotFormData = z.infer<typeof forgotSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [previewEmailUrl, setPreviewEmailUrl] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string>('');

  // Formulario Paso 1: Solicitud de código
  const {
    control: requestControl,
    handleSubmit: handleRequestSubmit,
    formState: { errors: requestErrors, isSubmitting: isRequestSubmitting }
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' }
  });

  // Formulario Paso 2: Restablecimiento con código y nueva contraseña
  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    setValue: setResetValue,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting }
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: '', newPassword: '', confirmPassword: '' }
  });

  const onRequestSubmit = async (data: ForgotFormData) => {
    setServerError(null);
    setServerMessage(null);
    setPreviewEmailUrl(null);
    setPreviewCode(null);
    setTargetEmail(data.email);

    try {
      const response = await apiClient.post('/auth/forgot-password', { email: data.email });
      if (response.data?.success) {
        const preview = response.data?.data?.previewUrl;
        const code = response.data?.data?.previewCode;

        if (preview) {
          setPreviewEmailUrl(preview);
        }

        if (code) {
          setPreviewCode(code);
          setResetValue('token', code);
          setServerMessage(
            `Código de verificación: ${code}. Ingréselo a continuación junto con su nueva contraseña.`
          );
        } else if (response.data?.data?.emailSent) {
          setServerMessage(
            `Hemos enviado un correo a ${data.email} con su código de verificación de 6 dígitos.`
          );
        } else {
          setServerMessage(
            `Hemos procesado la solicitud para ${data.email}. Ingrese el código de 6 dígitos para restablecer su contraseña.`
          );
        }

        setStep('reset');
      } else {
        setServerError(response.data?.error?.message || 'Error al procesar la solicitud.');
      }
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setServerError('El servidor tardó en responder. Por favor intente nuevamente en unos instantes.');
      } else if (err.response?.status === 429) {
        setServerError(
          err.response?.data?.error?.message ||
            'Demasiadas solicitudes de recuperación. Por favor espere unos minutos antes de reintentar.'
        );
      } else if (err.response?.data?.error?.message) {
        setServerError(err.response.data.error.message);
      } else {
        setServerError('No se pudo conectar con el servidor de autenticación. Verifique su conexión a internet.');
      }
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    setServerError(null);
    setServerMessage(null);
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token: data.token.trim(),
        newPassword: data.newPassword
      });

      if (response.data?.success) {
        setStep('success');
      } else {
        setServerError(response.data?.error?.message || 'El código es inválido o ha expirado.');
      }
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setServerError('El servidor tardó en responder. Por favor intente nuevamente en unos instantes.');
      } else if (err.response?.status === 429) {
        setServerError(
          err.response?.data?.error?.message ||
            'Demasiados intentos de restablecimiento. Por favor espere unos minutos antes de reintentar.'
        );
      } else if (err.response?.data?.error?.message) {
        setServerError(err.response.data.error.message);
      } else {
        setServerError(
          'El código de recuperación es inválido, ya fue utilizado o ha expirado.'
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20) + spacing.md,
            paddingBottom: Math.max(insets.bottom, 20) + spacing.xl,
            paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md
          }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandContainer}>
          <View
            style={[
              styles.brandMark,
              { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }
            ]}
          >
            <MaterialIcons name="lock-reset" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>Recuperar Contraseña</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Restablecimiento seguro de credenciales de acceso
          </Text>
        </View>

        <Card elevated style={styles.card} padding={Platform.OS === 'web' ? 'xl' : 'lg'}>
          {step === 'success' ? (
            <View style={styles.successContainer}>
              <View
                style={[
                  styles.successIconCircle,
                  { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }
                ]}
              >
                <MaterialIcons name="check-circle" size={42} color={theme.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text, textAlign: 'center' }]}>
                Contraseña actualizada
              </Text>
              <Text
                style={[
                  styles.cardSubtitle,
                  {
                    color: theme.textSecondary,
                    textAlign: 'center',
                    marginBottom: spacing.xl,
                    lineHeight: 22
                  }
                ]}
              >
                Su contraseña ha sido modificada correctamente. Ya puede acceder al sistema con su
                nueva clave.
              </Text>
              <Button
                title="Iniciar Sesión"
                onPress={() => navigation.navigate('Login')}
                size="lg"
                style={{ width: '100%' }}
              />
            </View>
          ) : (
            <>
              {/* Selector de pestañas */}
              <View
                style={[
                  styles.stepTabs,
                  { backgroundColor: theme.background, borderColor: theme.border }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.stepTab,
                    step === 'request' && [styles.stepTabActive, { backgroundColor: theme.surface }]
                  ]}
                  onPress={() => {
                    setServerError(null);
                    setStep('request');
                  }}
                >
                  <Text
                    style={[
                      styles.stepTabText,
                      { color: step === 'request' ? theme.primary : theme.textSecondary }
                    ]}
                  >
                    1. Solicitar código
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stepTab,
                    step === 'reset' && [styles.stepTabActive, { backgroundColor: theme.surface }]
                  ]}
                  onPress={() => {
                    setServerError(null);
                    setStep('reset');
                  }}
                >
                  <Text
                    style={[
                      styles.stepTabText,
                      { color: step === 'reset' ? theme.primary : theme.textSecondary }
                    ]}
                  >
                    2. Ingresar código
                  </Text>
                </TouchableOpacity>
              </View>

              {serverError && (
                <View
                  style={[
                    styles.banner,
                    { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }
                  ]}
                >
                  <MaterialIcons
                    name="error-outline"
                    size={18}
                    color={theme.error}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={[styles.bannerText, { color: theme.error }]}>{serverError}</Text>
                </View>
              )}

              {serverMessage && (
                <View
                  style={[
                    styles.banner,
                    { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }
                  ]}
                >
                  <MaterialIcons
                    name="mark-email-read"
                    size={20}
                    color={theme.primary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={[styles.bannerText, { color: theme.primary }]}>{serverMessage}</Text>
                </View>
              )}

              {previewEmailUrl && step === 'reset' && (
                <TouchableOpacity
                  style={[
                    styles.previewEmailBox,
                    { backgroundColor: theme.surface, borderColor: theme.primary + '40' }
                  ]}
                  onPress={() => Linking.openURL(previewEmailUrl)}
                  accessibilityRole="link"
                >
                  <MaterialIcons
                    name="open-in-new"
                    size={16}
                    color={theme.primary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text style={[styles.previewEmailText, { color: theme.primary }]}>
                    Ver correo enviado en bandeja de prueba (Ethereal)
                  </Text>
                </TouchableOpacity>
              )}

              {previewCode && step === 'reset' && (
                <View
                  style={[
                    styles.previewCodeBox,
                    { backgroundColor: theme.primaryLight + '35', borderColor: theme.primary + '50' }
                  ]}
                >
                  <MaterialIcons
                    name="vpn-key"
                    size={22}
                    color={theme.primary}
                    style={{ marginRight: spacing.sm }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewCodeLabel, { color: theme.textSecondary }]}>
                      Código de verificación temporal:
                    </Text>
                    <Text style={[styles.previewCodeValue, { color: theme.primary }]}>
                      {previewCode}
                    </Text>
                  </View>
                </View>
              )}

              {step === 'request' ? (
                /* PASO 1: Ingreso de correo */
                <View>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: theme.textSecondary, marginBottom: spacing.lg }
                    ]}
                  >
                    Ingrese su correo electrónico registrado para recibir el código de verificación
                    de 6 dígitos.
                  </Text>

                  <Controller
                    control={requestControl}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Correo electrónico"
                        placeholder="profesional@kinesiologia.com"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={requestErrors.email?.message}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        required
                      />
                    )}
                  />

                  <Button
                    title="Enviar código de verificación"
                    onPress={() => handleRequestSubmit(onRequestSubmit)()}
                    loading={isRequestSubmitting}
                    size="lg"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                /* PASO 2: Ingreso de código de 6 dígitos y nueva contraseña */
                <View>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: theme.textSecondary, marginBottom: spacing.lg }
                    ]}
                  >
                    {targetEmail
                      ? `Ingrese el código de 6 dígitos enviado a ${targetEmail} y su nueva contraseña.`
                      : 'Ingrese el código de verificación recibido por correo electrónico y su nueva contraseña.'}
                  </Text>

                  <Controller
                    control={resetControl}
                    name="token"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Código de verificación (6 dígitos)"
                        placeholder="Ej: 123456"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={resetErrors.token?.message}
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        maxLength={500}
                        required
                      />
                    )}
                  />

                  <Controller
                    control={resetControl}
                    name="newPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Nueva contraseña"
                        placeholder="Mínimo 8 caracteres"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={resetErrors.newPassword?.message}
                        isPassword
                        required
                      />
                    )}
                  />

                  <Controller
                    control={resetControl}
                    name="confirmPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Confirmar nueva contraseña"
                        placeholder="Reescriba la contraseña"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={resetErrors.confirmPassword?.message}
                        isPassword
                        required
                      />
                    )}
                  />

                  <Button
                    title="Actualizar contraseña"
                    onPress={() => handleResetSubmit(onResetSubmit)()}
                    loading={isResetSubmitting}
                    size="lg"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </>
          )}

          {/* Enlace para volver a Iniciar Sesión */}
          <View style={styles.backLinkContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.backLink}
              accessibilityRole="button"
            >
              <MaterialIcons
                name="arrow-back"
                size={16}
                color={theme.primary}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={[styles.backLinkText, { color: theme.primary }]}>
                Volver a Iniciar Sesión
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center'
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  brandTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    letterSpacing: 0.2
  },
  card: {
    width: '100%',
    maxWidth: 440
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  stepTabs: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.lg
  },
  stepTab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radii.sm - 2
  },
  stepTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  stepTabText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  bannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 18
  },
  previewEmailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  previewEmailText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  previewCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  previewCodeLabel: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium
  },
  previewCodeValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 4,
    marginTop: 2
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  backLinkContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.md
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  backLinkText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  }
});
