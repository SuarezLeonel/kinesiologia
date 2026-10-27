import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

export const ClinicalRecordsScreen = () => {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const [patientId, setPatientId] = useState('1');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La recepcionista no tiene acceso a historias clínicas (seguridad autorizada en backend)
  if (user?.role === 'receptionist') {
    return <AccessDeniedState />;
  }

  const fetchRecords = async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      setError(null);
      // REGLA HTTP ESTRICTA: POST /clinical-records/search
      const response = await apiClient.post('/clinical-records/search', {
        patientId: Number(patientId)
      });
      if (response.data?.success) {
        setRecords(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="ID de Paciente (ej: 1)"
          placeholderTextColor={theme.textSecondary}
          value={patientId}
          onChangeText={setPatientId}
          keyboardType="numeric"
        />
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={fetchRecords}>
          <Text style={styles.btnText}>Ver Ficha</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Consultando historias clínicas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRecords} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<EmptyState title="Sin registros clínicos" subtitle="Este paciente no posee notas clínicas aún" />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.diagnosis, { color: theme.text }]}>Diagnóstico: {item.diagnosis}</Text>
                {item.reported_pain_level !== null && (
                  <Text style={[styles.painBadge, { color: theme.warning }]}>Dolor: {item.reported_pain_level}/10</Text>
                )}
              </View>
              <Text style={[styles.reason, { color: theme.textSecondary }]}>Motivo: {item.consultation_reason}</Text>
              <Text style={[styles.author, { color: theme.primary }]}>
                Profesional: {item.author_name} {item.author_last_name}
              </Text>
              <Text style={[styles.date, { color: theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleDateString('es-AR')}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchRow: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  btn: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold' },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diagnosis: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  painBadge: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  reason: { fontSize: 14, marginTop: 6 },
  author: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  date: { fontSize: 11, marginTop: 4 }
});
