import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

export const PaymentsScreen = () => {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Kinesiólogo no tiene acceso a caja y cobros administrativos
  if (user?.role === 'kinesiologist') {
    return <AccessDeniedState />;
  }

  const fetchPayments = async () => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const res = await apiClient.post('/payments/search', {
        page: 1,
        limit: 50
      });
      if (res.data?.success) {
        setPayments(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener transacciones de cobros');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  if (loading && !refreshing) return <LoadingState message="Cargando cobros y pagos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPayments} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
        ListEmptyComponent={<EmptyState title="Sin registros de cobros" subtitle="No se han registrado pagos hoy" />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.header}>
              <Text style={[styles.patient, { color: theme.text }]}>
                {item.patient_last_name}, {item.patient_first_name}
              </Text>
              <Text style={[styles.amount, { color: theme.success }]}>
                ${Number(item.amount).toLocaleString('es-AR')}
              </Text>
            </View>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              Método: {item.payment_method.toUpperCase()} | Moneda: {item.currency}
            </Text>
            <Text style={[styles.recorded, { color: theme.primary }]}>
              Registrado por: {item.recorded_by_name} {item.recorded_by_last_name}
            </Text>
            <Text style={[styles.date, { color: theme.textSecondary }]}>
              {new Date(item.payment_date).toLocaleString('es-AR')}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: 'bold' },
  amount: { fontSize: 18, fontWeight: 'bold' },
  detail: { fontSize: 13, marginTop: 4 },
  recorded: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  date: { fontSize: 11, marginTop: 4 }
});
