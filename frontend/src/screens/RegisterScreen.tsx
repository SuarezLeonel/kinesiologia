/**
 * @file RegisterScreen.tsx
 * @description Pantalla de registro de nuevos usuarios con validaciones de formulario Zod.
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
import { DateInput, InsuranceSelector, SocialAuthButtons } from '../components/ui';

const registerSchema = z.object({
  firstName: z.string().min(2, 'Completá este campo.'),
  lastName: z.string().min(2, 'Completá este campo.'),
  email: z.string().email('Ingresá un correo válido.'),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  phone: z.string().min(6, 'Ingresá un teléfono válido.').optional().or(z.literal('')),
  dni: z.string().max(20, 'Máximo 20 caracteres.').optional().or(z.literal('')),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)').optional().or(z.literal('')),
  insuranceProvider: z.string().default('Particular'),
  customInsuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional()
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { registerPatient } = useAuth();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
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
      birthDate: '1995-01-01',
      insuranceProvider: 'Particular',
      customInsuranceProvider: '',
      insuranceNumber: ''
    }
  });

  const watchedInsuranceProvider = watch('insuranceProvider');
  const watchedCustomInsurance = watch('customInsuranceProvider');

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setSuccessInfo(null);
    const selectedIns = data.insuranceProvider || 'Particular';
    if (selectedIns === 'Otra' && (!data.customInsuranceProvider || !data.customInsuranceProvider.trim())) {
      setServerError('Por favor especifique el nombre de su obra social en la opción "Otra"');
      return;
    }
    const finalProvider = selectedIns === 'Otra' ? data.customInsuranceProvider?.trim() : selectedIns;
    const finalCoverage = finalProvider === 'Particular'
      ? 'Particular'
      : [finalProvider, data.insuranceNumber?.trim()].filter(Boolean).join(' - ');

    const result = await registerPatient({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      password: data.password,
      phone: data.phone?.trim() || undefined,
      dni: data.dni?.trim() || undefined,
      birthDate: data.birthDate?.trim() || undefined,
      insuranceProvider: finalCoverage || 'Particular',
      insuranceNumber: data.insuranceNumber?.trim() || undefined
    });

    if (!result.success) {
      setServerError(result.error || 'Error al registrar la cuenta');
    } else {
      if (navigation?.navigate) {
        navigation.navigate('VerifyEmail', { email: data.email.trim() });
      } else {
        setSuccessInfo(result.message || '¡Cuenta creada! Enviamos un enlace de verificación a tu correo.');
      }
    }
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
        {/* Cabecera con Logo Oficial y Título del Portal */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/images/logoKinesio.webp')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>
            Portal del <Text style={styles.brandTitleAccent}>Paciente</Text>
          </Text>
        </View>

        {/* Tarjeta de Registro Principal */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 14 }]}>Crear cuenta</Text>

          {/* Banner Informativo de Vinculación Automática */}
          <View style={styles.infoBanner}>
            <MaterialIcons
              name="info-outline"
              size={18}
              color="#58B988"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.infoBannerText}>
              Usá el mismo email o DNI con el que te atendiste en el consultorio para vincular tus turnos.
            </Text>
          </View>

          {serverError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          {successInfo && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{successInfo}</Text>
            </View>
          )}

          {/* Fila: Nombre y Apellido */}
          <View style={styles.row}>
            <View style={styles.col}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Nombre <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'firstName' && styles.inputBoxFocused,
                    Boolean(errors.firstName) && styles.inputBoxError
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={17}
                    color={focusedField === 'firstName' ? '#58B988' : '#60796C'}
                    style={styles.inputLeftIcon}
                  />
                  <Controller
                    control={control}
                    name="firstName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.textInputField}
                        placeholder="Juan"
                        placeholderTextColor="#8FA89B"
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('firstName')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                      />
                    )}
                  />
                </View>
                {errors.firstName && (
                  <Text style={styles.fieldErrorText}>{errors.firstName.message}</Text>
                )}
              </View>
            </View>

            <View style={styles.col}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Apellido <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'lastName' && styles.inputBoxFocused,
                    Boolean(errors.lastName) && styles.inputBoxError
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={17}
                    color={focusedField === 'lastName' ? '#58B988' : '#60796C'}
                    style={styles.inputLeftIcon}
                  />
                  <Controller
                    control={control}
                    name="lastName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.textInputField}
                        placeholder="Pérez"
                        placeholderTextColor="#8FA89B"
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('lastName')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                      />
                    )}
                  />
                </View>
                {errors.lastName && (
                  <Text style={styles.fieldErrorText}>{errors.lastName.message}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Campo Correo Electrónico */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Correo electrónico <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                focusedField === 'email' && styles.inputBoxFocused,
                Boolean(errors.email) && styles.inputBoxError
              ]}
            >
              <MaterialIcons
                name="mail-outline"
                size={18}
                color={focusedField === 'email' ? '#58B988' : '#60796C'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="juan.perez@example.com"
                    placeholderTextColor="#8FA89B"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => {
                      setFocusedField(null);
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
                focusedField === 'password' && styles.inputBoxFocused,
                Boolean(errors.password) && styles.inputBoxError
              ]}
            >
              <MaterialIcons
                name="lock-outline"
                size={18}
                color={focusedField === 'password' ? '#58B988' : '#60796C'}
                style={styles.inputLeftIcon}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.textInputField}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor="#8FA89B"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => {
                      setFocusedField(null);
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

          {/* Fila: DNI y Teléfono */}
          <View style={styles.row}>
            <View style={styles.col}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DNI / Documento</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'dni' && styles.inputBoxFocused,
                    Boolean(errors.dni) && styles.inputBoxError
                  ]}
                >
                  <Ionicons
                    name="card-outline"
                    size={17}
                    color={focusedField === 'dni' ? '#58B988' : '#60796C'}
                    style={styles.inputLeftIcon}
                  />
                  <Controller
                    control={control}
                    name="dni"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.textInputField}
                        placeholder="12345678"
                        placeholderTextColor="#8FA89B"
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('dni')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                        keyboardType="numeric"
                      />
                    )}
                  />
                </View>
                {errors.dni && (
                  <Text style={styles.fieldErrorText}>{errors.dni.message}</Text>
                )}
              </View>
            </View>

            <View style={styles.col}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Teléfono / Celular</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'phone' && styles.inputBoxFocused,
                    Boolean(errors.phone) && styles.inputBoxError
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={17}
                    color={focusedField === 'phone' ? '#58B988' : '#60796C'}
                    style={styles.inputLeftIcon}
                  />
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.textInputField}
                        placeholder="+54 9 11..."
                        placeholderTextColor="#8FA89B"
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                        keyboardType="phone-pad"
                      />
                    )}
                  />
                </View>
                {errors.phone && (
                  <Text style={styles.fieldErrorText}>{errors.phone.message}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Fecha de Nacimiento */}
          <View style={styles.fieldGroup}>
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
          </View>

          {/* Obra Social / Cobertura */}
          <View style={styles.fieldGroup}>
            <Controller
              control={control}
              name="insuranceProvider"
              render={({ field: { onChange, value } }) => (
                <InsuranceSelector
                  label="Obra social / Cobertura"
                  value={value || 'Particular'}
                  onChange={onChange}
                  customValue={watchedCustomInsurance || ''}
                  onChangeCustom={(val) => setValue('customInsuranceProvider', val)}
                  error={errors.insuranceProvider?.message}
                />
              )}
            />
          </View>

          {/* Número de afiliado / credencial si no es Particular */}
          {watchedInsuranceProvider && watchedInsuranceProvider !== 'Particular' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>N° de afiliado / Credencial (opcional)</Text>
              <Controller
                control={control}
                name="insuranceNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.inputBox, focusedField === 'insuranceNumber' && styles.inputBoxFocused]}>
                    <MaterialIcons name="badge" size={20} color="#7E978A" style={styles.inputLeftIcon} />
                    <TextInput
                      style={styles.textInputField}
                      placeholder="Ej: 1234567801"
                      placeholderTextColor="#5A7367"
                      value={value || ''}
                      onChangeText={onChange}
                      onBlur={() => {
                        onBlur();
                        setFocusedField(null);
                      }}
                      onFocus={() => setFocusedField('insuranceNumber')}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              />
            </View>
          )}

          {/* Botón Principal: Crear mi cuenta de Paciente */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSubmit(onSubmit)()}
            disabled={isSubmitting}
            style={styles.submitButton}
            accessibilityRole="button"
            accessibilityLabel="Crear mi cuenta de Paciente"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0E241A" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Crear cuenta</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#0E241A" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Separador: Cuentas Externas */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continuar con</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botones Sociales con Diseño Oscuro y Logotipos Oficiales */}
          <SocialAuthButtons
            mode="register"
            onError={setServerError}
            initialProfileData={{
              firstName: watch('firstName'),
              lastName: watch('lastName'),
              dni: watch('dni'),
              phone: watch('phone'),
              birthDate: watch('birthDate'),
              insuranceProvider: watch('insuranceProvider'),
              customInsuranceProvider: watchedCustomInsurance,
              insuranceNumber: watch('insuranceNumber')
            }}
          />

          {/* Pie: ¿Ya tenés cuenta? */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Ya tenés una cuenta? </Text>
            <TouchableOpacity
              onPress={() => navigation?.navigate('Login')}
              style={styles.footerLinkBtn}
              accessibilityRole="button"
              accessibilityLabel="Iniciá sesión aquí"
            >
              <Text style={styles.linkText}>Iniciá sesión aquí</Text>
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
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 24
  },
  card: {
    width: '100%',
    maxWidth: 560,
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
    marginBottom: 16
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 224, 166, 0.12)',
    borderWidth: 1.5,
    borderColor: '#2E5B45',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18
  },
  infoBannerText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#D5E5DC'
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
  successBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(108, 224, 166, 0.18)',
    borderWidth: 1.5,
    borderColor: '#6CE0A6',
    marginBottom: 16
  },
  successBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A7F3D0'
  },
  row: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Platform.OS === 'web' ? 14 : 0
  },
  col: {
    flex: 1
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
  submitButton: {
    minHeight: 54,
    backgroundColor: '#6CE0A6',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
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
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 8
  },
  footerText: {
    fontSize: 17,
    color: '#B2C9BC'
  },
  footerLinkBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  linkText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6CE0A6'
  }
});
