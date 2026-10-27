import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

export const PatientsScreen = () => {
  const { theme } = useAppTheme();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatients = async (query = '') => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST /patients/search
      const response = await apiClient.post('/patients/search', {
        search: query || undefined,
        page: 1,
        limit: 50
      });
      if (response.data?.success) {
        setPatients(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener pacientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearch = () => {
    setLoading(true);
    fetchPatients(searchTerm);
  };

  if (loading && !refreshing) return <LoadingState message="Cargando pacientes..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchPatients(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Buscar por nombre, apellido o DNI..."
          placeholderTextColor={theme.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.primary }]} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPatients(searchTerm); }} />}
        ListEmptyComponent={<EmptyState title="No se encontraron pacientes" subtitle="Prueba con otro criterio de búsqueda" />}
        renderItem={({ item }) => (
          <View style={[styles.patientCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.patientName, { color: theme.text }]}>{item.last_name}, {item.first_name}</Text>
            <Text style={[styles.patientDetail, { color: theme.textSecondary }]}>DNI: {item.dni} | Tel: {item.phone}</Text>
            {item.kinesiologist_name && (
              <Text style={[styles.kineTag, { color: theme.primary }]}>
                Kinesiólogo: {item.kinesiologist_name} {item.kinesiologist_last_name}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchContainer: { flexDirection: 'row', marginBottom: 16 },
  searchInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  searchBtn: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  searchBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  patientCard: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  patientName: { fontSize: 16, fontWeight: 'bold' },
  patientDetail: { fontSize: 13, marginTop: 4 },
  kineTag: { fontSize: 12, fontWeight: '600', marginTop: 4 }
});
