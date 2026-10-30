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
  message = 'Cargando información...',
  style
}) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }, style]}>
      <ActivityIndicator size="small" color={theme.primary} />
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
            borderColor: theme.error + '30'
          }
        ]}
      >
        <Badge label="Error del sistema" variant="error" size="sm" />
        <Text style={[styles.errorTitle, { color: theme.error }]}>No se pudo completar la operación</Text>
        <Text style={[styles.errorDescription, { color: theme.text }]}>{message}</Text>
        {onRetry && (
          <Button
            title="Reintentar operación"
            onPress={onRetry}
            variant="outline"
            size="sm"
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
    <View style={[styles.emptyContainer, { borderColor: theme.borderSubtle }, style]}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      )}
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="secondary"
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      )}
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
        <Badge label="Acceso Restringido" variant="warning" size="sm" />
        <Text style={[styles.deniedTitle, { color: theme.text }]}>
          Sección no disponible para tu rol
        </Text>
        <Text style={[styles.deniedDescription, { color: theme.textSecondary }]}>
          Los permisos asignados a tu cuenta no permiten consultar ni modificar esta sección médica o administrativa.
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
    fontSize: typography.fontSize.sm,
    marginTop: spacing.md,
    fontWeight: typography.fontWeight.medium
  },
  errorBox: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1
  },
  errorTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  errorDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed
  },
  emptyContainer: {
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  deniedTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  deniedDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed
  }
});
