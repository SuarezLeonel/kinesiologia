/**
 * @file DashboardScreen.tsx
 * @description Pantalla principal de resumen diario: turnos del día y bloque de caja modular según rol.
 * Adaptada responsive integral: Mobile First, métricas en 1, 2 o 4 columnas, y contenedor centrado.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import { spacing, typography, radii } from '../theme/tokens';
import { Card, Badge, ScreenHeader, Button } from '../components/ui';
import { LoadingState, ErrorState } from '../components/FeedbackStates';

export const DashboardScreen = () => {
  const { user, logout, isAdmin, isReceptionist } = useAuth();
  const navigation = useNavigation<any>();
  const { scopeVersions } = useDataSync();
  const { theme } = useAppTheme();
  const { isPhone, isSmallPhone, isDesktop, contentMaxWidth } = useResponsive();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [vacationAlerts, setVacationAlerts] = useState<any[]>([]);

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: POST para consultas con payload
      const [response, alertsRes] = await Promise.all([
        apiClient.post('/dashboard/summary', {}),
        (isAdmin || isReceptionist) ? apiClient.post('/vacations/alerts', {}) : Promise.resolve({ data: { data: [] } })
      ]);

      if (response.data?.success) {
        setData(response.data.data);
        setError(null);
      }

      if (alertsRes?.data?.data) {
        setVacationAlerts(Array.isArray(alertsRes.data.data) ? alertsRes.data.data : []);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.response?.data?.error?.message || 'Error al conectar con la API');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isReceptionist]);

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

  // Ancho flexible de tarjetas métricas según dispositivo
  const metricBasis = isSmallPhone ? '100%' : isDesktop ? '23.5%' : '48%';
  const horizontalPadding = isSmallPhone ? spacing.sm : isPhone ? spacing.md : spacing.xl;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: horizontalPadding,
          paddingVertical: isPhone ? spacing.md : spacing.xl
        }
      ]}
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
      <View style={[styles.innerWrapper, { maxWidth: contentMaxWidth }]}>
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

        {/* Banner de alerta de vacaciones con turnos afectados para Recepción y Admin */}
        {(isAdmin || isReceptionist) && vacationAlerts.length > 0 && (
          <View style={styles.vacationAlertsContainer}>
            {vacationAlerts.map((al) => {
              const kineFullName = `Lic. ${al.kinesiologist_last_name || ''}, ${al.kinesiologist_name || ''}`.trim();
              const startFmt = al.start_date || al.startDate;
              const endFmt = al.end_date || al.endDate;
              const pendingCount = al.pending_affected_count || al.pendingAffectedCount || 0;

              return (
                <View
                  key={al.id}
                  style={[
                    styles.vacationAlertCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.warning || '#F59E0B'
                    }
                  ]}
                >
                  <View style={styles.vacationAlertHeader}>
                    <View style={[styles.vacationAlertIconBadge, { backgroundColor: (theme.warning || '#F59E0B') + '20' }]}>
                      <MaterialIcons name="warning" size={22} color={theme.warning || '#F59E0B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vacationAlertTitle, { color: theme.text }]}>
                        Atención en agenda: Reorganización requerida ({pendingCount} {pendingCount === 1 ? 'turno' : 'turnos'})
                      </Text>
                      <Text style={[styles.vacationAlertMessage, { color: theme.textSecondary }]}>
                        El kinesiólogo <Text style={{ fontWeight: typography.fontWeight.bold, color: theme.text }}>{kineFullName}</Text> estará de vacaciones desde el <Text style={{ fontWeight: typography.fontWeight.semibold }}>{startFmt}</Text> hasta el <Text style={{ fontWeight: typography.fontWeight.semibold }}>{endFmt}</Text>. Tiene turnos asignados durante este período que necesitan ser reorganizados. Por favor, seleccioná nuevamente el horario y profesional correspondiente.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.vacationAlertActionRow, { borderTopColor: theme.border }]}>
                    <Button
                      title="Reorganizar turnos ahora"
                      variant="primary"
                      size="sm"
                      onPress={() => navigation.navigate('Vacations')}
                      icon={<MaterialIcons name="shuffle" size={16} color="#FFFFFF" />}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Métricas Principales */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          HOY
        </Text>

        <View style={styles.metricsGrid}>
          <Card style={[styles.metricCard, { flexBasis: metricBasis }]} padding="lg">
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Turnos de hoy</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {data?.appointments?.total ?? 0}
            </Text>
          </Card>

          <Card style={[styles.metricCard, { flexBasis: metricBasis }]} padding="lg">
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Atendidos</Text>
            <Text style={[styles.metricValue, { color: theme.primary }]}>
              {data?.appointments?.attended ?? 0}
            </Text>
          </Card>

          <Card style={[styles.metricCard, { flexBasis: metricBasis }]} padding="lg">
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pacientes activos</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {data?.totalPatients ?? 0}
            </Text>
          </Card>

          <Card style={[styles.metricCard, { flexBasis: metricBasis }]} padding="lg">
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
              <View style={[styles.financialRow, isSmallPhone && { flexDirection: 'column', gap: spacing.sm }]}>
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingBottom: spacing.huge
  },
  innerWrapper: {
    width: '100%',
    alignSelf: 'center'
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs
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
  vacationAlertsContainer: {
    marginBottom: spacing.lg
  },
  vacationAlertCard: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  vacationAlertHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  vacationAlertIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  vacationAlertTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  vacationAlertMessage: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  vacationAlertActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1
  }
});
