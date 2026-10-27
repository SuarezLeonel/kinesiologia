import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

export const AppointmentsScreen = () => {
  const { theme } = useAppTheme();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointments = async () => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST /appointments/search
      const response = await apiClient.post('/appointments/search', {
        page: 1,
        limit: 50
      });
      if (response.data?.success) {
        setAppointments(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener la agenda de turnos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'attended': return theme.success;
      case 'confirmed': return theme.primary;
      case 'cancelled': return theme.error;
      case 'absent': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando agenda de turnos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAppointments} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} />}
        ListEmptyComponent={<EmptyState title="No hay turnos programados" subtitle="Todos los horarios se encuentran disponibles" />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.patient, { color: theme.text }]}>
                {item.patient_last_name}, {item.patient_first_name}
              </Text>
              <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.service, { color: theme.primary }]}>{item.service_name}</Text>
            <Text style={[styles.time, { color: theme.textSecondary }]}>
              {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={[styles.kine, { color: theme.textSecondary }]}>
              Kinesiólogo: {item.kinesiologist_name} {item.kinesiologist_last_name}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { fontSize: 12, fontWeight: 'bold' },
  service: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  time: { fontSize: 13, marginTop: 4 },
  kine: { fontSize: 12, marginTop: 2 }
});
