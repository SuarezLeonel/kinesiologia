/**
 * @file LoginScreen.tsx
 * @description Pantalla de autenticación: ingreso con email/contraseña, botones demo y login social.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii } from '../theme/tokens';
import { SocialAuthButtons } from '../components/ui';
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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passFocused, setPassFocused] = useState<boolean>(false);

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
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123!', { shouldValidate: true });
    setServerError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Siluetas orgánicas de hojas en el fondo para diseño botánico/médico */}
      <View style={styles.bgLeafTopRight} pointerEvents="none" />
      <View style={styles.bgLeafTopRightInner} pointerEvents="none" />
      <View style={styles.bgLeafTopLeft} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + spacing.md,
            paddingBottom: Math.max(insets.bottom, 24) + spacing.xl,
            paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera con Logo Oficial y Nombre de la Marca */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/logoKinesio.webp')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>
            Kinesio<Text style={styles.brandTitleAccent}>Gestión</Text>
          </Text>
          <Text style={styles.brandSubtitle}>
            Sistema Integral para Consultorio y Fisioterapia
          </Text>
        </View>

        {/* Tarjeta de Autenticación Principal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>
          <Text style={styles.cardSubtitle}>
            Ingrese sus credenciales profesionales para acceder
          </Text>

          {serverError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          {/* Campo Correo Electrónico */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Correo electrónico <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                emailFocused && styles.inputBoxFocused,
                Boolean(errors.email) && styles.inputBoxError
              ]}
            >
              <MaterialIcons
                name="mail-outline"
                size={18}
                color={emailFocused ? '#58B988' : '#60796C'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="tu@correo.com"
                    placeholderTextColor="#4D6357"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false);
                      onBlur();
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                )}
              />
            </View>
            {errors.email && (
              <Text style={styles.fieldErrorText}>{errors.email.message}</Text>
            )}
          </View>

          {/* Campo Contraseña */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Contraseña <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                passFocused && styles.inputBoxFocused,
                Boolean(errors.password) && styles.inputBoxError
              ]}
            >
              <MaterialIcons
                name="lock-outline"
                size={18}
                color={passFocused ? '#58B988' : '#60796C'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="Tu contraseña"
                    placeholderTextColor="#4D6357"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => {
                      setPassFocused(false);
                      onBlur();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                )}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIconButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={19}
                  color="#6B8678"
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.fieldErrorText}>{errors.password.message}</Text>
            )}
          </View>

          {/* Enlace Olvidó su contraseña */}
          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity
              onPress={() => navigation?.navigate('ForgotPassword')}
              accessibilityRole="button"
              accessibilityLabel="Recuperar contraseña"
            >
              <Text style={styles.forgotPasswordLink}>¿Olvidó su contraseña?</Text>
            </TouchableOpacity>
          </View>

          {/* Botón Principal: Ingresar al sistema */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSubmit(onSubmit)()}
            disabled={isSubmitting}
            style={styles.submitButton}
            accessibilityRole="button"
            accessibilityLabel="Ingresar al sistema"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0E241A" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Ingresar al sistema</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#0E241A" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Separador 1: Cuentas Externas */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>O ingrese con una cuenta externa</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botones Sociales con Diseño Oscuro y Logotipos Oficiales */}
          <SocialAuthButtons mode="login" onError={setServerError} />

          {/* Separador 2: Portal de Pacientes */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.patientPortalDividerText}>PORTAL DE PACIENTES</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botón Crear Cuenta de Paciente */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('Register')}
            style={styles.patientPortalButton}
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta de Paciente"
          >
            <Ionicons name="person-outline" size={18} color="#58B988" style={{ marginRight: 8 }} />
            <Text style={styles.patientPortalButtonText}>Crear cuenta de Paciente</Text>
          </TouchableOpacity>

          {/* Acceso Rápido Cuentas Demo */}
          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>CUENTAS DEMO (CLIC RÁPIDO):</Text>
            <View style={styles.demoPillsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => fillDemoCredentials('admin@kinesiologia.com')}
                style={styles.demoPill}
              >
                <Text style={styles.demoPillText}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => fillDemoCredentials('carlos.kine@kinesiologia.com')}
                style={styles.demoPill}
              >
                <Text style={styles.demoPillText}>Kinesiólogo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => fillDemoCredentials('mariana.recep@kinesiologia.com')}
                style={styles.demoPill}
              >
                <Text style={styles.demoPillText}>Recepción</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pie de Pantalla */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerNoteText}>
              Acceso seguro con token cifrado y control de sesiones por rol.
            </Text>
            <Text style={styles.footerServerText}>
              Servidor API: {API_BASE_URL}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1813',
    position: 'relative',
    overflow: 'hidden'
  },
  /* Hojas orgánicas decorativas de fondo */
  bgLeafTopRight: {
    position: 'absolute',
    top: -50,
    right: -70,
    width: 240,
    height: 340,
    borderTopLeftRadius: 170,
    borderBottomRightRadius: 170,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: '#12281D',
    opacity: 0.5,
    transform: [{ rotate: '-25deg' }]
  },
  bgLeafTopRightInner: {
    position: 'absolute',
    top: 20,
    right: -40,
    width: 180,
    height: 260,
    borderTopLeftRadius: 130,
    borderBottomRightRadius: 130,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 15,
    backgroundColor: '#163325',
    opacity: 0.35,
    transform: [{ rotate: '-10deg' }]
  },
  bgLeafTopLeft: {
    position: 'absolute',
    top: 30,
    left: -80,
    width: 220,
    height: 300,
    borderTopRightRadius: 150,
    borderBottomLeftRadius: 150,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: '#12281D',
    opacity: 0.4,
    transform: [{ rotate: '35deg' }]
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center'
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 16
  },
  logoCard: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: '#13281E',
    borderWidth: 1.5,
    borderColor: '#224C39',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  logoImage: {
    width: 72,
    height: 72
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center'
  },
  brandTitleAccent: {
    color: '#56B988'
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#7E978A',
    marginTop: 4,
    textAlign: 'center'
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#102019',
    borderWidth: 1,
    borderColor: '#1B3528',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#7E978A',
    marginBottom: 20
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 16
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#EF4444'
  },
  fieldGroup: {
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D0DED5',
    marginBottom: 6
  },
  requiredAsterisk: {
    color: '#E05252'
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#15261F',
    borderWidth: 1,
    borderColor: '#1F382B',
    borderRadius: 10,
    paddingHorizontal: 12
  },
  inputBoxFocused: {
    borderColor: '#58B988'
  },
  inputBoxError: {
    borderColor: '#EF4444'
  },
  inputLeftIcon: {
    marginRight: 10
  },
  textInputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: 48,
    paddingVertical: 0
  },
  eyeIconButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500'
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 18
  },
  forgotPasswordLink: {
    fontSize: 13,
    fontWeight: '500',
    color: '#56B988'
  },
  submitButton: {
    height: 50,
    backgroundColor: '#72BA97',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  submitButtonText: {
    color: '#0E241A',
    fontSize: 15,
    fontWeight: '700'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1B3326'
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#657D70'
  },
  patientPortalDividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#657D70'
  },
  patientPortalButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2B5742',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  patientPortalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#58B988'
  },
  demoSection: {
    marginBottom: 16
  },
  demoSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#657D70',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  demoPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  demoPill: {
    backgroundColor: '#13251E',
    borderWidth: 1,
    borderColor: '#1E3B2E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  demoPillText: {
    color: '#58B988',
    fontSize: 12,
    fontWeight: '500'
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 8
  },
  footerNoteText: {
    fontSize: 11,
    color: '#587063',
    textAlign: 'center',
    lineHeight: 16
  },
  footerServerText: {
    fontSize: 11,
    color: '#587063',
    textAlign: 'center',
    marginTop: 4
  }
});
