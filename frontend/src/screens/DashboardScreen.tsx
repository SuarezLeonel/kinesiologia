/**
 * @file DashboardScreen.tsx
 * @description Pantalla principal de resumen diario: turnos del día y bloque de caja modular según rol.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, ScreenHeader, Button } from '../components/ui';
import { LoadingState, ErrorState } from '../components/FeedbackStates';

export const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const { scopeVersions } = useDataSync();
  const { theme } = useAppTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: POST para consultas con payload
      const response = await apiClient.post('/dashboard/summary', {});
      if (response.data?.success) {
        setData(response.data.data);
        setError(null);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.response?.data?.error?.message || 'Error al conectar con la API');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  useEffect(() => {
    if (scopeVersions.dashboard > 0) {
      fetchDashboard(true);
    }
  }, [scopeVersions.dashboard, fetchDashboard]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard(true);
    }, [fetchDashboard])
  );

  const getRoleVariant = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'warning';
      case 'kinesiologo':
        return 'success';
      case 'recepcionista':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading && !refreshing && !data) return <LoadingState message="Cargando..." />;
  if (error && !data) return <ErrorState message={error} onRetry={() => fetchDashboard(false)} />;

  const roleName = user?.role || user?.role_name || 'profesional';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchDashboard();
          }}
          tintColor={theme.primary}
        />
      }
    >
      <ScreenHeader
        title={`Hola, ${user?.name || 'Profesional'}`}
        subtitle="Resumen del día"
        action={
          <View style={styles.headerAction}>
            <Badge
              label={roleName.toUpperCase()}
              variant={getRoleVariant(roleName)}
              size="sm"
            />
            <Button
              title="Salir"
              variant="ghost"
              size="sm"
              onPress={logout}
              style={{ marginLeft: spacing.sm }}
            />
          </View>
        }
      />

      {/* Métricas Principales */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        HOY
      </Text>

      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Turnos de hoy</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.appointments?.total ?? 0}
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Atendidos</Text>
          <Text style={[styles.metricValue, { color: theme.primary }]}>
            {data?.appointments?.attended ?? 0}
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pacientes activos</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.totalPatients ?? 0}
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Tratamientos</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.activeTreatments ?? 0}
          </Text>
        </Card>
      </View>

      {/* Recaudación Financiera (si el usuario tiene permisos autorizados en el backend) */}
      {data?.financial && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: spacing.lg }]}>
              CAJA DE HOY
            </Text>
            {data?.date ? (
              <Badge
                label={new Date(`${data.date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                variant="neutral"
                size="sm"
                style={{ marginTop: spacing.lg }}
              />
            ) : null}
          </View>
          <Card elevated style={styles.financialCard} padding="xl">
            <View style={styles.financialRow}>
              <View>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Recaudación de hoy</Text>
                <Text style={[styles.financialAmount, { color: theme.text }]}>
                  ${Number(data.financial.totalIncome).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <Badge
                label={`${data.financial.transactionsCount} ${data.financial.transactionsCount === 1 ? 'cobro' : 'cobros'}`}
                variant={Number(data.financial.transactionsCount) > 0 ? 'success' : 'neutral'}
                size="md"
              />
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingBottom: spacing.huge
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: spacing.md
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs
  },
  metricValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.5,
    marginVertical: 2
  },
  metricFoot: {
    fontSize: typography.fontSize.tiny,
    marginTop: spacing.xs
  },
  financialCard: {
    marginTop: spacing.xs
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  financialAmount: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.8,
    marginTop: spacing.xs
  },
  financialDivider: {
    height: 1,
    marginVertical: spacing.md
  },
  financialNote: {
    fontSize: typography.fontSize.xs
  },
  tipCard: {
    marginTop: spacing.xxl
  },
  tipTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2
  },
  tipText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  }
});
