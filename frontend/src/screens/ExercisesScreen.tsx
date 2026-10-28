import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

export const ExercisesScreen = () => {
  const { theme } = useAppTheme();
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchExercises = async (search = '') => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const res = await apiClient.post('/exercises/search', {
        search: search || undefined
      });
      if (res.data?.success) {
        setExercises(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener catálogo de ejercicios');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  if (loading && !refreshing) return <LoadingState message="Cargando ejercicios..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchExercises(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Buscar ejercicio o grupo muscular..."
          placeholderTextColor={theme.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={() => { setLoading(true); fetchExercises(searchTerm); }}
        />
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => { setLoading(true); fetchExercises(searchTerm); }}>
          <Text style={styles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchExercises(searchTerm); }} />}
        ListEmptyComponent={<EmptyState title="Sin ejercicios encontrados" subtitle="Intenta con otro término de búsqueda" />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.header}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.category, { color: theme.primary }]}>{item.category}</Text>
            </View>
            <Text style={[styles.desc, { color: theme.textSecondary }]}>{item.description}</Text>
            <Text style={[styles.instructions, { color: theme.text }]}>Indicaciones: {item.instructions}</Text>
            {item.default_sets && (
              <Text style={[styles.badge, { color: theme.warning }]}>
                {item.default_sets} series x {item.default_repetitions || 'frecuencia indicada'} reps
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
  searchRow: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  btn: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold' },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold' },
  category: { fontSize: 12, fontWeight: 'bold' },
  desc: { fontSize: 13, marginTop: 4 },
  instructions: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  badge: { fontSize: 12, fontWeight: '600', marginTop: 6 }
});
