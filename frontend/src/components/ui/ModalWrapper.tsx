/**
 * @file ModalWrapper.tsx
 * @description Envoltorio de modal animado y accesible con fondo oscurecido.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, shadows } from '../../theme/tokens';
import { useResponsive } from '../../theme/useResponsive';

interface ModalWrapperProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  subHeader?: React.ReactNode;
  fullScreenOnMobile?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 540,
  subHeader,
  fullScreenOnMobile = true,
  errorMessage,
  successMessage
}) => {
  const { theme } = useAppTheme();
  const { isPhone, isSmallPhone, width, height } = useResponsive();
  const insets = useSafeAreaInsets();

  const isFullScreen = isPhone && fullScreenOnMobile;

  return (
    <Modal
      visible={visible}
      animationType={isFullScreen ? 'slide' : 'fade'}
      transparent={!isFullScreen}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          isFullScreen && {
            padding: 0,
            backgroundColor: theme.background,
            justifyContent: 'flex-start'
          }
        ]}
      >
        {!isFullScreen && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        )}

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border
            },
            isFullScreen
              ? {
                  width: '100%',
                  height: '100%',
                  maxHeight: '100%',
                  borderRadius: 0,
                  borderWidth: 0,
                  paddingTop: Math.max(insets.top, 16),
                  paddingBottom: Math.max(insets.bottom, 12)
                }
              : {
                  maxWidth: Math.min(maxWidth, width - 32),
                  borderRadius: radii.xl,
                  borderWidth: 1
                },
            !isFullScreen && shadows.modal
          ]}
        >
          {/* Header Responsivo */}
          <View
            style={[
              styles.header,
              { borderBottomColor: theme.border },
              isSmallPhone && { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }
            ]}
          >
            <View style={styles.headerTitles}>
              <Text
                style={[
                  styles.title,
                  { color: theme.text },
                  isSmallPhone && { fontSize: typography.fontSize.lg }
                ]}
                numberOfLines={2}
              >
                {title}
              </Text>
              {Boolean(subtitle) && (
                <Text
                  style={[
                    styles.subtitle,
                    { color: theme.textSecondary },
                    isSmallPhone && { fontSize: typography.fontSize.xs, marginTop: 2 }
                  ]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                isSmallPhone && { minHeight: 40, paddingHorizontal: spacing.sm }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ventana"
            >
              <Text style={[styles.closeText, { color: theme.text }]}>✕ Cerrar</Text>
            </TouchableOpacity>
          </View>

          {/* SubHeader opcional (pestañas o filtros fijos) */}
          {Boolean(subHeader) && (
            <View style={[styles.subHeader, { borderBottomColor: theme.borderSubtle, backgroundColor: theme.surface }]}>
              {subHeader}
            </View>
          )}

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              isSmallPhone && { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer Responsivo con Botones de Acción y Mensajes Estratégicos debajo */}
          {Boolean(footer || errorMessage || successMessage) && (
            <View
              style={[
                styles.footerContainer,
                { borderTopColor: theme.borderSubtle },
                isSmallPhone && { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }
              ]}
            >
              {Boolean(footer) && (
                <View style={[styles.footerButtons, isSmallPhone && { gap: spacing.xs }]}>
                  {footer}
                </View>
              )}
              {errorMessage ? (
                <View
                  style={[
                    styles.footerFeedbackBanner,
                    {
                      backgroundColor: theme.errorBg || 'rgba(239, 68, 68, 0.12)',
                      borderColor: theme.error
                    }
                  ]}
                >
                  <MaterialIcons name="error-outline" size={18} color={theme.error} style={{ marginRight: 8 }} />
                  <Text style={[styles.footerFeedbackText, { color: theme.error }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}
              {successMessage ? (
                <View
                  style={[
                    styles.footerFeedbackBanner,
                    {
                      backgroundColor: theme.successBg || 'rgba(16, 185, 129, 0.12)',
                      borderColor: theme.success
                    }
                  ]}
                >
                  <MaterialIcons name="check-circle" size={18} color={theme.success} style={{ marginRight: 8 }} />
                  <Text style={[styles.footerFeedbackText, { color: theme.success }]}>
                    {successMessage}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerTitles: {
    flex: 1,
    paddingRight: spacing.md
  },
  subHeader: {
    borderBottomWidth: 1
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 4,
    lineHeight: 20
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  body: {
    flexGrow: 0,
    flexShrink: 1
  },
  bodyContent: {
    paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingVertical: spacing.md
  },
  footerContainer: {
    paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  footerFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    width: '100%'
  },
  footerFeedbackText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 18
  }
});
