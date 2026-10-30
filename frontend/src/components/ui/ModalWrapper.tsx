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
  Platform
} from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, shadows } from '../../theme/tokens';

interface ModalWrapperProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  subHeader?: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 520,
  subHeader
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              maxWidth
            },
            shadows.modal
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
            <View style={styles.headerTitles}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
              accessibilityLabel="Cerrar modal"
            >
              <Text style={[styles.closeText, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* SubHeader opcional (pestañas o filtros fijos) */}
          {subHeader && (
            <View style={[styles.subHeader, { borderBottomColor: theme.borderSubtle, backgroundColor: theme.surface }]}>
              {subHeader}
            </View>
          )}

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {/* Footer */}
          {footer && (
            <View style={[styles.footer, { borderTopColor: theme.borderSubtle }]}>
              {footer}
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeText: {
    fontSize: 13,
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
  footer: {
    paddingHorizontal: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap'
  }
});
