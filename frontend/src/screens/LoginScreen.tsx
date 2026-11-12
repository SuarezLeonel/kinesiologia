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
import { useResponsive } from '../theme/useResponsive';
import { SocialAuthButtons } from '../components/ui';

const loginSchema = z.object({
  email: z.string().email('Ingresá un correo válido'),
  password: z.string().min(1, 'Completá este campo.')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { login } = useAuth();
  const { theme } = useAppTheme();
  const { isSmallPhone } = useResponsive();
  const insets = useSafeAreaInsets();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passFocused, setPassFocused] = useState<boolean>(false);

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
    setUnverifiedEmail(null);
    const result = await login(data.email, data.password);
    if (!result.success) {
      setServerError(result.error || 'Credenciales inválidas');
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(data.email.trim().toLowerCase());
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.container,
        Platform.OS === 'web' && ({
          height: '100dvh',
          minHeight: '100dvh',
          overflowY: 'auto'
        } as any)
      ]}
    >
      {/* Siluetas orgánicas de hojas en el fondo para diseño botánico/médico */}
      <View style={styles.bgLeafTopRight} pointerEvents="none" />
      <View style={styles.bgLeafTopRightInner} pointerEvents="none" />
      <View style={styles.bgLeafTopLeft} pointerEvents="none" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + spacing.md,
            paddingBottom: Math.max(insets.bottom, 24) + spacing.xl,
            paddingHorizontal: Platform.OS === 'web' ? spacing.xl : isSmallPhone ? spacing.sm : spacing.md
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrapper}>
          {/* Cabecera con Logo Oficial y Nombre de la Marca */}
          <View style={styles.brandContainer}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/images/logoKinesio.webp')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>
              Kinesio<Text style={styles.brandTitleAccent}>Gestión</Text>
            </Text>
            <Text style={styles.brandSubtitle}>
              Consultorio de Kinesiología
            </Text>
          </View>

          {/* Tarjeta de Autenticación Principal */}
          <View style={[styles.card, isSmallPhone && { paddingHorizontal: 16, paddingVertical: 20 }]}>
          <Text style={[styles.cardTitle, { marginBottom: 16 }]}>Iniciar sesión</Text>

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
                size={22}
                color={emailFocused ? '#6CE0A6' : '#94ADA0'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor="#8FA89B"
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
                    accessibilityLabel="Correo electrónico"
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
                size={22}
                color={passFocused ? '#6CE0A6' : '#94ADA0'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="Escribí tu contraseña"
                    placeholderTextColor="#8FA89B"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => {
                      setPassFocused(false);
                      onBlur();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    accessibilityLabel="Contraseña"
                  />
                )}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIconButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#A3BDB0"
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
              style={styles.forgotPasswordTouch}
              accessibilityRole="button"
              accessibilityLabel="Recuperar contraseña"
            >
              <Text style={styles.forgotPasswordLink}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          {/* Botón Principal: Ingresar */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSubmit(onSubmit)()}
            disabled={isSubmitting}
            style={styles.submitButton}
            accessibilityRole="button"
            accessibilityLabel="Ingresar al sistema"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0A1B12" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Ingresar</Text>
                <MaterialIcons name="arrow-forward" size={22} color="#0A1B12" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Mensajes de error generales o cuenta no verificada inmediatamente debajo del botón de acción */}
          {Boolean(serverError) && (
            <View style={[styles.errorBanner, Boolean(unverifiedEmail) && styles.unverifiedBanner, { marginTop: 12, marginBottom: 8 }]}>
              <Text style={[styles.errorBannerText, Boolean(unverifiedEmail) && styles.unverifiedBannerText]}>{serverError}</Text>
              {Boolean(unverifiedEmail) && (
                <TouchableOpacity
                  style={styles.verifyAccountButton}
                  onPress={() => navigation?.navigate('VerifyEmail', { email: unverifiedEmail })}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="mark-email-unread" size={16} color="#0D9488" style={{ marginRight: 6 }} />
                  <Text style={styles.verifyAccountButtonText}>Revisar o reenviar verificación</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Separador 1: Cuentas Externas */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o ingresá con</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botones Sociales con Diseño Oscuro y Logotipos Oficiales */}
          <SocialAuthButtons mode="login" onError={setServerError} />

          {/* Separador 2: Portal de Pacientes */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.patientPortalDividerText}>¿SOS NUEVO PACIENTE?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botón Crear Cuenta de Paciente */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('Register')}
            style={[styles.patientPortalButton, { marginBottom: 0 }]}
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta de paciente"
          >
            <Ionicons name="person-add-outline" size={20} color="#6CE0A6" style={{ marginRight: 8 }} />
            <Text style={styles.patientPortalButtonText}>Crear cuenta de paciente</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
    width: '100%'
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Platform.OS === 'web' ? ('auto' as any) : undefined
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
  brandContainer: {
    alignItems: 'center',
    marginBottom: 18
  },
  logoCard: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#13281E',
    borderWidth: 1.5,
    borderColor: '#2E5B45',
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
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center'
  },
  brandTitleAccent: {
    color: '#6CE0A6'
  },
  brandSubtitle: {
    fontSize: 18,
    color: '#B2C9BC',
    marginTop: 4,
    textAlign: 'center'
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#102019',
    borderWidth: 1.5,
    borderColor: '#244535',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6
  },
  cardSubtitle: {
    fontSize: 18,
    color: '#B2C9BC',
    marginBottom: 20
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1.5,
    borderColor: '#F87171',
    marginBottom: 16
  },
  errorBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FCA5A5',
    lineHeight: 22
  },
  unverifiedBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderColor: '#FBBF24'
  },
  unverifiedBannerText: {
    color: '#FDE68A'
  },
  verifyAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    backgroundColor: '#E6FFFA',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#99F6E4'
  },
  verifyAccountButtonText: {
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '700'
  },
  fieldGroup: {
    marginBottom: 16
  },
  fieldLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E6F0EA',
    marginBottom: 8
  },
  requiredAsterisk: {
    color: '#F87171'
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: '#152820',
    borderWidth: 1.5,
    borderColor: '#2E5240',
    borderRadius: 12,
    paddingHorizontal: 14
  },
  inputBoxFocused: {
    borderColor: '#6CE0A6',
    borderWidth: 2
  },
  inputBoxError: {
    borderColor: '#F87171',
    borderWidth: 2
  },
  inputLeftIcon: {
    marginRight: 10
  },
  textInputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    minHeight: 52,
    paddingVertical: 8
  },
  eyeIconButton: {
    minWidth: 44,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldErrorText: {
    fontSize: 15,
    color: '#FCA5A5',
    marginTop: 6,
    fontWeight: '600'
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 16
  },
  forgotPasswordTouch: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  forgotPasswordLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6CE0A6'
  },
  submitButton: {
    minHeight: 54,
    backgroundColor: '#6CE0A6',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  submitButtonText: {
    color: '#0A1B12',
    fontSize: 18,
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
    backgroundColor: '#244535'
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 15,
    color: '#9CB5A7'
  },
  patientPortalDividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#9CB5A7'
  },
  patientPortalButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3A6B52',
    backgroundColor: '#152A20',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20
  },
  patientPortalButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6CE0A6'
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 8
  },
  footerNoteText: {
    fontSize: 14,
    color: '#8FA89B',
    textAlign: 'center',
    lineHeight: 20
  }
});
