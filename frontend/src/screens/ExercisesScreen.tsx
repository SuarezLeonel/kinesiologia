/**
 * @file ExercisesScreen.tsx
 * @description Pantalla de catálogo de más de 90 ejercicios kinésicos y prescripción de rutinas terapéuticas.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ScrollView,
  Linking
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, BadgeVariant } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

export interface ExerciseItem {
  id: number;
  name: string;
  category: string;
  description: string;
  instructions: string;
  bodyZone?: string | null;
  body_zone?: string | null;
  muscleGroup?: string | null;
  muscle_group?: string | null;
  therapeuticObjective?: string | null;
  therapeutic_objective?: string | null;
  equipmentNeeded?: string | null;
  equipment_needed?: string | null;
  difficultyLevel: 'Bajo' | 'Medio' | 'Alto';
  difficulty_level: 'Bajo' | 'Medio' | 'Alto';
  contraindications?: string | null;
  defaultSets?: number;
  default_sets?: number;
  defaultRepetitions?: number;
  default_repetitions?: number;
  mediaUrl?: string | null;
  media_url?: string | null;
  isActive: boolean;
  is_active: number | boolean;
  inUseCount?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

interface FilterOptions {
  bodyZones: string[];
  therapeuticObjectives: string[];
  equipmentOptions: string[];
  categories: string[];
  difficultyLevels: string[];
}

const exerciseFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  category: z.string().min(2, 'La categoría es obligatoria'),
  description: z.string().min(4, 'La descripción clínica es obligatoria'),
  instructions: z.string().min(4, 'Las indicaciones técnicas son obligatorias'),
  bodyZone: z.string().min(2, 'La zona corporal es obligatoria'),
  muscleGroup: z.string().optional(),
  therapeuticObjective: z.string().min(2, 'El objetivo terapéutico es obligatorio'),
  equipmentNeeded: z.string().optional(),
  difficultyLevel: z.enum(['Bajo', 'Medio', 'Alto']),
  contraindications: z.string().optional(),
  defaultSets: z.coerce.number().int().positive('Debe ser mayor a 0').default(3),
  defaultRepetitions: z.coerce.number().int().positive('Debe ser mayor a 0').default(10),
  mediaUrl: z.string().url('Debe ser una URL válida (http/https)').optional().or(z.literal(''))
});

type ExerciseFormData = z.infer<typeof exerciseFormSchema>;

const PAGE_SIZE = 10;

export const ExercisesScreen = () => {
  const { theme } = useAppTheme();
  const { isAdmin, isReceptionist } = useAuth();

  // Estados principales
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Opciones dinámicas de filtros
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    bodyZones: [],
    therapeuticObjectives: [],
    equipmentOptions: [],
    categories: [],
    difficultyLevels: ['Bajo', 'Medio', 'Alto']
  });

  // Filtros activos
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBodyZone, setSelectedBodyZone] = useState('');
  const [selectedObjective, setSelectedObjective] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modales
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [exerciseToToggle, setExerciseToToggle] = useState<ExerciseItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ExerciseFormData>({
    resolver: zodResolver(exerciseFormSchema) as any,
    defaultValues: {
      name: '',
      category: 'Movilidad',
      description: '',
      instructions: '',
      bodyZone: 'Columna Lumbar',
      muscleGroup: '',
      therapeuticObjective: 'Movilidad Articular',
      equipmentNeeded: 'Sin equipamiento',
      difficultyLevel: 'Bajo',
      contraindications: '',
      defaultSets: 3,
      defaultRepetitions: 10,
      mediaUrl: ''
    }
  });

  const currentDiffInForm = watch('difficultyLevel');

  // Cargar opciones dinámicas de filtros desde backend
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await apiClient.post('/exercises/filter-options', {});
      if (res.data?.success && res.data?.data) {
        setFilterOptions(res.data.data);
      }
    } catch {
      // Usar valores por defecto si falla
    }
  }, []);

  // Cargar ejercicios paginados y filtrados
  const fetchExercises = useCallback(async (page = 1) => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const payload: Record<string, any> = {
        page,
        limit: PAGE_SIZE
      };

      if (searchTerm.trim()) payload.search = searchTerm.trim();
      if (selectedBodyZone) payload.bodyZone = selectedBodyZone;
      if (selectedObjective) payload.therapeuticObjective = selectedObjective;
      if (selectedDifficulty) payload.difficultyLevel = selectedDifficulty;
      if (selectedEquipment) payload.equipmentNeeded = selectedEquipment;

      if (statusFilter === 'active') payload.isActive = true;
      else if (statusFilter === 'inactive') payload.isActive = false;
      // 'all' no envía isActive para traer ambos

      const res = await apiClient.post('/exercises/search', payload);

      if (res.data?.success) {
        const data = res.data.data;
        const items = Array.isArray(data) ? data : (data?.items || []);
        setExercises(items);
        setTotalCount(data?.total ?? items.length);
        setCurrentPage(data?.page ?? page);
        setTotalPages(data?.totalPages ?? 1);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener catálogo de ejercicios clínicos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, selectedBodyZone, selectedObjective, selectedDifficulty, selectedEquipment, statusFilter]);

  // Cargar inicial
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Debounce de búsqueda y filtros
  useEffect(() => {
    setCurrentPage(1);
    const timeout = setTimeout(() => {
      fetchExercises(1);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm, selectedBodyZone, selectedObjective, selectedDifficulty, selectedEquipment, statusFilter, fetchExercises]);

  // Limpiar banner de éxito tras 4 segundos
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Ver detalle
  const openDetailModal = async (exercise: ExerciseItem) => {
    setSelectedExercise(exercise);
    setDetailModalVisible(true);
    // Refrescar detalle con conteo de uso en tratamientos
    try {
      const res = await apiClient.post('/exercises/detail', { id: exercise.id });
      if (res.data?.success && res.data?.data) {
        setSelectedExercise(res.data.data);
      }
    } catch {
      // Conservar el que ya tenemos
    }
  };

  // Abrir modal de creación
  const openCreateModal = () => {
    setFormMode('create');
    setEditingId(null);
    setFormError(null);
    reset({
      name: '',
      category: 'Movilidad',
      description: '',
      instructions: '',
      bodyZone: filterOptions.bodyZones[0] || 'Columna Lumbar',
      muscleGroup: '',
      therapeuticObjective: filterOptions.therapeuticObjectives[0] || 'Movilidad Articular',
      equipmentNeeded: 'Sin equipamiento',
      difficultyLevel: 'Bajo',
      contraindications: '',
      defaultSets: 3,
      defaultRepetitions: 10,
      mediaUrl: ''
    });
    setFormModalVisible(true);
  };

  // Abrir modal de edición
  const openEditModal = (exercise: ExerciseItem) => {
    setFormMode('edit');
    setEditingId(exercise.id);
    setFormError(null);
    reset({
      name: exercise.name || '',
      category: exercise.category || 'Movilidad',
      description: exercise.description || '',
      instructions: exercise.instructions || '',
      bodyZone: exercise.bodyZone || exercise.body_zone || '',
      muscleGroup: exercise.muscleGroup || exercise.muscle_group || '',
      therapeuticObjective: exercise.therapeuticObjective || exercise.therapeutic_objective || '',
      equipmentNeeded: exercise.equipmentNeeded || exercise.equipment_needed || 'Sin equipamiento',
      difficultyLevel: (exercise.difficultyLevel || exercise.difficulty_level || 'Bajo') as any,
      contraindications: exercise.contraindications || '',
      defaultSets: exercise.defaultSets ?? exercise.default_sets ?? 3,
      defaultRepetitions: exercise.defaultRepetitions ?? exercise.default_repetitions ?? 10,
      mediaUrl: exercise.mediaUrl || exercise.media_url || ''
    });
    setFormModalVisible(true);
  };

  // Guardar (Crear / Editar)
  const onSaveExercise = async (data: ExerciseFormData) => {
    setFormError(null);
    try {
      const payload = {
        name: data.name.trim(),
        category: data.category.trim(),
        description: data.description.trim(),
        instructions: data.instructions.trim(),
        bodyZone: data.bodyZone.trim(),
        muscleGroup: data.muscleGroup?.trim() || null,
        therapeuticObjective: data.therapeuticObjective.trim(),
        equipmentNeeded: data.equipmentNeeded?.trim() || null,
        difficultyLevel: data.difficultyLevel,
        contraindications: data.contraindications?.trim() || null,
        defaultSets: Number(data.defaultSets),
        defaultRepetitions: Number(data.defaultRepetitions),
        mediaUrl: data.mediaUrl?.trim() || null
      };

      if (formMode === 'create') {
        const res = await apiClient.post('/exercises', payload);
        if (res.data?.success) {
          setFormModalVisible(false);
          setSuccessBanner(`Ejercicio "${data.name}" registrado con éxito en el catálogo.`);
          fetchExercises(1);
          fetchFilterOptions();
        }
      } else if (formMode === 'edit' && editingId) {
        const res = await apiClient.post('/exercises/update', {
          id: editingId,
          ...payload
        });
        if (res.data?.success) {
          setFormModalVisible(false);
          setSuccessBanner(`Ejercicio "${data.name}" actualizado exitosamente.`);
          // Si estaba en modal de detalle, actualizarlo
          if (selectedExercise && selectedExercise.id === editingId) {
            setSelectedExercise({ ...selectedExercise, ...payload });
          }
          fetchExercises(currentPage);
          fetchFilterOptions();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al persistir el ejercicio terapéutico');
    }
  };

  // Confirmar desactivación o reactivación
  const promptToggleActive = (exercise: ExerciseItem) => {
    setExerciseToToggle(exercise);
    setDeactivateModalVisible(true);
  };

  const confirmToggleActive = async () => {
    if (!exerciseToToggle) return;
    setIsToggling(true);
    try {
      const targetStatus = !exerciseToToggle.isActive && exerciseToToggle.is_active !== 1;
      const res = await apiClient.post('/exercises/toggle-active', {
        id: exerciseToToggle.id,
        isActive: targetStatus
      });

      if (res.data?.success) {
        setDeactivateModalVisible(false);
        const actionLabel = targetStatus ? 'reactivado' : 'desactivado lógicamente';
        setSuccessBanner(`Ejercicio "${exerciseToToggle.name}" ${actionLabel}. Historial clínico preservado.`);
        if (selectedExercise && selectedExercise.id === exerciseToToggle.id) {
          setSelectedExercise({
            ...selectedExercise,
            isActive: targetStatus,
            is_active: targetStatus ? 1 : 0
          });
        }
        setExerciseToToggle(null);
        fetchExercises(currentPage);
      }
    } catch (err: any) {
      setSuccessBanner(err.response?.data?.error?.message || 'Error al actualizar el estado del ejercicio');
    } finally {
      setIsToggling(false);
    }
  };

  // Limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBodyZone('');
    setSelectedObjective('');
    setSelectedDifficulty('');
    setSelectedEquipment('');
    setStatusFilter('active');
  };

  const hasActiveFilters = Boolean(
    searchTerm || selectedBodyZone || selectedObjective || selectedDifficulty || selectedEquipment || statusFilter !== 'active'
  );

  const getDifficultyVariant = (diff?: string): BadgeVariant => {
    const d = String(diff || '').toLowerCase();
    switch (d) {
      case 'bajo':
        return 'success';
      case 'medio':
      case 'moderado':
        return 'warning';
      case 'alto':
      case 'avanzado':
        return 'error';
      default:
        return 'neutral';
    }
  };

  // Si es recepcionista, mostrar pantalla denegada clara
  if (isReceptionist) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader
          title="Catálogo de Ejercicios"
          subtitle="Área restringida a profesionales de kinesiología y administración clínica"
        />
        <EmptyState
          title="Acceso Restringido"
          subtitle="Por políticas de confidencialidad y normativas médicas, el catálogo de prescripción clínica y rehabilitación no está disponible para el rol de Recepción."
        />
      </View>
    );
  }

  if (loading && !refreshing) {
    return <LoadingState message="Cargando biblioteca clínica de ejercicios..." />;
  }

  if (error && !refreshing && exercises.length === 0) {
    return <ErrorState message={error} onRetry={() => fetchExercises(1)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Encabezado */}
      <ScreenHeader
        title="Catálogo de Ejercicios Clínicos"
        subtitle="Biblioteca terapéutica reutilizable, prescripciones y protocolos"
        action={
          <Button
            title="+ Nuevo Ejercicio"
            onPress={openCreateModal}
            size="sm"
          />
        }
      />

      {/* Banner de confirmación / feedback */}
      {successBanner && (
        <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
          <MaterialIcons name="check-circle" size={18} color={theme.success} style={{ marginRight: spacing.xs }} />
          <Text style={[styles.successBannerText, { color: theme.success }]}>{successBanner}</Text>
          <TouchableOpacity onPress={() => setSuccessBanner(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={theme.success} />
          </TouchableOpacity>
        </View>
      )}

      {/* Barra de búsqueda y botón de filtros */}
      <View style={styles.searchRow}>
        <Input
          placeholder="Buscar por nombre, zona corporal, objetivo o músculo..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          containerStyle={{ marginBottom: 0, flex: 1 }}
          rightAction={
            searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            ) : (
              <MaterialIcons name="search" size={20} color={theme.textMuted} />
            )
          }
        />
        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor: showFiltersPanel || hasActiveFilters ? theme.primary : theme.surface,
              borderColor: hasActiveFilters ? theme.primary : theme.border
            }
          ]}
          onPress={() => setShowFiltersPanel(!showFiltersPanel)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="filter-list"
            size={20}
            color={showFiltersPanel || hasActiveFilters ? '#FFFFFF' : theme.text}
          />
          {hasActiveFilters && (
            <View style={styles.filterActiveDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Panel Desplegable de Filtros Clínicos Multifacéticos */}
      {showFiltersPanel && (
        <Card elevated style={[styles.filtersPanel, { borderColor: theme.border }]} padding="md">
          <View style={styles.filtersHeader}>
            <Text style={[styles.filtersTitle, { color: theme.text }]}>Filtros Clínicos Avanzados</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                <MaterialIcons name="clear-all" size={16} color={theme.primary} />
                <Text style={[styles.clearFiltersText, { color: theme.primary }]}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filtro por Zona Corporal */}
          <Text style={[styles.filterGroupLabel, { color: theme.textSecondary }]}>Zona Corporal:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: selectedBodyZone === '' ? theme.primary : theme.surface,
                  borderColor: selectedBodyZone === '' ? theme.primary : theme.border
                }
              ]}
              onPress={() => setSelectedBodyZone('')}
            >
              <Text style={[styles.chipText, { color: selectedBodyZone === '' ? '#FFF' : theme.text }]}>
                Todas las zonas
              </Text>
            </TouchableOpacity>
            {filterOptions.bodyZones.map((zone) => (
              <TouchableOpacity
                key={zone}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedBodyZone === zone ? theme.primary : theme.surface,
                    borderColor: selectedBodyZone === zone ? theme.primary : theme.border
                  }
                ]}
                onPress={() => setSelectedBodyZone(selectedBodyZone === zone ? '' : zone)}
              >
                <Text style={[styles.chipText, { color: selectedBodyZone === zone ? '#FFF' : theme.text }]}>
                  {zone}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filtro por Objetivo Terapéutico */}
          <Text style={[styles.filterGroupLabel, { color: theme.textSecondary }]}>Objetivo Terapéutico:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: selectedObjective === '' ? theme.primary : theme.surface,
                  borderColor: selectedObjective === '' ? theme.primary : theme.border
                }
              ]}
              onPress={() => setSelectedObjective('')}
            >
              <Text style={[styles.chipText, { color: selectedObjective === '' ? '#FFF' : theme.text }]}>
                Todos los objetivos
              </Text>
            </TouchableOpacity>
            {filterOptions.therapeuticObjectives.map((obj) => (
              <TouchableOpacity
                key={obj}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selectedObjective === obj ? theme.primary : theme.surface,
                    borderColor: selectedObjective === obj ? theme.primary : theme.border
                  }
                ]}
                onPress={() => setSelectedObjective(selectedObjective === obj ? '' : obj)}
              >
                <Text style={[styles.chipText, { color: selectedObjective === obj ? '#FFF' : theme.text }]}>
                  {obj}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Dificultad y Equipamiento */}
          <View style={styles.twoColRow}>
            {/* Dificultad */}
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[styles.filterGroupLabel, { color: theme.textSecondary }]}>Dificultad:</Text>
              <View style={styles.miniChipsRow}>
                {['', 'Bajo', 'Medio', 'Alto'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.miniChip,
                      {
                        backgroundColor: selectedDifficulty === d ? theme.primary : theme.surface,
                        borderColor: selectedDifficulty === d ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => setSelectedDifficulty(d)}
                  >
                    <Text style={[styles.miniChipText, { color: selectedDifficulty === d ? '#FFF' : theme.text }]}>
                      {d === '' ? 'Todas' : d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estado Activo / Inactivo */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.filterGroupLabel, { color: theme.textSecondary }]}>Estado del catálogo:</Text>
              <View style={styles.miniChipsRow}>
                <TouchableOpacity
                  style={[
                    styles.miniChip,
                    {
                      backgroundColor: statusFilter === 'active' ? theme.primary : theme.surface,
                      borderColor: statusFilter === 'active' ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setStatusFilter('active')}
                >
                  <Text style={[styles.miniChipText, { color: statusFilter === 'active' ? '#FFF' : theme.text }]}>
                    Activos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.miniChip,
                    {
                      backgroundColor: statusFilter === 'inactive' ? theme.primary : theme.surface,
                      borderColor: statusFilter === 'inactive' ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setStatusFilter('inactive')}
                >
                  <Text style={[styles.miniChipText, { color: statusFilter === 'inactive' ? '#FFF' : theme.text }]}>
                    Inactivos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.miniChip,
                    {
                      backgroundColor: statusFilter === 'all' ? theme.primary : theme.surface,
                      borderColor: statusFilter === 'all' ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setStatusFilter('all')}
                >
                  <Text style={[styles.miniChipText, { color: statusFilter === 'all' ? '#FFF' : theme.text }]}>
                    Todos
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Barra de metadatos de resultados */}
      <View style={styles.resultsInfoRow}>
        <Text style={[styles.resultsCountText, { color: theme.textSecondary }]}>
          {totalCount} {totalCount === 1 ? 'ejercicio encontrado' : 'ejercicios encontrados'}
          {hasActiveFilters ? ' con filtros activos' : ''}
        </Text>
        {totalPages > 1 && (
          <Text style={[styles.pageInfoText, { color: theme.textMuted }]}>
            Página {currentPage} de {totalPages}
          </Text>
        )}
      </View>

      {/* Lista de ejercicios */}
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchExercises(currentPage);
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin ejercicios coincidentes"
            subtitle={
              hasActiveFilters
                ? 'No se hallaron protocolos con los filtros seleccionados. Intenta ampliar los criterios o limpiar los filtros.'
                : 'El catálogo clínico no posee ejercicios registrados actualmente. Crea el primer ejercicio con el botón superior.'
            }
          />
        }
        renderItem={({ item }) => {
          const isActive = item.isActive ?? item.is_active === 1;
          const bodyZone = item.bodyZone || item.body_zone;
          const objective = item.therapeuticObjective || item.therapeutic_objective;
          const difficulty = item.difficultyLevel || item.difficulty_level || 'Bajo';
          const equipment = item.equipmentNeeded || item.equipment_needed;
          const sets = item.defaultSets ?? item.default_sets ?? 3;
          const reps = item.defaultRepetitions ?? item.default_repetitions ?? 10;

          return (
            <Card
              elevated
              style={[
                styles.exerciseCard,
                !isActive && { opacity: 0.7, borderColor: theme.border }
              ]}
              padding="lg"
            >
              {/* Encabezado de la tarjeta */}
              <View style={styles.cardHeader}>
                <View style={styles.titleCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.exerciseName, { color: theme.text }]}>{item.name}</Text>
                    {!isActive && (
                      <Badge
                        label="Inactivo"
                        variant="neutral"
                        size="sm"
                        style={{ marginLeft: spacing.xs }}
                      />
                    )}
                  </View>
                  <View style={styles.badgeRow}>
                    {item.category && (
                      <Badge
                        label={item.category}
                        variant="default"
                        size="sm"
                      />
                    )}
                    {bodyZone && (
                      <Badge
                        label={`Zona: ${bodyZone}`}
                        variant="info"
                        size="sm"
                      />
                    )}
                    <Badge
                      label={`Nivel: ${difficulty}`}
                      variant={getDifficultyVariant(difficulty)}
                      size="sm"
                    />
                    {objective && (
                      <Badge
                        label={objective}
                        variant="neutral"
                        size="sm"
                      />
                    )}
                    {item.inUseCount !== undefined && item.inUseCount > 0 && (
                      <Badge
                        label={`En ${item.inUseCount} tratamiento${item.inUseCount > 1 ? 's' : ''}`}
                        variant="success"
                        size="sm"
                      />
                    )}
                  </View>
                </View>
              </View>

              {/* Descripción */}
              {item.description ? (
                <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Parámetros de prescripción y equipamiento */}
              <View style={[styles.metaRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.metaItem}>
                  <MaterialIcons name="repeat" size={16} color={theme.textMuted} />
                  <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
                    Prescripción: <Text style={{ color: theme.text, fontWeight: '600' }}>{sets} series × {reps} reps</Text>
                  </Text>
                </View>
                {equipment ? (
                  <View style={styles.metaItem}>
                    <MaterialIcons name="fitness-center" size={16} color={theme.textMuted} />
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
                      Equipo: <Text style={{ color: theme.text }}>{equipment}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Pie de tarjeta: acciones operativas */}
              <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.detailLinkBtn}
                  onPress={() => openDetailModal(item)}
                >
                  <MaterialIcons name="visibility" size={16} color={theme.primary} />
                  <Text style={[styles.detailLinkText, { color: theme.primary }]}>Ver Detalle Clínico</Text>
                </TouchableOpacity>

                <View style={styles.actionButtonsGroup}>
                  <TouchableOpacity
                    style={[styles.smallIconBtn, { borderColor: theme.border }]}
                    onPress={() => openEditModal(item)}
                    accessibilityLabel="Editar ejercicio"
                  >
                    <MaterialIcons name="edit" size={16} color={theme.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.smallIconBtn,
                      {
                        borderColor: isActive ? theme.error + '40' : theme.success + '40',
                        backgroundColor: isActive ? theme.errorBg : theme.successBg
                      }
                    ]}
                    onPress={() => promptToggleActive(item)}
                    accessibilityLabel={isActive ? 'Desactivar ejercicio' : 'Reactivar ejercicio'}
                  >
                    <MaterialIcons
                      name={isActive ? 'block' : 'check'}
                      size={16}
                      color={isActive ? theme.error : theme.success}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
        contentContainerStyle={styles.listContent}
      />

      {/* Barra de Paginación */}
      {totalPages > 1 && (
        <View style={[styles.paginationBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <Button
            title="Anterior"
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1}
            onPress={() => {
              if (currentPage > 1) {
                const nextP = currentPage - 1;
                setCurrentPage(nextP);
                fetchExercises(nextP);
              }
            }}
          />
          <Text style={[styles.paginationText, { color: theme.textSecondary }]}>
            Pág. {currentPage} de {totalPages} ({totalCount} total)
          </Text>
          <Button
            title="Siguiente"
            variant="secondary"
            size="sm"
            disabled={currentPage >= totalPages}
            onPress={() => {
              if (currentPage < totalPages) {
                const nextP = currentPage + 1;
                setCurrentPage(nextP);
                fetchExercises(nextP);
              }
            }}
          />
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: VISTA DETALLADA DEL EJERCICIO CLÍNICO               */}
      {/* ============================================================ */}
      <ModalWrapper
        visible={detailModalVisible}
        title={selectedExercise?.name || 'Detalle Clínico'}
        subtitle={`ID Clínico #${selectedExercise?.id || ''} — Categoría: ${selectedExercise?.category || ''}`}
        onClose={() => setDetailModalVisible(false)}
        maxWidth={640}
        footer={
          <View style={styles.modalFooterActions}>
            <Button
              title="Cerrar"
              variant="secondary"
              size="md"
              onPress={() => setDetailModalVisible(false)}
            />
            {selectedExercise && (
              <>
                <Button
                  title="Editar Ejercicio"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setDetailModalVisible(false);
                    openEditModal(selectedExercise);
                  }}
                />
                <Button
                  title={
                    (selectedExercise.isActive ?? selectedExercise.is_active === 1)
                      ? 'Desactivar'
                      : 'Reactivar'
                  }
                  variant={(selectedExercise.isActive ?? selectedExercise.is_active === 1) ? 'danger' : 'primary'}
                  size="md"
                  onPress={() => {
                    setDetailModalVisible(false);
                    promptToggleActive(selectedExercise);
                  }}
                />
              </>
            )}
          </View>
        }
      >
        {selectedExercise && (
          <ScrollView style={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
            {/* Badges de clasificación */}
            <View style={styles.detailBadgeRow}>
              <Badge
                label={`Zona: ${selectedExercise.bodyZone || selectedExercise.body_zone || 'Global'}`}
                variant="info"
                size="md"
              />
              <Badge
                label={`Nivel: ${selectedExercise.difficultyLevel || selectedExercise.difficulty_level || 'Bajo'}`}
                variant={getDifficultyVariant(selectedExercise.difficultyLevel || selectedExercise.difficulty_level)}
                size="md"
              />
              <Badge
                label={(selectedExercise.isActive ?? selectedExercise.is_active === 1) ? 'Catálogo Activo' : 'Desactivado'}
                variant={(selectedExercise.isActive ?? selectedExercise.is_active === 1) ? 'success' : 'neutral'}
                size="md"
              />
            </View>

            {/* Parámetros clave en grilla */}
            <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.detailGridRow}>
                <View style={styles.detailGridCol}>
                  <Text style={[styles.detailGridLabel, { color: theme.textMuted }]}>Objetivo Terapéutico</Text>
                  <Text style={[styles.detailGridValue, { color: theme.text }]}>
                    {selectedExercise.therapeuticObjective || selectedExercise.therapeutic_objective || 'General'}
                  </Text>
                </View>
                <View style={styles.detailGridCol}>
                  <Text style={[styles.detailGridLabel, { color: theme.textMuted }]}>Grupo Muscular</Text>
                  <Text style={[styles.detailGridValue, { color: theme.text }]}>
                    {selectedExercise.muscleGroup || selectedExercise.muscle_group || 'No especificado'}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailGridRow, { marginTop: spacing.md }]}>
                <View style={styles.detailGridCol}>
                  <Text style={[styles.detailGridLabel, { color: theme.textMuted }]}>Equipamiento Requerido</Text>
                  <Text style={[styles.detailGridValue, { color: theme.text }]}>
                    {selectedExercise.equipmentNeeded || selectedExercise.equipment_needed || 'Sin equipamiento'}
                  </Text>
                </View>
                <View style={styles.detailGridCol}>
                  <Text style={[styles.detailGridLabel, { color: theme.textMuted }]}>Dosis por Defecto</Text>
                  <Text style={[styles.detailGridValue, { color: theme.text, fontWeight: '700' }]}>
                    {selectedExercise.defaultSets ?? selectedExercise.default_sets ?? 3} series × {selectedExercise.defaultRepetitions ?? selectedExercise.default_repetitions ?? 10} repeticiones
                  </Text>
                </View>
              </View>
            </View>

            {/* Descripción clínica */}
            <View style={styles.detailBlock}>
              <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Descripción Terapéutica</Text>
              <Text style={[styles.detailBlockText, { color: theme.textSecondary }]}>
                {selectedExercise.description}
              </Text>
            </View>

            {/* Indicaciones técnicas de ejecución */}
            <View style={styles.detailBlock}>
              <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Indicaciones Técnicas de Ejecución</Text>
              <View style={[styles.instructionsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.instructionsBody, { color: theme.text }]}>
                  {selectedExercise.instructions}
                </Text>
              </View>
            </View>

            {/* Contraindicaciones y precauciones clínicas (Alerta visual) */}
            <View style={styles.detailBlock}>
              <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Precauciones y Contraindicaciones</Text>
              <View style={[
                styles.contraindicationsCard,
                {
                  backgroundColor: selectedExercise.contraindications ? theme.warningBg : theme.surface,
                  borderColor: selectedExercise.contraindications ? theme.warning + '50' : theme.border
                }
              ]}>
                <MaterialIcons
                  name="warning-amber"
                  size={20}
                  color={selectedExercise.contraindications ? theme.warning : theme.textMuted}
                  style={{ marginRight: spacing.sm, marginTop: 2 }}
                />
                <Text style={[
                  styles.contraindicationsText,
                  { color: selectedExercise.contraindications ? theme.text : theme.textMuted }
                ]}>
                  {selectedExercise.contraindications || 'Sin contraindicaciones absolutas descritas para este protocolo.'}
                </Text>
              </View>
            </View>

            {/* Demostración multimedia */}
            {(selectedExercise.mediaUrl || selectedExercise.media_url) ? (
              <View style={styles.detailBlock}>
                <Text style={[styles.detailBlockTitle, { color: theme.text }]}>Recurso Audiovisual</Text>
                <TouchableOpacity
                  style={[styles.mediaLinkBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}
                  onPress={() => {
                    const url = selectedExercise.mediaUrl || selectedExercise.media_url;
                    if (url) Linking.openURL(url);
                  }}
                >
                  <MaterialIcons name="play-circle-outline" size={20} color={theme.primary} style={{ marginRight: spacing.sm }} />
                  <Text style={[styles.mediaLinkText, { color: theme.primary }]}>
                    Abrir demostración en video o infografía
                  </Text>
                  <MaterialIcons name="open-in-new" size={16} color={theme.primary} style={{ marginLeft: spacing.xs }} />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Métricas de uso e historial */}
            <View style={[styles.auditRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.auditText, { color: theme.textMuted }]}>
                Uso en tratamientos activos / históricos: <Text style={{ color: theme.text, fontWeight: '600' }}>{selectedExercise.inUseCount ?? 0}</Text>
              </Text>
              {selectedExercise.createdAt && (
                <Text style={[styles.auditText, { color: theme.textMuted }]}>
                  Fecha de alta: {new Date(selectedExercise.createdAt).toLocaleDateString('es-AR')}
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </ModalWrapper>

      {/* ============================================================ */}
      {/* MODAL 2: CREACIÓN / EDICIÓN DE EJERCICIO CLÍNICO             */}
      {/* ============================================================ */}
      <ModalWrapper
        visible={formModalVisible}
        title={formMode === 'create' ? 'Nuevo Ejercicio Terapéutico' : 'Editar Ejercicio Clínico'}
        subtitle={
          formMode === 'create'
            ? 'Complete los atributos clínicos para incorporar el protocolo al catálogo.'
            : `Modificando ID #${editingId}`
        }
        onClose={() => setFormModalVisible(false)}
        maxWidth={640}
        footer={
          <View style={styles.modalFooterActions}>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setFormModalVisible(false)}
            />
            <Button
              title={formMode === 'create' ? 'Registrar Ejercicio' : 'Guardar Cambios'}
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onSaveExercise)()}
            />
          </View>
        }
      >
        {formError && (
          <View style={[styles.formErrorBox, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <MaterialIcons name="error-outline" size={18} color={theme.error} style={{ marginRight: spacing.xs }} />
            <Text style={[styles.formErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
          {/* Nombre */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nombre del ejercicio o técnica"
                value={value}
                onChangeText={onChange}
                placeholder="Ej: Sentadilla búlgara con foco en glúteo"
                error={formErrors.name?.message}
                required
              />
            )}
          />

          {/* Categoría y Zona Corporal */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Categoría o tipo"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Movilidad / Fortalecimiento"
                    error={formErrors.category?.message}
                    required
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="bodyZone"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Zona corporal principal"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ej: Columna Lumbar / Hombro"
                    error={formErrors.bodyZone?.message}
                    required
                  />
                )}
              />
            </View>
          </View>

          {/* Chips de sugerencia rápida para Zona */}
          <View style={styles.suggestChipsRow}>
            {['Hombro', 'Columna Lumbar', 'Pelvis / Cadera', 'Rodilla', 'Tobillo / Pie', 'Cervical', 'Core'].map((z) => (
              <TouchableOpacity
                key={z}
                style={[styles.suggestChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setValue('bodyZone', z, { shouldValidate: true })}
              >
                <Text style={[styles.suggestChipText, { color: theme.textSecondary }]}>+{z}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Grupo Muscular y Objetivo Terapéutico */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Controller
                control={control}
                name="muscleGroup"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Grupo muscular objetivo"
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Ej: Cuádriceps e isquiotibiales"
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="therapeuticObjective"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Objetivo terapéutico"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Fortalecimiento / Control Motor"
                    error={formErrors.therapeuticObjective?.message}
                    required
                  />
                )}
              />
            </View>
          </View>

          {/* Nivel de Dificultad y Equipamiento */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Nivel de dificultad <Text style={{ color: theme.error }}>*</Text>
              </Text>
              <View style={styles.segmentedDifficulty}>
                {(['Bajo', 'Medio', 'Alto'] as const).map((level) => {
                  const isSelected = currentDiffInForm === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.segmentBtn,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surface,
                          borderColor: isSelected ? theme.primary : theme.border
                        }
                      ]}
                      onPress={() => setValue('difficultyLevel', level, { shouldValidate: true })}
                    >
                      <Text style={[styles.segmentBtnText, { color: isSelected ? '#FFF' : theme.text }]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="equipmentNeeded"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Equipamiento necesario"
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Sin equipamiento / Banda elástica"
                  />
                )}
              />
            </View>
          </View>

          {/* Series y Repeticiones por defecto */}
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
                    error={formErrors.defaultSets?.message}
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
                    label="Repeticiones por defecto"
                    value={value !== undefined ? String(value) : '10'}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    placeholder="10"
                    error={formErrors.defaultRepetitions?.message}
                  />
                )}
              />
            </View>
          </View>

          {/* Descripción clínica */}
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Descripción y fundamentación clínica"
                value={value}
                onChangeText={onChange}
                placeholder="Propósito terapéutico, articulaciones trabajadas y fases de rehabilitación indicadas"
                multiline
                numberOfLines={2}
                error={formErrors.description?.message}
                required
              />
            )}
          />

          {/* Instrucciones técnicas paso a paso */}
          <Controller
            control={control}
            name="instructions"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Instrucciones técnicas de ejecución"
                value={value}
                onChangeText={onChange}
                placeholder="1. Postura de inicio y alineación articular&#10;2. Ejecución motora y velocidad angular&#10;3. Cadencia respiratoria y fase excéntrica"
                multiline
                numberOfLines={3}
                error={formErrors.instructions?.message}
                required
              />
            )}
          />

          {/* Contraindicaciones y precauciones */}
          <Controller
            control={control}
            name="contraindications"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Contraindicaciones y precauciones clínicas"
                value={value || ''}
                onChangeText={onChange}
                placeholder="Ej: Suspender ante dolor agudo punzante. Contraindicado en fase inflamatoria aguda o post-quirúrgico inmediato sin alta kinésica."
                multiline
                numberOfLines={2}
              />
            )}
          />

          {/* URL de video o multimedia */}
          <Controller
            control={control}
            name="mediaUrl"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Enlace a video o demostración multimedia (opcional)"
                value={value || ''}
                onChangeText={onChange}
                placeholder="https://ejemplo.com/videos/ejercicio.mp4"
                error={formErrors.mediaUrl?.message}
              />
            )}
          />
        </ScrollView>
      </ModalWrapper>

      {/* ============================================================ */}
      {/* MODAL 3: CONFIRMACIÓN DE DESACTIVACIÓN LÓGICA (SOFT DELETE)   */}
      {/* ============================================================ */}
      <ModalWrapper
        visible={deactivateModalVisible}
        title={
          (exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
            ? 'Desactivar Ejercicio Terapéutico'
            : 'Reactivar Ejercicio Terapéutico'
        }
        onClose={() => setDeactivateModalVisible(false)}
        maxWidth={480}
        footer={
          <View style={styles.modalFooterActions}>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setDeactivateModalVisible(false)}
            />
            <Button
              title={
                (exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
                  ? 'Confirmar Desactivación'
                  : 'Confirmar Reactivación'
              }
              variant={(exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1) ? 'danger' : 'primary'}
              size="md"
              loading={isToggling}
              onPress={confirmToggleActive}
            />
          </View>
        }
      >
        <View style={styles.deactivateModalBody}>
          <MaterialIcons
            name={
              (exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
                ? 'warning'
                : 'check-circle'
            }
            size={36}
            color={
              (exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
                ? theme.warning
                : theme.success
            }
            style={{ marginBottom: spacing.md }}
          />

          <Text style={[styles.deactivateTitle, { color: theme.text }]}>
            {(exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
              ? `¿Desea desactivar "${exerciseToToggle?.name}"?`
              : `¿Desea reactivar "${exerciseToToggle?.name}"?`}
          </Text>

          <Text style={[styles.deactivateDescription, { color: theme.textSecondary }]}>
            {(exerciseToToggle?.isActive ?? exerciseToToggle?.is_active === 1)
              ? 'El ejercicio dejará de estar disponible para nuevas prescripciones y rutinas activas. No se eliminará físicamente de la base de datos para preservar de forma estricta las historias clínicas y los tratamientos históricos que lo contengan.'
              : 'El ejercicio volverá a estar disponible en el catálogo activo para que los kinesiólogos puedan incluirlo en planes de rehabilitación.'}
          </Text>
        </View>
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  successBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700'
  },
  filtersPanel: {
    marginBottom: spacing.md
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  filtersTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  clearFiltersText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  filterGroupLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  chipsScroll: {
    marginBottom: spacing.xs
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs
  },
  chipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  miniChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  miniChipText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: 2
  },
  resultsCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  pageInfoText: {
    fontSize: typography.fontSize.xs
  },
  listContent: {
    paddingBottom: spacing.xxl
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    flexWrap: 'wrap'
  },
  exerciseName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.sm
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaLabel: {
    fontSize: typography.fontSize.xs
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  detailLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  detailLinkText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  smallIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderRadius: radii.md,
    marginTop: spacing.xs
  },
  paginationText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    width: '100%'
  },
  detailScrollContent: {
    maxHeight: 520
  },
  detailBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  detailSectionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  detailGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  detailGridCol: {
    flex: 1
  },
  detailGridLabel: {
    fontSize: typography.fontSize.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  detailGridValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  detailBlock: {
    marginBottom: spacing.md
  },
  detailBlockTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  },
  detailBlockText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  instructionsContainer: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  instructionsBody: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22
  },
  contraindicationsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  contraindicationsText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  mediaLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  mediaLinkText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  auditText: {
    fontSize: typography.fontSize.tiny
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
  },
  suggestChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.md,
    marginTop: -spacing.xs
  },
  suggestChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  suggestChipText: {
    fontSize: typography.fontSize.tiny
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs
  },
  segmentedDifficulty: {
    flexDirection: 'row',
    height: 40,
    gap: 4,
    marginBottom: spacing.md
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1
  },
  segmentBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  deactivateModalBody: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm
  },
  deactivateTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm
  },
  deactivateDescription: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20
  }
});
