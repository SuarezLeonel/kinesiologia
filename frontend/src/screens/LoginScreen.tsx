import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginScreen = () => {
  const { login } = useAuth();
  const { theme } = useAppTheme();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Consultorio Kinesiología</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestión de Pacientes y Turnos</Text>

        {serverError && (
          <View style={[styles.errorBanner, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
            <Text style={[styles.errorBannerText, { color: theme.error }]}>{serverError}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>Correo electrónico</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, { borderColor: errors.email ? theme.error : theme.border, color: theme.text }]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="ejemplo@kinesiologia.com"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}
        />
        {errors.email && <Text style={[styles.fieldError, { color: theme.error }]}>{errors.email.message}</Text>}

        <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>Contraseña</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, { borderColor: errors.password ? theme.error : theme.border, color: theme.text }]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="••••••••"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
            />
          )}
        />
        {errors.password && <Text style={[styles.fieldError, { color: theme.error }]}>{errors.password.message}</Text>}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => handleSubmit(onSubmit)()}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 24, borderRadius: 16, borderWidth: 1, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
  fieldError: { fontSize: 12, marginTop: 4 },
  errorBanner: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
  errorBannerText: { fontSize: 13, fontWeight: '500' },
  button: { height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
