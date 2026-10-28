import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, ScreenHeader, Button } from '../components/ui';
import { LoadingState, ErrorState } from '../components/FeedbackStates';

export const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const { theme } = useAppTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas con payload
      const response = await apiClient.post('/dashboard/summary', {});
      if (response.data?.success) {
        setData(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al conectar con la API');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

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

  if (loading && !refreshing) return <LoadingState message="Cargando resumen del consultorio..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;

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
        subtitle="Resumen de actividad y estado operativo del consultorio"
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
        ACTIVIDAD DE HOY
      </Text>

      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Turnos Totales</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.appointments?.total ?? 0}
          </Text>
          <Text style={[styles.metricFoot, { color: theme.textMuted }]}>
            Agenda programada hoy
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Atendidos</Text>
          <Text style={[styles.metricValue, { color: theme.primary }]}>
            {data?.appointments?.attended ?? 0}
          </Text>
          <Text style={[styles.metricFoot, { color: theme.textMuted }]}>
            Sesiones completadas
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pacientes Activos</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.totalPatients ?? 0}
          </Text>
          <Text style={[styles.metricFoot, { color: theme.textMuted }]}>
            Padrón en seguimiento
          </Text>
        </Card>

        <Card style={styles.metricCard} padding="lg">
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Tratamientos</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {data?.activeTreatments ?? 0}
          </Text>
          <Text style={[styles.metricFoot, { color: theme.textMuted }]}>
            Planes terapéuticos
          </Text>
        </Card>
      </View>

      {/* Recaudación Financiera (si el usuario tiene permisos autorizados en el backend) */}
      {data?.financial && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: spacing.lg }]}>
            COBROS Y CAJA DEL DÍA
          </Text>
          <Card elevated style={styles.financialCard} padding="xl">
            <View style={styles.financialRow}>
              <View>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Recaudación Total</Text>
                <Text style={[styles.financialAmount, { color: theme.text }]}>
                  ${Number(data.financial.totalIncome).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <Badge
                label={`${data.financial.transactionsCount} TRANSACCIONES`}
                variant="neutral"
                size="md"
              />
            </View>
            <View style={[styles.financialDivider, { backgroundColor: theme.borderSubtle }]} />
            <Text style={[styles.financialNote, { color: theme.textSecondary }]}>
              Arqueo de ingresos por caja, tarjetas, transferencias y obras sociales.
            </Text>
          </Card>
        </>
      )}

      {/* Guía Rápida de Operación */}
      <Card style={[styles.tipCard, { backgroundColor: theme.surfaceSubtle }]} padding="md">
        <Text style={[styles.tipTitle, { color: theme.text }]}>
          Gestión Profesional
        </Text>
        <Text style={[styles.tipText, { color: theme.textSecondary }]}>
          Utilice las solapas inferiores para agendar turnos atómicos, registrar pacientes y redactar notas de evolución clínica con escala EVA.
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.huge
  },
  headerAction: {
    flexDirection: 'row',
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
