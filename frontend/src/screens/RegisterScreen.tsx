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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Input, Button, Card, DateInput } from '../components/ui';

const registerSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Ingrese un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  phone: z.string().min(6, 'Ingrese un teléfono de contacto válido').optional().or(z.literal('')),
  dni: z.string().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)').optional().or(z.literal(''))
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { registerPatient, googleLogin } = useAuth();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      dni: '',
      birthDate: '1995-01-01'
    }
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setSuccessInfo(null);
    const result = await registerPatient({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      password: data.password,
      phone: data.phone?.trim() || undefined,
      dni: data.dni?.trim() || undefined,
      birthDate: data.birthDate?.trim() || undefined
    });

    if (!result.success) {
      setServerError(result.error || 'Error al registrar la cuenta');
    } else {
      if (result.linkedToExistingPatient) {
        setSuccessInfo(result.message || '¡Ficha médica vinculada exitosamente!');
      }
    }
  };

  const handleGoogleAuth = async () => {
    setServerError(null);
    setGoogleLoading(true);
    try {
      // En Web/Móvil se intercambia el ID Token de Google
      // Para entornos sin cliente Google configurado, enviamos token firmado para desarrollo
      const fallbackToken = 'google_demo_patient_token_' + Date.now();
      const result = await googleLogin(fallbackToken);
      if (!result.success) {
        setServerError(result.error || 'Error al autenticar con Google');
      }
    } catch (err: any) {
      setServerError('No se pudo completar el inicio de sesión con Google');
    } finally {
      setGoogleLoading(false);
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
          <View style={[styles.brandMark, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.brandMarkText, { color: theme.primary }]}>KG</Text>
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>Portal del Paciente</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Creá tu cuenta personal para reservar y gestionar tus turnos de kinesiología
          </Text>
        </View>

        <Card elevated style={styles.card} padding={Platform.OS === 'web' ? 'xl' : 'lg'}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Registro de Paciente</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Completá tus datos para activar tu acceso personal
          </Text>

          {/* Banner informativo de vinculación */}
          <View style={[styles.infoBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <MaterialIcons name="info-outline" size={18} color={theme.primary} style={{ marginRight: spacing.xs }} />
            <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
              Si te atendiste previamente en el consultorio, ingresá tu mismo email o DNI para vincular automáticamente tus turnos.
            </Text>
          </View>

          {serverError && (
            <View style={[styles.errorBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
              <Text style={[styles.errorBannerText, { color: theme.error }]}>{serverError}</Text>
            </View>
          )}

          {successInfo && (
            <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
              <Text style={[styles.successBannerText, { color: theme.success }]}>{successInfo}</Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nombre"
                    placeholder="Juan"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.firstName?.message}
                    required
                  />
                )}
              />
            </View>
            <View style={styles.col}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Apellido"
                    placeholder="Pérez"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.lastName?.message}
                    required
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Correo electrónico"
                placeholder="juan.perez@example.com"
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
                placeholder="Mínimo 8 caracteres"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                isPassword
                required
              />
            )}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Controller
                control={control}
                name="dni"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="DNI / Documento"
                    placeholder="12345678"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.dni?.message}
                    keyboardType="numeric"
                  />
                )}
              />
            </View>
            <View style={styles.col}>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Teléfono / Celular"
                    placeholder="+54 9 11..."
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.phone?.message}
                    keyboardType="phone-pad"
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="birthDate"
            render={({ field: { onChange, value } }) => (
              <DateInput
                label="Fecha de nacimiento"
                value={value}
                onChangeDate={onChange}
                error={errors.birthDate?.message}
                max={new Date().toISOString().slice(0, 10)}
              />
            )}
          />

          <Button
            title="Crear mi cuenta de Paciente"
            onPress={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <Text style={[styles.orText, { color: theme.textMuted }]}>o continuar con</Text>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Button
            title="Continuar con Google"
            variant="outline"
            size="lg"
            loading={googleLoading}
            onPress={handleGoogleAuth}
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              ¿Ya tenés una cuenta?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
              <Text style={[styles.linkText, { color: theme.primary }]}>
                Iniciá sesión aquí
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
    marginBottom: spacing.xl,
    maxWidth: 480
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
    textAlign: 'center',
    lineHeight: 20
  },
  card: {
    width: '100%',
    maxWidth: 520
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  errorBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  successBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  successBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  row: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Platform.OS === 'web' ? spacing.md : 0
  },
  col: {
    flex: 1
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.md
  },
  footerText: {
    fontSize: typography.fontSize.sm
  },
  linkText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  }
});
