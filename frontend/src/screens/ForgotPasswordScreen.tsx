import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Input, Button, Card, Badge } from '../components/ui';

const forgotSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido')
});

const resetSchema = z
  .object({
    token: z.string().min(1, 'El código o token de recuperación es requerido'),
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
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  // Formulario Paso 1: Solicitud
  const {
    control: requestControl,
    handleSubmit: handleRequestSubmit,
    formState: { errors: requestErrors, isSubmitting: isRequestSubmitting }
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' }
  });

  // Formulario Paso 2: Restablecimiento
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
    try {
      const response = await apiClient.post('/auth/forgot-password', { email: data.email });
      if (response.data?.success) {
        setServerMessage(
          response.data.message ||
            'Si el correo electrónico existe en el sistema, se ha generado el enlace de restablecimiento.'
        );
        const token = response.data?.data?.resetToken;
        if (token) {
          setDevToken(token);
          setResetValue('token', token);
        }
        setStep('reset');
      } else {
        setServerError(response.data?.error?.message || 'Error al procesar la solicitud.');
      }
    } catch (err: any) {
      setServerError(
        err.response?.data?.error?.message || 'No se pudo conectar con el servidor de autenticación.'
      );
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    setServerError(null);
    setServerMessage(null);
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token: data.token,
        newPassword: data.newPassword
      });

      if (response.data?.success) {
        setStep('success');
      } else {
        setServerError(response.data?.error?.message || 'Token inválido o expirado.');
      }
    } catch (err: any) {
      setServerError(
        err.response?.data?.error?.message ||
          'El código de recuperación es inválido o ya ha sido utilizado.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            Gestión segura de credenciales de acceso
          </Text>
        </View>

        <Card elevated style={styles.card} padding="xl">
          {step === 'success' ? (
            <View style={styles.successContainer}>
              <View
                style={[
                  styles.successIconCircle,
                  { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }
                ]}
              >
                <MaterialIcons name="check-circle" size={40} color={theme.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text, textAlign: 'center' }]}>
                Contraseña restablecida
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary, textAlign: 'center', marginBottom: spacing.xl }]}>
                Su contraseña ha sido actualizada con éxito. Ya puede iniciar sesión con sus nuevas credenciales.
              </Text>
              <Button
                title="Ir a Iniciar Sesión"
                onPress={() => navigation.navigate('Login')}
                size="lg"
                style={{ width: '100%' }}
              />
            </View>
          ) : (
            <>
              {/* Selector de modo / paso */}
              <View style={[styles.stepTabs, { backgroundColor: theme.background, borderColor: theme.border }]}>
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
                    2. Restablecer
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
                  <MaterialIcons name="error-outline" size={18} color={theme.error} style={{ marginRight: spacing.xs }} />
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
                  <MaterialIcons name="check" size={18} color={theme.primary} style={{ marginRight: spacing.xs }} />
                  <Text style={[styles.bannerText, { color: theme.primary }]}>{serverMessage}</Text>
                </View>
              )}

              {devToken && step === 'reset' && (
                <View style={[styles.devNotice, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.devNoticeHeader}>
                    <Badge label="Entorno de Desarrollo" variant="info" size="sm" />
                  </View>
                  <Text style={[styles.devNoticeText, { color: theme.textSecondary }]}>
                    Token autocompletado en el formulario para pruebas rápidas.
                  </Text>
                </View>
              )}

              {step === 'request' ? (
                /* PASO 1: Ingreso de correo */
                <View>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
                    Ingrese el correo electrónico registrado con su cuenta para recibir las instrucciones de recuperación.
                  </Text>

                  <Controller
                    control={requestControl}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Correo electrónico registrado"
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
                    title="Enviar instrucciones"
                    onPress={() => handleRequestSubmit(onRequestSubmit)()}
                    loading={isRequestSubmitting}
                    size="lg"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                /* PASO 2: Restablecer contraseña con token */
                <View>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: spacing.lg }]}>
                    Pegue el token de seguridad recibido e ingrese su nueva clave de acceso.
                  </Text>

                  <Controller
                    control={resetControl}
                    name="token"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Token o código de recuperación"
                        placeholder="Pegue aquí el token recibido"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={resetErrors.token?.message}
                        autoCapitalize="none"
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
                    title="Guardar nueva contraseña"
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
              <MaterialIcons name="arrow-back" size={16} color={theme.primary} style={{ marginRight: spacing.xs }} />
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
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
    fontWeight: typography.fontWeight.medium
  },
  devNotice: {
    padding: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  devNoticeHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs
  },
  devNoticeText: {
    fontSize: typography.fontSize.xs
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
