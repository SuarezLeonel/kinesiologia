import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Input, Button, Card } from '../components/ui';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginScreen = () => {
  const { login } = useAuth();
  const { theme } = useAppTheme();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
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
          <View style={[styles.brandMark, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.brandMarkText, { color: theme.primary }]}>KG</Text>
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>KinesioGestión</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Sistema Integral para Consultorio y Fisioterapia
          </Text>
        </View>

        <Card elevated style={styles.card} padding="xl">
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

          <Button
            title="Ingresar al sistema"
            onPress={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.footerNote}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Acceso seguro con token cifrado y control de sesiones por rol.
            </Text>
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
  }
});
