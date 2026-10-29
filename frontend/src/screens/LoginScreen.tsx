import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Input, Button, Card, SocialAuthButtons } from '../components/ui';
import { API_BASE_URL } from '../api/config';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { login } = useAuth();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    const result = await login(data.email, data.password);
    if (!result.success) {
      setServerError(result.error || 'Credenciales inválidas');
    }
  };

  const fillDemoCredentials = (email: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
    setServerError(null);
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
          <View style={[styles.brandMark, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.brandMarkText, { color: theme.primary }]}>KG</Text>
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>KinesioGestión</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Sistema Integral para Consultorio y Fisioterapia
          </Text>
        </View>

        <Card elevated style={styles.card} padding={Platform.OS === 'web' ? 'xl' : 'lg'}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Iniciar sesión</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Ingrese sus credenciales profesionales para acceder
          </Text>

          {serverError && (
            <View style={[styles.errorBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
              <Text style={[styles.errorBannerText, { color: theme.error }]}>{serverError}</Text>
            </View>
          )}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Correo electrónico"
                placeholder="profesional@kinesiologia.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                required
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Contraseña"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                isPassword
                required
              />
            )}
          />

          <View style={styles.forgotPasswordRow}>
            <TouchableOpacity
              onPress={() => navigation?.navigate('ForgotPassword')}
              accessibilityRole="button"
              accessibilityLabel="Recuperar contraseña"
            >
              <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                ¿Olvidó su contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Ingresar al sistema"
            onPress={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <Text style={[styles.orText, { color: theme.textMuted }]}>Portal de Pacientes</Text>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Button
            title="Crear cuenta de Paciente"
            variant="outline"
            size="lg"
            onPress={() => navigation?.navigate('Register')}
            style={{ marginBottom: spacing.sm }}
          />

          <SocialAuthButtons mode="login" onError={setServerError} />

          {__DEV__ && (
            <View style={styles.demoBox}>
              <Text style={[styles.demoTitle, { color: theme.textSecondary }]}>Cuentas demo (desarrollo):</Text>
              <View style={styles.demoButtonsRow}>
                <TouchableOpacity
                  onPress={() => fillDemoCredentials('admin@kinesiologia.com')}
                  style={[styles.demoChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                >
                  <Text style={[styles.demoChipText, { color: theme.primary }]}>Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => fillDemoCredentials('carlos.kine@kinesiologia.com')}
                  style={[styles.demoChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                >
                  <Text style={[styles.demoChipText, { color: theme.primary }]}>Kinesiólogo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => fillDemoCredentials('mariana.recep@kinesiologia.com')}
                  style={[styles.demoChip, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                >
                  <Text style={[styles.demoChipText, { color: theme.primary }]}>Recepción</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.footerNote}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Acceso seguro con token cifrado y control de sesiones por rol.
            </Text>
            {__DEV__ && (
              <Text style={[styles.serverInfoText, { color: theme.textMuted }]}>
                Servidor API: {API_BASE_URL}
              </Text>
            )}
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
    marginBottom: Platform.OS === 'web' ? spacing.xxl : spacing.lg
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  brandMarkText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  brandTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  card: {
    width: '100%',
    maxWidth: 420
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg
  },
  errorBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  footerNote: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center'
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 16
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm
  },
  forgotPasswordText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg
  },
  line: {
    flex: 1,
    height: 1
  },
  orText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  demoBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000010'
  },
  demoTitle: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  demoChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  demoChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  serverInfoText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 4,
    opacity: 0.7
  }
});
