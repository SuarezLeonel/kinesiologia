/**
 * @file VerifyEmailScreen.tsx
 * @description Pantalla de confirmación y verificación obligatoria de correo electrónico.
 * Muestra el estado de espera tras el registro, gestión de reenvío con temporizador de enfriamiento,
 * y validación directa mediante token para activación de cuenta (OWASP ASVS V3.8).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, typography, radii } from '../theme/tokens';

interface VerifyEmailScreenProps {
  navigation: any;
  route?: {
    params?: {
      email?: string;
      token?: string;
    };
  };
}

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ navigation, route }) => {
  const { resendVerificationEmail, verifyEmailToken } = useAuth();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const emailParam = route?.params?.email || '';
  const tokenParam = route?.params?.token || '';

  const [email] = useState<string>(emailParam);
  const [token] = useState<string>(tokenParam);
  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(tokenParam));
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Manejo de temporizador de enfriamiento para reenvío (60 segundos)
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Si se suministró un token por parámetro (deep link o redirección), verificar inmediatamente
  useEffect(() => {
    if (token) {
      let isMounted = true;
      (async () => {
        setIsVerifying(true);
        const result = await verifyEmailToken(token);
        if (isMounted) {
          setIsVerifying(false);
          if (result.success) {
            setIsVerified(true);
            setFeedback({
              type: 'success',
              message: result.message || '¡Tu cuenta fue verificada con éxito!'
            });
          } else {
            setFeedback({
              type: 'error',
              message: result.error || 'El enlace de verificación es inválido o ha expirado.'
            });
          }
        }
      })();
      return () => { isMounted = false; };
    }
  }, [token]);

  const handleResend = async () => {
    if (!email) {
      setFeedback({
        type: 'error',
        message: 'No se especificó una dirección de correo para el reenvío.'
      });
      return;
    }
    if (resendCooldown > 0) return;

    setIsResending(true);
    setFeedback(null);

    const result = await resendVerificationEmail(email);
    setIsResending(false);

    if (result.success) {
      setResendCooldown(60);
      setFeedback({
        type: 'success',
        message: result.message || 'Enviamos un nuevo enlace a tu casilla de correo.'
      });
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'No se pudo enviar el correo de verificación. Reintenta en unos instantes.'
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Siluetas orgánicas botánicas de fondo */}
      <View style={styles.bgLeafTopRight} pointerEvents="none" />
      <View style={styles.bgLeafTopLeft} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24) + spacing.lg,
            paddingBottom: Math.max(insets.bottom, 24) + spacing.xl,
            paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera con Logo Oficial */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/images/logoKinesio.webp')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>KinesioGestión</Text>
        </View>

        {/* Tarjeta de Verificación */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {isVerifying ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.title, { color: theme.text, marginTop: spacing.md }]}>
                Verificando cuenta...
              </Text>
            </View>
          ) : isVerified ? (
            /* Pantalla: ¡Tu cuenta fue verificada! */
            <View style={styles.statusBox}>
              <View style={[styles.iconBadge, { backgroundColor: '#E6FFFA', borderColor: '#99F6E4' }]}>
                <MaterialIcons name="verified-user" size={44} color="#0D9488" />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Cuenta verificada</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Ya podés iniciar sesión.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Pantalla: ¡Revisá tu correo electrónico! */
            <View style={styles.statusBox}>
              <View style={[styles.iconBadge, { backgroundColor: '#E8F0EC', borderColor: '#C4D9CD' }]}>
                <MaterialIcons name="mark-email-unread" size={44} color="#537C68" />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Revisá tu correo</Text>

              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Enviamos un enlace de verificación a:
              </Text>

              {Boolean(email) && (
                <View style={styles.emailBadge}>
                  <MaterialIcons name="mail-outline" size={16} color="#0D9488" style={{ marginRight: 6 }} />
                  <Text style={styles.emailText}>{email}</Text>
                </View>
              )}

              <Text style={[styles.instructions, { color: theme.textSecondary }]}>
                Abrí el correo y tocá{' '}
                <Text style={{ fontWeight: '700', color: theme.text }}>«Verificar mi cuenta»</Text>.
              </Text>

              <View style={styles.noticeBox}>
                <MaterialIcons name="schedule" size={16} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.noticeText}>
                  El enlace vence en <Text style={{ fontWeight: '700' }}>30 minutos</Text>. Revisá también spam.
                </Text>
              </View>

              {/* Mensajes inline de feedback (sin alert) */}
              {feedback && (
                <View
                  style={[
                    styles.feedbackBanner,
                    feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
                  ]}
                >
                  <MaterialIcons
                    name={feedback.type === 'success' ? 'check-circle' : 'error-outline'}
                    size={18}
                    color={feedback.type === 'success' ? '#0F766E' : '#B91C1C'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      { color: feedback.type === 'success' ? '#0F766E' : '#B91C1C' }
                    ]}
                  >
                    {feedback.message}
                  </Text>
                </View>
              )}

              {/* Botón Reenviar Correo con Cooldown */}
              <TouchableOpacity
                style={[
                  styles.resendButton,
                  resendCooldown > 0 && styles.resendButtonDisabled
                ]}
                onPress={handleResend}
                disabled={isResending || resendCooldown > 0}
                activeOpacity={0.8}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color="#0D9488" />
                ) : (
                  <>
                    <MaterialIcons
                      name="refresh"
                      size={18}
                      color={resendCooldown > 0 ? '#94A3B8' : '#0D9488'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.resendButtonText,
                        resendCooldown > 0 && styles.resendButtonTextDisabled
                      ]}
                    >
                      {resendCooldown > 0
                        ? `Reenviar correo (${resendCooldown}s)`
                        : 'Reenviar correo de verificación'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Enlace para volver a Iniciar Sesión */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={16} color={theme.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>
                  Volver al inicio de sesión
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bgLeafTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(83, 124, 104, 0.08)'
  },
  bgLeafTopLeft: {
    position: 'absolute',
    top: 100,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(83, 124, 104, 0.04)'
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  logoCard: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  logoImage: {
    width: 56,
    height: 56
  },
  brandTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3
  },
  brandSubtitle: {
    fontSize: typography.fontSize.md,
    marginTop: 2
  },
  card: {
    width: '100%',
    maxWidth: 500,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4
  },
  statusBox: {
    alignItems: 'center'
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  description: {
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.sm
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: '#99F6E4'
  },
  emailText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#0F766E'
  },
  instructions: {
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.md
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radii.md,
    padding: 14,
    marginBottom: spacing.lg,
    width: '100%'
  },
  noticeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: '#334155',
    lineHeight: 22
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    width: '100%'
  },
  feedbackSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC'
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5'
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 22
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: radii.md,
    marginTop: spacing.md
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: '#E6FFFA',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    marginBottom: spacing.md
  },
  resendButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1'
  },
  resendButtonText: {
    color: '#0F766E',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold
  },
  resendButtonTextDisabled: {
    color: '#64748B'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  }
});
