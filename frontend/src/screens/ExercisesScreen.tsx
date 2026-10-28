import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl
} from 'react-native';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, BadgeVariant } from '../components/ui';
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

  const handleSearch = () => {
    setLoading(true);
    fetchExercises(searchTerm);
  };

  const getDifficultyVariant = (diff?: string): BadgeVariant => {
    const d = String(diff || '').toLowerCase();
    switch (d) {
      case 'bajo':
        return 'success';
      case 'moderado':
        return 'warning';
      case 'avanzado':
        return 'error';
      default:
        return 'neutral';
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando catálogo terapéutico..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchExercises(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Catálogo de Ejercicios"
        subtitle="Protocolos de rehabilitación, movilidad y fortalecimiento"
      />

      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Input
            placeholder="Buscar por nombre, zona muscular o categoría..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Buscar"
          variant="secondary"
          size="md"
          onPress={handleSearch}
          style={{ marginLeft: spacing.sm }}
        />
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchExercises(searchTerm);
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin ejercicios encontrados"
            subtitle="Intenta con otro término de búsqueda o limpia el filtro."
          />
        }
        renderItem={({ item }) => (
          <Card elevated style={styles.exerciseCard} padding="lg">
            <View style={styles.cardHeader}>
              <View style={styles.titleCol}>
                <Text style={[styles.exerciseName, { color: theme.text }]}>{item.name}</Text>
                <View style={styles.badgeRow}>
                  {item.category && (
                    <Badge
                      label={item.category}
                      variant="default"
                      size="sm"
                    />
                  )}
                  {item.target_body_part && (
                    <Badge
                      label={item.target_body_part}
                      variant="neutral"
                      size="sm"
                    />
                  )}
                  {item.difficulty && (
                    <Badge
                      label={item.difficulty}
                      variant={getDifficultyVariant(item.difficulty)}
                      size="sm"
                    />
                  )}
                </View>
              </View>
            </View>

            {item.description ? (
              <Text style={[styles.descText, { color: theme.textSecondary }]}>
                {item.description}
              </Text>
            ) : null}

            {item.instructions ? (
              <View style={[styles.instructionsBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Text style={[styles.instructionsLabel, { color: theme.primary }]}>
                  Indicaciones técnicas:
                </Text>
                <Text style={[styles.instructionsText, { color: theme.text }]}>
                  {item.instructions}
                </Text>
              </View>
            ) : null}

            {(item.default_sets || item.default_reps || item.default_hold_seconds) && (
              <View style={styles.doseRow}>
                <Text style={[styles.doseText, { color: theme.textSecondary }]}>
                  Pauta sugerida:{' '}
                  <Text style={{ fontWeight: typography.fontWeight.bold, color: theme.text }}>
                    {item.default_sets ? `${item.default_sets} series` : ''}
                    {item.default_reps ? ` × ${item.default_reps} reps` : ''}
                    {item.default_hold_seconds ? ` (${item.default_hold_seconds}s de sostén)` : ''}
                  </Text>
                </Text>
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  searchInputContainer: {
    flex: 1
  },
  exerciseCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  titleCol: {
    flex: 1
  },
  exerciseName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs + 2
  },
  descText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.xs
  },
  instructionsBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md
  },
  instructionsLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  instructionsText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  doseRow: {
    marginTop: spacing.md,
    paddingTop: spacing.xs
  },
  doseText: {
    fontSize: typography.fontSize.xs
  }
});
