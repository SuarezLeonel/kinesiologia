/**
 * @file FeedbackStates.tsx
 * @description Componentes de feedback visual accesibles para estados de carga, vacío y error (reemplazo de alert).
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export const LoadingState: React.FC<{ message?: string; style?: StyleProp<ViewStyle> }> = ({
  message = 'Cargando...',
  style
}) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }, style]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
};

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ message, onRetry, style }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }, style]}>
      <View
        style={[
          styles.errorBox,
          {
            backgroundColor: theme.errorBg,
            borderColor: theme.error
          }
        ]}
      >
        <Text style={[styles.errorTitle, { color: theme.error }]}>No se pudo completar la acción</Text>
        <Text style={[styles.errorDescription, { color: theme.text }]}>{message}</Text>
        {typeof onRetry === 'function' && (
          <Button
            title="Reintentar"
            onPress={onRetry}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        )}
      </View>
    </View>
  );
};

export const EmptyState: React.FC<{
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}> = ({ title, subtitle, action, style }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.emptyContainer, { borderColor: theme.border, backgroundColor: theme.surface }, style]}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {Boolean(subtitle) && (
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      )}
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="primary"
          size="md"
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
};

export const AccessDeniedState: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }, style]}>
      <View
        style={[
          styles.errorBox,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border
          }
        ]}
      >
        <Badge label="Acceso restringido" variant="warning" size="md" />
        <Text style={[styles.deniedTitle, { color: theme.text }]}>
          Sin permisos
        </Text>
        <Text style={[styles.deniedDescription, { color: theme.textSecondary }]}>
          No tenés permisos para acceder a esta sección.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    marginTop: spacing.md,
    fontWeight: typography.fontWeight.medium
  },
  errorBox: {
    width: '100%',
    maxWidth: 520,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1.5
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  errorDescription: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.fontSize.md * typography.lineHeight.relaxed
  },
  emptyContainer: {
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  deniedTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  deniedDescription: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.fontSize.md * typography.lineHeight.relaxed
  }
});
