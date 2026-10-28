import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
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

  if (loading) return <LoadingState message="Cargando resumen del día..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcome, { color: theme.textSecondary }]}>Bienvenido/a,</Text>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.name} {user?.lastName || user?.last_name || ''}</Text>
          <Text style={[styles.roleBadge, { color: theme.primary }]}>Rol: {(user?.role || user?.role_name || 'USUARIO').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.border }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: theme.error }]}>Salir</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Métricas de Hoy</Text>
      <View style={styles.grid}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.primary }]}>{data?.appointments?.total || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Turnos Totales</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.success }]}>{data?.appointments?.attended || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Atendidos</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.text }]}>{data?.totalPatients || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Pacientes Activos</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.metricValue, { color: theme.warning }]}>{data?.activeTreatments || 0}</Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Tratamientos Activos</Text>
        </View>
      </View>

      {/* Finanzas solo mostradas si el backend autorizó devolver datos financieros */}
      {data?.financial && (
        <View style={[styles.financialCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.financialTitle, { color: theme.text }]}>Recaudación del Día</Text>
          <Text style={[styles.financialAmount, { color: theme.primary }]}>
            ${Number(data.financial.totalIncome).toLocaleString('es-AR')}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            {data.financial.transactionsCount} operaciones registradas
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcome: { fontSize: 13 },
  userName: { fontSize: 20, fontWeight: 'bold' },
  roleBadge: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  logoutText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  metricValue: { fontSize: 24, fontWeight: 'bold' },
  metricLabel: { fontSize: 13, marginTop: 4 },
  financialCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  financialTitle: { fontSize: 16, fontWeight: 'bold' },
  financialAmount: { fontSize: 24, fontWeight: 'bold', marginVertical: 6 }
});
