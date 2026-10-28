import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, BadgeVariant } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

const exerciseSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  category: z.string().min(2, 'La categoría debe tener al menos 2 caracteres'),
  description: z.string().min(2, 'La descripción debe tener al menos 2 caracteres'),
  instructions: z.string().min(2, 'Las instrucciones deben tener al menos 2 caracteres'),
  defaultSets: z.coerce.number().int().positive('Debe ser mayor a 0').optional().or(z.literal(0)),
  defaultRepetitions: z.coerce.number().int().positive('Debe ser mayor a 0').optional().or(z.literal(0))
});

type ExerciseFormData = z.infer<typeof exerciseSchema>;

export const ExercisesScreen = () => {
  const { theme } = useAppTheme();
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ExerciseFormData>({
    resolver: zodResolver(exerciseSchema) as any,
    defaultValues: {
      name: '',
      category: 'Movilidad',
      description: '',
      instructions: '',
      defaultSets: 3,
      defaultRepetitions: 10
    }
  });

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

  const onCreateExercise = async (data: ExerciseFormData) => {
    setFormError(null);
    try {
      const payload = {
        name: data.name.trim(),
        category: data.category.trim(),
        description: data.description.trim(),
        instructions: data.instructions.trim(),
        defaultSets: data.defaultSets ? Number(data.defaultSets) : undefined,
        defaultRepetitions: data.defaultRepetitions ? Number(data.defaultRepetitions) : undefined
      };
      const res = await apiClient.post('/exercises', payload);
      if (res.data?.success) {
        setModalVisible(false);
        reset();
        fetchExercises(searchTerm);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar el ejercicio');
    }
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
        action={
          <Button
            title="+ Nuevo Ejercicio"
            onPress={() => {
              setFormError(null);
              reset({
                name: '',
                category: 'Movilidad',
                description: '',
                instructions: '',
                defaultSets: 3,
                defaultRepetitions: 10
              });
              setModalVisible(true);
            }}
            size="sm"
          />
        }
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
            subtitle="Intenta con otro término de búsqueda o registra un nuevo ejercicio."
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
                      style={{ marginRight: spacing.xs }}
                    />
                  )}
                  {item.target_muscle_zone && (
                    <Badge
                      label={item.target_muscle_zone}
                      variant="info"
                      size="sm"
                      style={{ marginRight: spacing.xs }}
                    />
                  )}
                  {item.difficulty_level && (
                    <Badge
                      label={`Nivel: ${item.difficulty_level}`}
                      variant={getDifficultyVariant(item.difficulty_level)}
                      size="sm"
                    />
                  )}
                </View>
              </View>
            </View>

            {item.description ? (
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {item.description}
              </Text>
            ) : null}

            {item.instructions ? (
              <View style={[styles.instructionsBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.instructionsLabel, { color: theme.textSecondary }]}>
                  Indicaciones técnicas:
                </Text>
                <Text style={[styles.instructionsText, { color: theme.text }]}>
                  {item.instructions}
                </Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Series:</Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {item.default_sets || item.defaultSets || 3}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Reps:</Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {item.default_repetitions || item.defaultRepetitions || 10}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        )}
        contentContainerStyle={styles.listContent}
      />

      {/* Modal para Crear Ejercicio */}
      <ModalWrapper
        visible={modalVisible}
        title="Nuevo Ejercicio Terapéutico"
        onClose={() => setModalVisible(false)}
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar Ejercicio"
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onCreateExercise)()}
            />
          </>
        }
      >
        {formError && (
          <View style={[styles.formErrorBox, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <MaterialIcons name="error-outline" size={18} color={theme.error} style={{ marginRight: spacing.xs }} />
            <Text style={[styles.formErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Nombre del ejercicio"
              value={value}
              onChangeText={onChange}
              placeholder="Ej: Puente de glúteos con banda"
              error={formErrors.name?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Categoría o tipo"
              value={value}
              onChangeText={onChange}
              placeholder="Movilidad / Fortalecimiento / Estiramiento / Lumbar"
              error={formErrors.category?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Descripción del objetivo terapéutico"
              value={value}
              onChangeText={onChange}
              placeholder="Objetivo, articulaciones involucradas y precauciones"
              multiline
              numberOfLines={2}
              error={formErrors.description?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="instructions"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Instrucciones paso a paso"
              value={value}
              onChangeText={onChange}
              placeholder="Postura inicial, ejecución del movimiento y respiración"
              multiline
              numberOfLines={3}
              error={formErrors.instructions?.message}
              required
            />
          )}
        />

        <View style={styles.twoColRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Controller
              control={control}
              name="defaultSets"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Series por defecto"
                  value={value !== undefined ? String(value) : '3'}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  placeholder="3"
                />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="defaultRepetitions"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Reps por defecto"
                  value={value !== undefined ? String(value) : '10'}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  placeholder="10"
                />
              )}
            />
          </View>
        </View>
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center'
  },
  searchInputContainer: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl
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
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  instructionsBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  instructionsLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  instructionsText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  metricLabel: {
    fontSize: typography.fontSize.xs
  },
  metricValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  formErrorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  twoColRow: {
    flexDirection: 'row'
  }
});
