import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Cargando información...' }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.text, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
};

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.errorTitle, { color: theme.error }]}>Ocurrió un problema</Text>
      <Text style={[styles.text, { color: theme.textSecondary }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={onRetry}>
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export const EmptyState: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.text, { color: theme.textSecondary }]}>{subtitle}</Text>}
    </View>
  );
};

export const AccessDeniedState: React.FC = () => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={[styles.errorTitle, { color: theme.error }]}>Acceso Denegado</Text>
      <Text style={[styles.text, { color: theme.textSecondary }]}>
        No tienes los permisos requeridos para acceder a esta sección clínica o administrativa.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  text: {
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14
  }
});
