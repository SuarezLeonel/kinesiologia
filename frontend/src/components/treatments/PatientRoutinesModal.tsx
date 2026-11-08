/**
 * @file PatientRoutinesModal.tsx
 * @description Modal clínico para visualización y asignación de rutinas de tratamiento al paciente.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../api/client';
import { useDataSync } from '../../context/DataSyncContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography } from '../../theme/tokens';
import { Card, Badge, Button, Input, DateInput, ModalWrapper, BadgeVariant } from '../ui';
import { LoadingState, EmptyState } from '../FeedbackStates';

export interface RoutineExerciseItem {
  exerciseId: number;
  name: string;
  category?: string;
  bodyZone?: string | null;
  difficultyLevel?: string;
  sets: number;
  repetitions: number;
  durationSeconds?: number | null;
  restSeconds: number;
  weeklyFrequency: string;
  bodySide: 'Bilateral' | 'Izquierdo' | 'Derecho' | 'No aplica';
  resistanceLoad?: string | null;
  customInstructions?: string | null;
  executionOrder: number;
}

export interface PatientRoutinesModalProps {
  visible: boolean;
  onClose: () => void;
  patient: {
    id: number;
    first_name?: string;
    last_name?: string;
    dni?: string;
    health_insurance_name?: string;
    affiliate_number?: string;
    [key: string]: any;
  } | null;
  onSuccess?: () => void;
}

type ViewMode = 'view_plan' | 'session_record' | 'tracking_evolution' | 'edit_routine' | 'create_plan' | 'version_history';

export const PatientRoutinesModal: React.FC<PatientRoutinesModalProps> = ({
  visible,
  onClose,
  patient,
  onSuccess
}) => {
  const { theme } = useAppTheme();
  const { scopeVersions } = useDataSync();

  // Estados de navegación interna
  const [viewMode, setViewMode] = useState<ViewMode>('view_plan');

  // Estados de datos
  const [loading, setLoading] = useState(false);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [selectedTreatment, setSelectedTreatment] = useState<any | null>(null);
  const [routines, setRoutines] = useState<any[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<any | null>(null);
  const [routineHistory, setRoutineHistory] = useState<any[]>([]);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Catálogo de ejercicios para prescripción
  const [catalogExercises, setCatalogExercises] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogZone, setCatalogZone] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Formulario: Nuevo Plan de Tratamiento
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanDiagnosis, setNewPlanDiagnosis] = useState('');
  const [newPlanObjectives, setNewPlanObjectives] = useState('');
  const [newPlanSessions, setNewPlanSessions] = useState('10');
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // Formulario: Rutina (Crear / Editar)
  const [routineIdToEdit, setRoutineIdToEdit] = useState<number | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineDescription, setRoutineDescription] = useState('');
  const [routineStatus, setRoutineStatus] = useState<'active' | 'draft' | 'completed'>('active');
  const [changeReason, setChangeReason] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  const [routineItems, setRoutineItems] = useState<RoutineExerciseItem[]>([]);
  const [savingRoutine, setSavingRoutine] = useState(false);

  // Estados para Seguimiento y Evolución Clínica Integral
  const [trackingData, setTrackingData] = useState<any | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'sessions' | 'patient_logs' | 'routines'>('all');

  // Estados para Registro de Sesión con Ejercicios Supervisados
  const [sessionNumber, setSessionNumber] = useState('1');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionProcedures, setSessionProcedures] = useState('');
  const [sessionEvolution, setSessionEvolution] = useState('');
  const [sessionPain, setSessionPain] = useState<number | null>(3);
  const [sessionObservations, setSessionObservations] = useState('');
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);
  const [savingSession, setSavingSession] = useState(false);

  // Estados para Gestión Individual de Ejercicios dentro de una Rutina Existente
  const [editingRoutineExercise, setEditingRoutineExercise] = useState<{
    routineId: number;
    routineExerciseId: number;
    exerciseId: number;
    name: string;
    sets: string;
    repetitions: string;
    durationSeconds: string;
    restSeconds: string;
    weeklyFrequency: string;
    bodySide: 'Bilateral' | 'Izquierdo' | 'Derecho' | 'No aplica';
    resistanceLoad: string;
    customInstructions: string;
    executionOrder: string;
  } | null>(null);
  const [savingIndividualExercise, setSavingIndividualExercise] = useState(false);

  const [confirmDeleteRoutineExercise, setConfirmDeleteRoutineExercise] = useState<{
    routineId: number;
    routineExerciseId: number;
    name: string;
  } | null>(null);
  const [deletingExerciseId, setDeletingExerciseId] = useState<number | null>(null);

  const [addingExerciseToRoutineId, setAddingExerciseToRoutineId] = useState<number | null>(null);
  const [newRoutineExerciseDraft, setNewRoutineExerciseDraft] = useState<{
    exerciseId: number | null;
    name: string;
    sets: string;
    repetitions: string;
    durationSeconds: string;
    restSeconds: string;
    weeklyFrequency: string;
    bodySide: 'Bilateral' | 'Izquierdo' | 'Derecho' | 'No aplica';
    resistanceLoad: string;
    customInstructions: string;
    executionOrder: string;
  } | null>(null);
  const [addingIndividualExercise, setAddingIndividualExercise] = useState(false);
  const [reorderingExerciseId, setReorderingExerciseId] = useState<number | null>(null);

  // Cargar tratamientos del paciente
  const fetchPatientTreatments = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/treatments/search', {
        patientId: patient.id
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        setTreatments(list);
        if (list.length > 0) {
          // Seleccionar el primer tratamiento activo o el primero disponible
          const activeT = list.find((t: any) => t.status === 'active') || list[0];
          await fetchTreatmentDetail(activeT.id);
        } else {
          setSelectedTreatment(null);
          setRoutines([]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al cargar tratamientos');
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  // Cargar detalle del tratamiento seleccionado y sus rutinas
  const fetchTreatmentDetail = async (treatmentId: number) => {
    try {
      const res = await apiClient.post('/treatments/detail', { id: treatmentId });
      if (res.data?.success) {
        const t = res.data.data;
        setSelectedTreatment(t);

        // Rutinas asociadas al tratamiento
        const rRes = await apiClient.post('/treatments/routines/search', {
          treatmentId: t.id,
          includeHistory: true
        });
        if (rRes.data?.success) {
          const rList = rRes.data.data || [];
          setRoutines(rList);
          // Seleccionar por defecto la rutina vigente o la primera
          const currentR = rList.find((r: any) => r.is_current === 1) || rList[0] || null;
          if (currentR) {
            fetchRoutineDetail(currentR.id);
          } else {
            setSelectedRoutine(null);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al obtener detalle del tratamiento');
    }
  };

  // Cargar detalle de una rutina específica
  const fetchRoutineDetail = async (routineId: number) => {
    try {
      const res = await apiClient.post('/treatments/routines/detail', { id: routineId });
      if (res.data?.success) {
        setSelectedRoutine(res.data.data);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al obtener rutina');
    }
  };

  // Cargar catálogo de ejercicios para seleccionar
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await apiClient.post('/exercises/search', {
        search: catalogSearch.trim() || undefined,
        bodyZone: catalogZone || undefined,
        isActive: true,
        limit: 15
      });
      if (res.data?.success) {
        const items = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.items || []);
        setCatalogExercises(items);
      }
    } catch {
      // Ignorar error transitorio
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogSearch, catalogZone]);

  useEffect(() => {
    if (visible && patient?.id) {
      setViewMode('view_plan');
      setErrorMsg(null);
      setSuccessMsg(null);
      fetchPatientTreatments();
    }
  }, [visible, patient?.id, fetchPatientTreatments]);

  useEffect(() => {
    if (viewMode === 'edit_routine' || addingExerciseToRoutineId !== null) {
      fetchCatalog();
    }
  }, [viewMode, addingExerciseToRoutineId, fetchCatalog, scopeVersions.exercises]);

  // Debounce catálogo
  useEffect(() => {
    if (viewMode !== 'edit_routine' && addingExerciseToRoutineId === null) return;
    const t = setTimeout(() => {
      fetchCatalog();
    }, 200);
    return () => clearTimeout(t);
  }, [catalogSearch, catalogZone, viewMode, addingExerciseToRoutineId, fetchCatalog]);

  // Iniciar creación de nuevo plan
  const handleStartCreatePlan = () => {
    setNewPlanTitle('Plan de Rehabilitación Kinésica');
    setNewPlanDiagnosis('');
    setNewPlanObjectives('');
    setNewPlanSessions('10');
    setViewMode('create_plan');
  };

  // Guardar nuevo plan
  const handleSavePlan = async () => {
    if (!patient?.id) return;
    if (!newPlanTitle.trim() || !newPlanDiagnosis.trim() || !newPlanObjectives.trim()) {
      setErrorMsg('Complete todos los campos obligatorios del plan terapéutico.');
      return;
    }
    setSubmittingPlan(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post('/treatments', {
        patientId: patient.id,
        title: newPlanTitle.trim(),
        diagnosisSummary: newPlanDiagnosis.trim(),
        objectives: newPlanObjectives.trim(),
        totalPlannedSessions: Number(newPlanSessions) || 10,
        startDate: new Date().toISOString().slice(0, 10)
      });
      if (res.data?.success) {
        setSuccessMsg('Plan creado.');
        await fetchPatientTreatments();
        setViewMode('view_plan');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al crear plan de tratamiento');
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Iniciar prescripción de nueva rutina
  const handleStartCreateRoutine = () => {
    if (!selectedTreatment) return;
    setRoutineIdToEdit(null);
    setRoutineName(`Rutina Fase ${routines.length + 1}`);
    setRoutineDescription('');
    setRoutineStatus('active');
    setChangeReason('');
    setRoutineNotes('');
    setRoutineItems([]);
    setViewMode('edit_routine');
  };

  // Iniciar edición de rutina existente
  const handleStartEditRoutine = (routine: any) => {
    setRoutineIdToEdit(routine.id);
    setRoutineName(routine.name);
    setRoutineDescription(routine.description || '');
    setRoutineStatus(routine.status === 'draft' ? 'draft' : 'active');
    setChangeReason('');
    setRoutineNotes(routine.notes || '');

    // Formatear ejercicios de la rutina
    const formatted: RoutineExerciseItem[] = (routine.exercises || []).map((ex: any, idx: number) => ({
      exerciseId: ex.exercise_id || ex.exerciseId,
      name: ex.exercise_name || ex.name || 'Ejercicio',
      category: ex.exercise_category || ex.category,
      bodyZone: ex.body_zone || ex.bodyZone,
      difficultyLevel: ex.difficulty_level || ex.difficultyLevel,
      sets: ex.sets ?? 3,
      repetitions: ex.repetitions ?? 10,
      durationSeconds: ex.duration_seconds ?? ex.durationSeconds ?? null,
      restSeconds: ex.rest_seconds ?? ex.restSeconds ?? 60,
      weeklyFrequency: ex.weekly_frequency || ex.weeklyFrequency || '3 veces por semana',
      bodySide: ex.body_side || ex.bodySide || 'Bilateral',
      resistanceLoad: ex.resistance_load || ex.resistanceLoad || null,
      customInstructions: ex.custom_instructions || ex.customInstructions || null,
      executionOrder: ex.execution_order ?? idx + 1
    }));

    setRoutineItems(formatted);
    setViewMode('edit_routine');
  };

  // Agregar ejercicio desde catálogo a la rutina
  const handleAddExerciseToRoutine = (ex: any) => {
    // Si ya está, permitir o avisar (en kinesiología se puede permitir o evitar duplicados)
    const exists = routineItems.some((item) => item.exerciseId === ex.id);
    if (exists) {
      setErrorMsg(`"${ex.name}" ya se encuentra agregado a esta rutina.`);
      return;
    }
    setErrorMsg(null);

    const newItem: RoutineExerciseItem = {
      exerciseId: ex.id,
      name: ex.name,
      category: ex.category,
      bodyZone: ex.body_zone || ex.bodyZone,
      difficultyLevel: ex.difficulty_level || ex.difficultyLevel,
      sets: ex.default_sets ?? ex.defaultSets ?? 3,
      repetitions: ex.default_repetitions ?? ex.defaultRepetitions ?? 10,
      durationSeconds: null,
      restSeconds: 60,
      weeklyFrequency: '3 veces por semana',
      bodySide: 'Bilateral',
      resistanceLoad: ex.equipment_needed ? `Con ${ex.equipment_needed}` : 'Peso corporal',
      customInstructions: '',
      executionOrder: routineItems.length + 1
    };

    setRoutineItems([...routineItems, newItem]);
  };

  // Remover ejercicio de la rutina
  const handleRemoveExerciseFromRoutine = (index: number) => {
    const updated = routineItems.filter((_, i) => i !== index);
    // Renumerar orden
    const reordered = updated.map((item, idx) => ({ ...item, executionOrder: idx + 1 }));
    setRoutineItems(reordered);
  };

  // Mover ejercicio arriba
  const handleMoveExerciseUp = (index: number) => {
    if (index === 0) return;
    const items = [...routineItems];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    const reordered = items.map((item, idx) => ({ ...item, executionOrder: idx + 1 }));
    setRoutineItems(reordered);
  };

  // Mover ejercicio abajo
  const handleMoveExerciseDown = (index: number) => {
    if (index === routineItems.length - 1) return;
    const items = [...routineItems];
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    const reordered = items.map((item, idx) => ({ ...item, executionOrder: idx + 1 }));
    setRoutineItems(reordered);
  };

  // Modificar campo de ejercicio individual
  const handleUpdateItemField = (index: number, field: keyof RoutineExerciseItem, value: any) => {
    const items = [...routineItems];
    items[index] = { ...items[index], [field]: value };
    setRoutineItems(items);
  };

  // Guardar Rutina (Crear o Actualizar con Versionado)
  const handleSaveRoutine = async () => {
    if (!selectedTreatment?.id) return;
    if (!routineName.trim()) {
      setErrorMsg('El nombre de la rutina es obligatorio.');
      return;
    }
    if (routineItems.length === 0) {
      setErrorMsg('Debe incluir al menos 1 ejercicio en la prescripción terapéutica.');
      return;
    }

    setSavingRoutine(true);
    setErrorMsg(null);
    try {
      const payloadExercises = routineItems.map((item, idx) => ({
        exerciseId: item.exerciseId,
        name: item.name?.trim() || undefined,
        customName: item.name?.trim() || undefined,
        sets: Number(item.sets) || 3,
        repetitions: Number(item.repetitions) || 10,
        durationSeconds: item.durationSeconds ? Number(item.durationSeconds) : null,
        restSeconds: Number(item.restSeconds) || 60,
        weeklyFrequency: item.weeklyFrequency || '3 veces por semana',
        bodySide: item.bodySide || 'Bilateral',
        resistanceLoad: item.resistanceLoad?.trim() || null,
        customInstructions: item.customInstructions?.trim() || null,
        executionOrder: idx + 1
      }));

      if (routineIdToEdit) {
        // Actualización / Versionado
        const res = await apiClient.post('/treatments/routines/update', {
          id: routineIdToEdit,
          name: routineName.trim(),
          description: routineDescription.trim() || null,
          status: routineStatus,
          changeReason: changeReason.trim() || 'Ajuste de prescripción clínica',
          notes: routineNotes.trim() || null,
          exercises: payloadExercises
        });

        if (res.data?.success) {
          setSuccessMsg('Cambios guardados.');
          await fetchTreatmentDetail(selectedTreatment.id);
          setViewMode('view_plan');
          if (onSuccess) onSuccess();
        }
      } else {
        // Creación
        const res = await apiClient.post('/treatments/routines', {
          treatmentId: selectedTreatment.id,
          name: routineName.trim(),
          description: routineDescription.trim() || null,
          status: routineStatus,
          notes: routineNotes.trim() || null,
          exercises: payloadExercises
        });

        if (res.data?.success) {
          setSuccessMsg('Rutina guardada.');
          await fetchTreatmentDetail(selectedTreatment.id);
          setViewMode('view_plan');
          if (onSuccess) onSuccess();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al persistir la rutina clínica');
    } finally {
      setSavingRoutine(false);
    }
  };

  // Cargar datos de seguimiento y evolución integral
  const fetchTrackingData = useCallback(async () => {
    if (!patient?.id) return;
    setLoadingTracking(true);
    try {
      const res = await apiClient.post('/treatments/patient-tracking', {
        patientId: patient.id,
        treatmentId: selectedTreatment?.id || undefined
      });
      if (res.data?.success) {
        setTrackingData(res.data.data);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al obtener seguimiento del paciente');
    } finally {
      setLoadingTracking(false);
    }
  }, [patient?.id, selectedTreatment?.id]);

  // Iniciar registro de sesión clínica
  const handleStartSessionRecord = () => {
    if (!selectedTreatment) {
      setErrorMsg('Seleccione o cree un plan de tratamiento antes de registrar sesiones.');
      return;
    }
    const nextNum = (selectedTreatment.sessions_completed_count || 0) + 1;
    setSessionNumber(String(nextNum));
    setSessionDate(new Date().toISOString().slice(0, 10));
    setSessionProcedures('Terapia manual y supervisión de ejercicios activos.');
    setSessionEvolution('Paciente con buena tolerancia mecánica y control neuromuscular.');
    setSessionPain(3);
    setSessionObservations('');

    // Si hay una rutina seleccionada con ejercicios, precargarlos con valores prescritos
    if (selectedRoutine && selectedRoutine.exercises && selectedRoutine.exercises.length > 0) {
      const preloaded = selectedRoutine.exercises.map((re: any) => ({
        exerciseId: re.exercise_id,
        name: re.exercise_name || re.name,
        routineExerciseId: re.id,
        setsCompleted: String(re.sets || 3),
        repsCompleted: String(re.repetitions || 10),
        resistanceLoad: re.resistance_load || 'Peso corporal',
        toleranceLevel: 'Buena',
        painLevelReported: 2,
        clinicalObservations: '',
        futureModificationsSuggested: ''
      }));
      setSessionExercises(preloaded);
    } else {
      setSessionExercises([]);
    }

    setViewMode('session_record');
  };

  // Guardar sesión clínica y ejecuciones
  const handleSaveSession = async () => {
    if (!selectedTreatment?.id) return;
    if (!sessionProcedures.trim()) {
      setErrorMsg('Ingrese los procedimientos realizados en la sesión.');
      return;
    }
    if (!sessionEvolution.trim()) {
      setErrorMsg('Describa la evolución observada en el paciente.');
      return;
    }

    setSavingSession(true);
    setErrorMsg(null);
    try {
      const payload = {
        treatmentId: selectedTreatment.id,
        sessionNumber: Number(sessionNumber) || 1,
        sessionDate: `${sessionDate} 10:00:00`,
        performedProcedures: sessionProcedures.trim(),
        patientEvolution: sessionEvolution.trim(),
        painLevelReported: sessionPain !== null ? Number(sessionPain) : undefined,
        observations: sessionObservations.trim() || undefined,
        routineId: selectedRoutine?.id || undefined,
        exercises: sessionExercises.map((se) => ({
          exerciseId: se.exerciseId,
          routineExerciseId: se.routineExerciseId || undefined,
          setsCompleted: Number(se.setsCompleted) || 1,
          repsCompleted: Number(se.repsCompleted) || 1,
          resistanceLoad: se.resistanceLoad ? String(se.resistanceLoad).trim() : undefined,
          toleranceLevel: se.toleranceLevel || 'Buena',
          painLevelReported: se.painLevelReported !== null ? Number(se.painLevelReported) : undefined,
          clinicalObservations: se.clinicalObservations ? String(se.clinicalObservations).trim() : undefined,
          futureModificationsSuggested: se.futureModificationsSuggested ? String(se.futureModificationsSuggested).trim() : undefined
        }))
      };

      const res = await apiClient.post('/treatments/sessions', payload);
      if (res.data?.success) {
        setSuccessMsg('Sesión registrada.');
        await fetchTreatmentDetail(selectedTreatment.id);
        await fetchTrackingData();
        setViewMode('tracking_evolution');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al guardar la sesión clínica');
    } finally {
      setSavingSession(false);
    }
  };

  // Abrir historial de versiones
  const handleOpenVersionHistory = async (routine: any) => {
    try {
      const res = await apiClient.post('/treatments/routines/detail', { id: routine.id });
      if (res.data?.success) {
        setRoutineHistory(res.data.data?.versions || []);
        setSelectedRoutine(res.data.data);
        setViewMode('version_history');
      }
    } catch (err: any) {
      setErrorMsg('Error al obtener el historial de versiones');
    }
  };

  // Alternar estado de la rutina (ej. activar o finalizar)
  const handleToggleRoutineStatus = async (routine: any, targetStatus: 'active' | 'completed' | 'draft') => {
    try {
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? { ...r, status: targetStatus } : r))
      );
      if (selectedRoutine && selectedRoutine.id === routine.id) {
        setSelectedRoutine({ ...selectedRoutine, status: targetStatus });
      }
      const res = await apiClient.post('/treatments/routines/status', {
        id: routine.id,
        status: targetStatus
      });
      if (res.data?.success) {
        setSuccessMsg('Cambios guardados.');
        await fetchTreatmentDetail(selectedTreatment.id);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al cambiar estado de la rutina');
    }
  };

  // Sincronizar en memoria la rutina actualizada sin recargar la página
  const syncRoutineInState = (updatedRoutine: any) => {
    if (!updatedRoutine?.id) return;
    setSelectedRoutine(updatedRoutine);
    const exCount = Array.isArray(updatedRoutine.exercises) ? updatedRoutine.exercises.length : 0;
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === updatedRoutine.id
          ? {
              ...r,
              ...updatedRoutine,
              exercises_count: exCount
            }
          : r
      )
    );
  };

  // 1. Iniciar edición individual de un ejercicio dentro de una rutina existente
  const handleStartEditIndividualExercise = (routineId: number, ex: any) => {
    setErrorMsg(null);
    setConfirmDeleteRoutineExercise(null);
    setAddingExerciseToRoutineId(null);
    setEditingRoutineExercise({
      routineId,
      routineExerciseId: ex.id,
      exerciseId: ex.exercise_id || ex.exerciseId,
      name: ex.exercise_name || ex.name || '',
      sets: String(ex.sets ?? 3),
      repetitions: String(ex.repetitions ?? 10),
      durationSeconds: ex.duration_seconds !== null && ex.duration_seconds !== undefined ? String(ex.duration_seconds) : '',
      restSeconds: String(ex.rest_seconds ?? 60),
      weeklyFrequency: ex.weekly_frequency || '3 veces por semana',
      bodySide: ex.body_side || 'Bilateral',
      resistanceLoad: ex.resistance_load || '',
      customInstructions: ex.custom_instructions || '',
      executionOrder: String(ex.execution_order ?? 1)
    });
  };

  const handleSaveIndividualExercise = async () => {
    if (!editingRoutineExercise) return;
    const { routineId, routineExerciseId } = editingRoutineExercise;

    const trimmedName = editingRoutineExercise.name.trim();
    if (trimmedName.length < 2) {
      setErrorMsg('El nombre del ejercicio debe tener al menos 2 caracteres.');
      return;
    }
    const setsNum = Number(editingRoutineExercise.sets);
    if (!Number.isInteger(setsNum) || setsNum <= 0) {
      setErrorMsg('Las series deben ser un número mayor a 0.');
      return;
    }
    const repsNum = Number(editingRoutineExercise.repetitions);
    if (!Number.isInteger(repsNum) || repsNum <= 0) {
      setErrorMsg('Las repeticiones deben ser un número mayor a 0.');
      return;
    }
    const restNum = Number(editingRoutineExercise.restSeconds || 0);
    if (!Number.isInteger(restNum) || restNum < 0) {
      setErrorMsg('El descanso debe ser 0 o mayor.');
      return;
    }
    const durStr = editingRoutineExercise.durationSeconds.trim();
    const durNum = durStr ? Number(durStr) : null;
    if (durNum !== null && (!Number.isInteger(durNum) || durNum <= 0)) {
      setErrorMsg('El tiempo de ejecución debe ser mayor a 0 segundos.');
      return;
    }
    const orderNum = Number(editingRoutineExercise.executionOrder || 1);

    setSavingIndividualExercise(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.patch(
        `/treatments/routines/${routineId}/exercises/${routineExerciseId}`,
        {
          routineId,
          routineExerciseId,
          name: trimmedName,
          customName: trimmedName,
          sets: setsNum,
          repetitions: repsNum,
          durationSeconds: durNum,
          restSeconds: restNum,
          weeklyFrequency: editingRoutineExercise.weeklyFrequency.trim() || '3 veces por semana',
          bodySide: editingRoutineExercise.bodySide,
          resistanceLoad: editingRoutineExercise.resistanceLoad.trim() || null,
          customInstructions: editingRoutineExercise.customInstructions.trim() || null,
          executionOrder: Number.isInteger(orderNum) && orderNum > 0 ? orderNum : undefined
        }
      );

      if (res.data?.success && res.data?.data) {
        syncRoutineInState(res.data.data);
        setEditingRoutineExercise(null);
        setSuccessMsg('Cambios guardados.');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al actualizar el ejercicio');
    } finally {
      setSavingIndividualExercise(false);
    }
  };

  // 2. Eliminar un ejercicio individual con confirmación previa
  const handleConfirmDeleteIndividualExercise = async () => {
    if (!confirmDeleteRoutineExercise) return;
    const { routineId, routineExerciseId } = confirmDeleteRoutineExercise;

    setDeletingExerciseId(routineExerciseId);
    setErrorMsg(null);
    try {
      const res = await apiClient.delete(
        `/treatments/routines/${routineId}/exercises/${routineExerciseId}`,
        {
          data: { routineId, routineExerciseId }
        }
      );

      if (res.data?.success && res.data?.data) {
        syncRoutineInState(res.data.data);
        setConfirmDeleteRoutineExercise(null);
        if (editingRoutineExercise?.routineExerciseId === routineExerciseId) {
          setEditingRoutineExercise(null);
        }
        setSuccessMsg('Ejercicio eliminado.');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al eliminar el ejercicio');
    } finally {
      setDeletingExerciseId(null);
    }
  };

  // 3. Agregar un nuevo ejercicio a una rutina existente
  const handleOpenAddExerciseToRoutine = (routine: any) => {
    setErrorMsg(null);
    setEditingRoutineExercise(null);
    setConfirmDeleteRoutineExercise(null);
    if (addingExerciseToRoutineId === routine.id) {
      setAddingExerciseToRoutineId(null);
      setNewRoutineExerciseDraft(null);
      return;
    }
    setAddingExerciseToRoutineId(routine.id);
    const nextOrder =
      selectedRoutine?.id === routine.id && Array.isArray(selectedRoutine.exercises)
        ? selectedRoutine.exercises.length + 1
        : Number(routine.exercises_count || 0) + 1;
    setNewRoutineExerciseDraft({
      exerciseId: null,
      name: '',
      sets: '3',
      repetitions: '10',
      durationSeconds: '',
      restSeconds: '60',
      weeklyFrequency: '3 veces por semana',
      bodySide: 'Bilateral',
      resistanceLoad: 'Peso corporal',
      customInstructions: '',
      executionOrder: String(nextOrder)
    });
    if (selectedRoutine?.id !== routine.id) {
      fetchRoutineDetail(routine.id);
    }
  };

  const handleSelectCatalogForExistingRoutine = (ex: any, currentExercisesCount: number) => {
    setNewRoutineExerciseDraft({
      exerciseId: ex.id,
      name: ex.name || '',
      sets: String(ex.default_sets ?? ex.defaultSets ?? 3),
      repetitions: String(ex.default_repetitions ?? ex.defaultRepetitions ?? 10),
      durationSeconds: '',
      restSeconds: '60',
      weeklyFrequency: '3 veces por semana',
      bodySide: 'Bilateral',
      resistanceLoad: ex.equipment_needed ? `Con ${ex.equipment_needed}` : 'Peso corporal',
      customInstructions: '',
      executionOrder: String(currentExercisesCount + 1)
    });
  };

  const handleSaveNewExerciseInRoutine = async (routineId: number) => {
    if (!newRoutineExerciseDraft || !newRoutineExerciseDraft.exerciseId) {
      setErrorMsg('Seleccioná un ejercicio del catálogo.');
      return;
    }
    const trimmedName = newRoutineExerciseDraft.name.trim();
    if (trimmedName.length < 2) {
      setErrorMsg('El nombre del ejercicio debe tener al menos 2 caracteres.');
      return;
    }
    const setsNum = Number(newRoutineExerciseDraft.sets);
    if (!Number.isInteger(setsNum) || setsNum <= 0) {
      setErrorMsg('Las series deben ser mayores a 0.');
      return;
    }
    const repsNum = Number(newRoutineExerciseDraft.repetitions);
    if (!Number.isInteger(repsNum) || repsNum <= 0) {
      setErrorMsg('Las repeticiones deben ser mayores a 0.');
      return;
    }
    const restNum = Number(newRoutineExerciseDraft.restSeconds || 0);
    if (!Number.isInteger(restNum) || restNum < 0) {
      setErrorMsg('El descanso debe ser 0 o mayor.');
      return;
    }
    const durStr = newRoutineExerciseDraft.durationSeconds.trim();
    const durNum = durStr ? Number(durStr) : null;
    if (durNum !== null && (!Number.isInteger(durNum) || durNum <= 0)) {
      setErrorMsg('El tiempo de ejecución debe ser mayor a 0 segundos.');
      return;
    }
    const orderNum = Number(newRoutineExerciseDraft.executionOrder || 1);

    setAddingIndividualExercise(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.post(`/treatments/routines/${routineId}/exercises`, {
        routineId,
        exerciseId: newRoutineExerciseDraft.exerciseId,
        name: trimmedName,
        customName: trimmedName,
        sets: setsNum,
        repetitions: repsNum,
        durationSeconds: durNum,
        restSeconds: restNum,
        weeklyFrequency: newRoutineExerciseDraft.weeklyFrequency.trim() || '3 veces por semana',
        bodySide: newRoutineExerciseDraft.bodySide,
        resistanceLoad: newRoutineExerciseDraft.resistanceLoad.trim() || null,
        customInstructions: newRoutineExerciseDraft.customInstructions.trim() || null,
        executionOrder: Number.isInteger(orderNum) && orderNum > 0 ? orderNum : undefined
      });

      if (res.data?.success && res.data?.data) {
        syncRoutineInState(res.data.data);
        setAddingExerciseToRoutineId(null);
        setNewRoutineExerciseDraft(null);
        setSuccessMsg('Ejercicio agregado.');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al agregar el ejercicio a la rutina');
    } finally {
      setAddingIndividualExercise(false);
    }
  };

  // 4. Reordenar un ejercicio individual dentro de una rutina existente
  const handleMoveExistingRoutineExercise = async (
    routineId: number,
    ex: any,
    direction: 'up' | 'down',
    totalCount: number
  ) => {
    const currentOrder = Number(ex.execution_order || 1);
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    if (targetOrder < 1 || targetOrder > totalCount) return;

    setReorderingExerciseId(ex.id);
    setErrorMsg(null);
    try {
      const res = await apiClient.patch(
        `/treatments/routines/${routineId}/exercises/${ex.id}`,
        {
          routineId,
          routineExerciseId: ex.id,
          executionOrder: targetOrder
        }
      );
      if (res.data?.success && res.data?.data) {
        syncRoutineInState(res.data.data);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Error al reordenar el ejercicio');
    } finally {
      setReorderingExerciseId(null);
    }
  };

  const getDifficultyVariant = (diff?: string): BadgeVariant => {
    const d = String(diff || '').toLowerCase();
    switch (d) {
      case 'bajo': return 'success';
      case 'medio': case 'moderado': return 'warning';
      case 'alto': case 'avanzado': return 'error';
      default: return 'neutral';
    }
  };

  const patientFullName = patient ? `${patient.last_name || ''}, ${patient.first_name || ''}`.trim() : '';

  const subNavNode = (viewMode === 'view_plan' || viewMode === 'tracking_evolution' || viewMode === 'session_record') ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.modalSubNav}
      style={[styles.modalSubNavScroll, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
    >
      <TouchableOpacity
        style={[
          styles.modalSubNavItem,
          viewMode === 'view_plan' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }
        ]}
        onPress={() => setViewMode('view_plan')}
        accessibilityRole="button"
        accessibilityLabel="Pestaña Plan y Rutinas"
      >
        <MaterialIcons name="assignment" size={17} color={viewMode === 'view_plan' ? theme.primary : theme.textMuted} />
        <Text style={[styles.modalSubNavText, { color: viewMode === 'view_plan' ? theme.primary : theme.textSecondary }]}>
          Plan y Rutinas
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modalSubNavItem,
          viewMode === 'tracking_evolution' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }
        ]}
        onPress={() => {
          setViewMode('tracking_evolution');
          fetchTrackingData();
        }}
        accessibilityRole="button"
        accessibilityLabel="Pestaña Seguimiento y Evolución"
      >
        <MaterialIcons name="timeline" size={17} color={viewMode === 'tracking_evolution' ? theme.primary : theme.textMuted} />
        <Text style={[styles.modalSubNavText, { color: viewMode === 'tracking_evolution' ? theme.primary : theme.textSecondary }]}>
          Seguimiento y Evolución
        </Text>
      </TouchableOpacity>

      {selectedTreatment && (
        <TouchableOpacity
          style={[
            styles.modalSubNavItem,
            viewMode === 'session_record' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }
          ]}
          onPress={handleStartSessionRecord}
          accessibilityRole="button"
          accessibilityLabel="Pestaña Registrar Sesión"
        >
          <MaterialIcons name="add-task" size={17} color={viewMode === 'session_record' ? theme.primary : theme.textMuted} />
          <Text style={[styles.modalSubNavText, { color: viewMode === 'session_record' ? theme.primary : theme.textSecondary }]}>
            Registrar Sesión
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  ) : undefined;

  return (
    <ModalWrapper
      visible={visible}
      title="Plan y Rutinas"
      subtitle={`${patientFullName} (DNI ${patient?.dni || 'S/D'})`}
      onClose={onClose}
      maxWidth={780}
      subHeader={subNavNode}
      footer={
        <View style={styles.footerRow}>
          {viewMode === 'view_plan' ? (
            <>
              <Button title="Cerrar" variant="secondary" size="md" onPress={onClose} />
              {selectedTreatment && (
                <Button
                  title="+ Prescribir Rutina"
                  size="md"
                  onPress={handleStartCreateRoutine}
                />
              )}
            </>
          ) : viewMode === 'tracking_evolution' ? (
            <>
              <Button title="Cerrar" variant="secondary" size="md" onPress={onClose} />
              {selectedTreatment && (
                <Button
                  title="+ Registrar Sesión"
                  size="md"
                  onPress={handleStartSessionRecord}
                />
              )}
            </>
          ) : viewMode === 'session_record' ? (
            <>
              <Button
                title="Cancelar"
                variant="secondary"
                size="md"
                onPress={() => setViewMode('view_plan')}
              />
              <Button
                title="Guardar Sesión"
                size="md"
                loading={savingSession}
                onPress={handleSaveSession}
              />
            </>
          ) : viewMode === 'edit_routine' ? (
            <>
              <Button
                title="Volver"
                variant="secondary"
                size="md"
                onPress={() => setViewMode('view_plan')}
              />
              <Button
                title="Guardar Rutina"
                size="md"
                loading={savingRoutine}
                onPress={handleSaveRoutine}
              />
            </>
          ) : viewMode === 'create_plan' ? (
            <>
              <Button
                title="Cancelar"
                variant="secondary"
                size="md"
                onPress={() => setViewMode('view_plan')}
              />
              <Button
                title="Crear Plan"
                size="md"
                loading={submittingPlan}
                onPress={handleSavePlan}
              />
            </>
          ) : (
            <Button
              title="Volver"
              variant="secondary"
              size="md"
              onPress={() => setViewMode('view_plan')}
            />
          )}
        </View>
      }
    >
      {/* Banners de estado */}
      {errorMsg && (
        <View style={[styles.feedbackBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
          <MaterialIcons name="error-outline" size={18} color={theme.error} style={{ marginRight: spacing.xs }} />
          <Text style={[styles.feedbackText, { color: theme.error }]}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => setErrorMsg(null)}>
            <MaterialIcons name="close" size={16} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}

      {successMsg && (
        <View style={[styles.feedbackBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
          <MaterialIcons name="check-circle" size={18} color={theme.success} style={{ marginRight: spacing.xs }} />
          <Text style={[styles.feedbackText, { color: theme.success }]}>{successMsg}</Text>
          <TouchableOpacity onPress={() => setSuccessMsg(null)}>
            <MaterialIcons name="close" size={16} color={theme.success} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <LoadingState message="Cargando..." />
      ) : viewMode === 'create_plan' ? (
        /* ======================================================== */
        /* VISTA 1: CREAR NUEVO PLAN DE TRATAMIENTO                 */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: spacing.sm }]}>Nuevo Plan de Tratamiento</Text>

          <Input
            label="Título o diagnóstico principal"
            value={newPlanTitle}
            onChangeText={setNewPlanTitle}
            placeholder="Ej: Rehabilitación de Tendinopatía Manguito Rotador"
            required
          />

          <Input
            label="Resumen del diagnóstico y evaluación funcional"
            value={newPlanDiagnosis}
            onChangeText={setNewPlanDiagnosis}
            placeholder="Fase del dolor, limitaciones biomecánicas y hallazgos"
            multiline
            numberOfLines={2}
            required
          />

          <Input
            label="Objetivos terapéuticos del plan"
            value={newPlanObjectives}
            onChangeText={setNewPlanObjectives}
            placeholder="Recuperar ROM completo, desinflamación y retorno deportivo"
            multiline
            numberOfLines={2}
            required
          />

          <Input
            label="Cantidad estimada de sesiones previstas"
            value={newPlanSessions}
            onChangeText={setNewPlanSessions}
            keyboardType="numeric"
            placeholder="10"
          />
        </View>
      ) : viewMode === 'edit_routine' ? (
        /* ======================================================== */
        /* VISTA 2: FORMULARIO DE PRESCRIPCIÓN Y EDICIÓN DE RUTINAS  */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          <View style={styles.editHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {routineIdToEdit ? 'Editar Rutina Terapéutica' : 'Prescribir Nueva Rutina'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Plan: <Text style={{ color: theme.text, fontWeight: '600' }}>{selectedTreatment?.title}</Text>
              </Text>
            </View>
            <View style={styles.statusToggleGroup}>
              <TouchableOpacity
                style={[
                  styles.statusChipBtn,
                  {
                    backgroundColor: routineStatus === 'active' ? theme.primary : theme.surface,
                    borderColor: routineStatus === 'active' ? theme.primary : theme.border
                  }
                ]}
                onPress={() => setRoutineStatus('active')}
              >
                <Text style={{ color: routineStatus === 'active' ? '#FFF' : theme.text, fontSize: 11, fontWeight: '600' }}>
                  Activa (Vigente)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusChipBtn,
                  {
                    backgroundColor: routineStatus === 'draft' ? theme.warning : theme.surface,
                    borderColor: routineStatus === 'draft' ? theme.warning : theme.border
                  }
                ]}
                onPress={() => setRoutineStatus('draft')}
              >
                <Text style={{ color: routineStatus === 'draft' ? '#FFF' : theme.text, fontSize: 11, fontWeight: '600' }}>
                  Borrador
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Input
            label="Nombre de la rutina"
            value={routineName}
            onChangeText={setRoutineName}
            placeholder="Ej: Fase 1: Control Motor y Movilidad Articular"
            required
          />

          {routineIdToEdit && (
            <Input
              label="Motivo del cambio clínico / progresión (auditoría médica)"
              value={changeReason}
              onChangeText={setChangeReason}
              placeholder="Ej: Paciente refiere cese de dolor, se avanza a carga excéntrica"
            />
          )}

          <Input
            label="Indicaciones globales o recomendaciones domiciliarias"
            value={routineNotes}
            onChangeText={setRoutineNotes}
            placeholder="Ej: Realizar 1 vez por día, aplicar hielo local en caso de molestia"
          />

          {/* LISTA DE EJERCICIOS EN LA RUTINA */}
          <View style={styles.routineItemsHeaderRow}>
            <Text style={[styles.subHeading, { color: theme.text }]}>
              Ejercicios Prescritos ({routineItems.length})
            </Text>
          </View>

          {routineItems.length === 0 ? (
            <View style={[styles.emptyItemsBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <MaterialIcons name="playlist-add" size={32} color={theme.textMuted} style={{ marginBottom: 4 }} />
              <Text style={[styles.emptyItemsTitle, { color: theme.textSecondary }]}>
                Sin ejercicios en la rutina
              </Text>
              <Text style={[styles.emptyItemsDesc, { color: theme.textMuted }]}>
                Agregá ejercicios desde el catálogo inferior.
              </Text>
            </View>
          ) : (
            routineItems.map((item, index) => (
              <Card
                key={`${item.exerciseId}-${index}`}
                elevated
                style={[styles.itemCard, { borderColor: theme.border }]}
                padding="md"
              >
                {/* Cabecera del ejercicio con orden y controles */}
                <View style={styles.itemHeader}>
                  <View style={styles.orderBadgeCol}>
                    <View style={[styles.orderNumberCircle, { backgroundColor: theme.primary }]}>
                      <Text style={styles.orderNumberText}>{item.executionOrder}</Text>
                    </View>
                    <View style={styles.reorderArrows}>
                      <TouchableOpacity
                        onPress={() => handleMoveExerciseUp(index)}
                        disabled={index === 0}
                        style={{ opacity: index === 0 ? 0.3 : 1 }}
                      >
                        <MaterialIcons name="arrow-upward" size={16} color={theme.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveExerciseDown(index)}
                        disabled={index === routineItems.length - 1}
                        style={{ opacity: index === routineItems.length - 1 ? 0.3 : 1 }}
                      >
                        <MaterialIcons name="arrow-downward" size={16} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                    <View style={styles.itemBadges}>
                      {item.category && <Badge label={item.category} variant="default" size="sm" />}
                      {item.bodyZone && <Badge label={item.bodyZone} variant="info" size="sm" />}
                      <Badge label={`Nivel: ${item.difficultyLevel || 'Bajo'}`} variant={getDifficultyVariant(item.difficultyLevel)} size="sm" />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemoveExerciseFromRoutine(index)}
                    style={[styles.removeItemBtn, { borderColor: theme.error + '50', backgroundColor: theme.errorBg }]}
                    accessibilityLabel="Quitar ejercicio"
                  >
                    <MaterialIcons name="delete-outline" size={18} color={theme.error} />
                    <Text style={{ fontSize: typography.fontSize.xs, color: theme.error, fontWeight: '700', marginLeft: 4 }}>
                      Quitar
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Parámetros configurables del ejercicio */}
                <View style={[styles.paramGrid, { borderTopColor: theme.border }]}>
                  {/* Nombre del ejercicio editable */}
                  <View style={{ marginBottom: spacing.xs }}>
                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Nombre del ejercicio:</Text>
                    <Input
                      value={item.name}
                      onChangeText={(v) => handleUpdateItemField(index, 'name', v)}
                      placeholder="Nombre del ejercicio"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>

                  {/* Fila 1: Series, Reps, Tiempo, Descanso */}
                  <View style={styles.paramRow}>
                    <View style={styles.paramCol}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Series:</Text>
                      <Input
                        value={String(item.sets)}
                        onChangeText={(v) => handleUpdateItemField(index, 'sets', Number(v) || 0)}
                        keyboardType="numeric"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <View style={styles.paramCol}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Repeticiones:</Text>
                      <Input
                        value={String(item.repetitions)}
                        onChangeText={(v) => handleUpdateItemField(index, 'repetitions', Number(v) || 0)}
                        keyboardType="numeric"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <View style={styles.paramCol}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Tiempo (seg):</Text>
                      <Input
                        value={item.durationSeconds ? String(item.durationSeconds) : ''}
                        onChangeText={(v) => handleUpdateItemField(index, 'durationSeconds', v ? Number(v) : null)}
                        keyboardType="numeric"
                        placeholder="Opc."
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <View style={styles.paramCol}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Descanso (seg):</Text>
                      <Input
                        value={String(item.restSeconds)}
                        onChangeText={(v) => handleUpdateItemField(index, 'restSeconds', Number(v) || 0)}
                        keyboardType="numeric"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                  </View>

                  {/* Fila 2: Lado corporal, Carga, Frecuencia */}
                  <View style={styles.paramRow}>
                    <View style={styles.paramCol}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Lado:</Text>
                      <View style={styles.sideButtonsRow}>
                        {(['Bilateral', 'Izquierdo', 'Derecho'] as const).map((side) => (
                          <TouchableOpacity
                            key={side}
                            style={[
                              styles.sideBtn,
                              {
                                backgroundColor: item.bodySide === side ? theme.primary : theme.surface,
                                borderColor: item.bodySide === side ? theme.primary : theme.border
                              }
                            ]}
                            onPress={() => handleUpdateItemField(index, 'bodySide', side)}
                          >
                            <Text style={{ fontSize: typography.fontSize.xs, color: item.bodySide === side ? '#FFF' : theme.text, fontWeight: '600' }}>
                              {side}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={[styles.paramCol, { flex: 1.2 }]}>
                      <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Peso / Carga:</Text>
                      <Input
                        value={item.resistanceLoad || ''}
                        onChangeText={(v) => handleUpdateItemField(index, 'resistanceLoad', v)}
                        placeholder="Ej: Banda azul / 2kg"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                  </View>

                  {/* Fila 3: Indicaciones personalizadas */}
                  <View style={{ marginTop: spacing.xs }}>
                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Observaciones / Indicaciones:</Text>
                    <Input
                      value={item.customInstructions || ''}
                      onChangeText={(v) => handleUpdateItemField(index, 'customInstructions', v)}
                      placeholder="Ej: Ejecutar sin elevar el hombro; detener si dolor > 3/10"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
              </Card>
            ))
          )}

          {/* CATÁLOGO DE EJERCICIOS PARA SELECCIONAR */}
          <View style={[styles.catalogSectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.catalogSectionHeader}>
              <MaterialIcons name="search" size={20} color={theme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.catalogSectionTitle, { color: theme.text }]}>
                Biblioteca Clínica — Agregar Ejercicios
              </Text>
            </View>

            <Input
              placeholder="Buscar en el catálogo por nombre, zona o técnica..."
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              containerStyle={{ marginBottom: spacing.sm }}
            />

            {/* Chips de zona corporal para filtro rápido */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogChipsScroll}>
              {['', 'Hombro', 'Columna Lumbar', 'Pelvis / Cadera', 'Rodilla', 'Tobillo / Pie', 'Cervical', 'Core'].map((zone) => (
                <TouchableOpacity
                  key={zone}
                  style={[
                    styles.catalogFilterChip,
                    {
                      backgroundColor: catalogZone === zone ? theme.primary : theme.background,
                      borderColor: catalogZone === zone ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setCatalogZone(catalogZone === zone ? '' : zone)}
                >
                  <Text style={{ fontSize: 11, color: catalogZone === zone ? '#FFF' : theme.text, fontWeight: '500' }}>
                    {zone === '' ? 'Todas las zonas' : zone}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {catalogLoading ? (
              <ActivityIndicator color={theme.primary} style={{ marginVertical: spacing.md }} />
            ) : catalogExercises.length === 0 ? (
              <Text style={[styles.catalogEmptyText, { color: theme.textMuted }]}>
                No se encontraron ejercicios con los términos de búsqueda.
              </Text>
            ) : (
              catalogExercises.map((ex) => {
                const isAlreadyIn = routineItems.some((item) => item.exerciseId === ex.id);
                return (
                  <View
                    key={ex.id}
                    style={[
                      styles.catalogExerciseRow,
                      {
                        borderBottomColor: theme.border,
                        backgroundColor: isAlreadyIn ? theme.primary + '08' : 'transparent'
                      }
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={[styles.catalogExName, { color: theme.text }]}>{ex.name}</Text>
                      <View style={styles.catalogExBadges}>
                        {ex.category && <Badge label={ex.category} variant="default" size="sm" />}
                        {(ex.bodyZone || ex.body_zone) && (
                          <Badge label={ex.bodyZone || ex.body_zone} variant="info" size="sm" />
                        )}
                        <Badge label={`Nivel: ${ex.difficultyLevel || ex.difficulty_level || 'Bajo'}`} variant={getDifficultyVariant(ex.difficultyLevel || ex.difficulty_level)} size="sm" />
                      </View>
                    </View>

                    <Button
                      title={isAlreadyIn ? 'Agregado' : '+ Agregar'}
                      variant={isAlreadyIn ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={isAlreadyIn}
                      onPress={() => handleAddExerciseToRoutine(ex)}
                    />
                  </View>
                );
              })
            )}
          </View>
        </View>
      ) : viewMode === 'version_history' ? (
        /* ======================================================== */
        /* VISTA 3: HISTORIAL AUDITABLE DE VERSIONES DE LA RUTINA   */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          <View style={styles.historyHeaderRow}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Historial de versiones</Text>
            <TouchableOpacity onPress={() => setViewMode('view_plan')} style={styles.backLink}>
              <MaterialIcons name="arrow-back" size={16} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                Volver
              </Text>
            </TouchableOpacity>
          </View>

          {routineHistory.map((ver) => (
            <Card key={ver.id} elevated style={styles.versionCard} padding="md">
              <View style={styles.versionCardHeader}>
                <View style={styles.versionBadgeRow}>
                  <Badge label={`Versión ${ver.version}`} variant={ver.is_current ? 'success' : 'neutral'} size="md" />
                  {ver.is_current ? (
                    <Badge label="Rutina Vigente" variant="success" size="sm" />
                  ) : (
                    <Badge label={ver.status} variant="neutral" size="sm" />
                  )}
                </View>
                <Text style={[styles.versionDate, { color: theme.textMuted }]}>
                  {new Date(ver.created_at).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>

              <Text style={[styles.versionName, { color: theme.text }]}>{ver.name}</Text>
              {ver.change_reason ? (
                <View style={[styles.changeReasonBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.changeReasonLabel, { color: theme.textMuted }]}>Fundamento clínico del cambio:</Text>
                  <Text style={[styles.changeReasonText, { color: theme.text }]}>{ver.change_reason}</Text>
                </View>
              ) : null}

              <Text style={[styles.versionFooterText, { color: theme.textSecondary }]}>
                {ver.exercises_count} ejercicios prescritos por Lic. {ver.kinesiologist_name} {ver.kinesiologist_last_name}
              </Text>
            </Card>
          ))}
        </View>
      ) : viewMode === 'session_record' ? (
        /* ======================================================== */
        /* VISTA: REGISTRAR SESIÓN CLÍNICA CON EJERCICIOS          */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Registrar Sesión</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Plan: <Text style={{ color: theme.text, fontWeight: '700' }}>{selectedTreatment?.title}</Text>
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Número de sesión"
                value={sessionNumber}
                onChangeText={setSessionNumber}
                keyboardType="numeric"
                required
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateInput
                label="Fecha de la sesión"
                value={sessionDate}
                onChangeDate={setSessionDate}
                required
              />
            </View>
          </View>

          <Input
            label="Procedimientos y técnicas realizadas"
            value={sessionProcedures}
            onChangeText={setSessionProcedures}
            placeholder="Ej: Terapia manual articular, liberación miofascial y prescripción activa"
            multiline
            numberOfLines={2}
            required
          />

          <Input
            label="Evolución y respuesta del paciente"
            value={sessionEvolution}
            onChangeText={setSessionEvolution}
            placeholder="Ej: Tolera flexión profunda de cadera, menor dolor que en sesión anterior"
            multiline
            numberOfLines={2}
            required
          />

          <Text style={[styles.inputLabel, { color: theme.text, marginTop: spacing.xs }]}>
            Nivel de dolor general reportado en la sesión (0 = Sin dolor, 10 = Máximo):
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.xs }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = sessionPain === score;
              const col = score <= 3 ? theme.success : score <= 6 ? theme.warning : theme.error;
              return (
                <TouchableOpacity
                  key={score}
                  onPress={() => setSessionPain(score)}
                  style={[
                    styles.scoreChip,
                    {
                      backgroundColor: isSelected ? col : theme.surface,
                      borderColor: isSelected ? col : theme.border
                    }
                  ]}
                >
                  <Text style={{ color: isSelected ? '#FFF' : theme.text, fontWeight: '700', fontSize: 13 }}>
                    {score}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Input
            label="Observaciones adicionales (opcional)"
            value={sessionObservations}
            onChangeText={setSessionObservations}
            placeholder="Indicaciones para el hogar o aspectos biomecánicos destacados"
          />

          {/* EJERCICIOS EVALUADOS EN LA SESIÓN */}
          <View style={styles.routineItemsHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subHeading, { color: theme.text }]}>
                Ejercicios en Sesión ({sessionExercises.length})
              </Text>
            </View>
            {selectedRoutine?.exercises?.length > 0 && (
              <Button
                title="Cargar de rutina"
                size="sm"
                variant="outline"
                onPress={() => {
                  const preloaded = selectedRoutine.exercises.map((re: any) => ({
                    exerciseId: re.exercise_id,
                    name: re.exercise_name || re.name,
                    routineExerciseId: re.id,
                    setsCompleted: String(re.sets || 3),
                    repsCompleted: String(re.repetitions || 10),
                    resistanceLoad: re.resistance_load || 'Peso corporal',
                    toleranceLevel: 'Buena',
                    painLevelReported: 2,
                    clinicalObservations: '',
                    futureModificationsSuggested: ''
                  }));
                  setSessionExercises(preloaded);
                }}
              />
            )}
          </View>

          {sessionExercises.length === 0 ? (
            <View style={[styles.emptyItemsBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <MaterialIcons name="fitness-center" size={28} color={theme.textMuted} style={{ marginBottom: 4 }} />
              <Text style={[styles.emptyItemsTitle, { color: theme.textSecondary }]}>
                Sin ejercicios cargados para esta sesión
              </Text>
              <Text style={[styles.emptyItemsDesc, { color: theme.textMuted }]}>
                Presione "Cargar de rutina" para documentar la ejecución supervisada de la prescripción actual.
              </Text>
            </View>
          ) : (
            sessionExercises.map((seItem, sIdx) => (
              <Card key={`${seItem.exerciseId}-${sIdx}`} elevated style={styles.sessionExCard} padding="md">
                <View style={styles.sessionExHeader}>
                  <Text style={[styles.itemName, { color: theme.text, flex: 1 }]}>
                    #{sIdx + 1} {seItem.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSessionExercises(sessionExercises.filter((_, i) => i !== sIdx));
                    }}
                    style={styles.removeItemBtn}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={theme.error} />
                  </TouchableOpacity>
                </View>

                {/* Parámetros: Series, Reps, Carga */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Series"
                      value={String(seItem.setsCompleted)}
                      onChangeText={(val) => {
                        const copy = [...sessionExercises];
                        copy[sIdx].setsCompleted = val;
                        setSessionExercises(copy);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Reps"
                      value={String(seItem.repsCompleted)}
                      onChangeText={(val) => {
                        const copy = [...sessionExercises];
                        copy[sIdx].repsCompleted = val;
                        setSessionExercises(copy);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Input
                      label="Carga/Resistencia"
                      value={seItem.resistanceLoad || ''}
                      onChangeText={(val) => {
                        const copy = [...sessionExercises];
                        copy[sIdx].resistanceLoad = val;
                        setSessionExercises(copy);
                      }}
                      placeholder="Mancuerna 4kg"
                    />
                  </View>
                </View>

                {/* Tolerancia Clínica Observada */}
                <Text style={[styles.paramLabel, { color: theme.textSecondary, marginTop: 4 }]}>
                  Tolerancia clínica observada:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                  {(['Excelente', 'Buena', 'Regular', 'Mala', 'Intolerancia'] as const).map((tol) => {
                    const isTol = seItem.toleranceLevel === tol;
                    const tolColor = tol === 'Excelente' || tol === 'Buena' ? theme.success : tol === 'Regular' ? theme.warning : theme.error;
                    return (
                      <TouchableOpacity
                        key={tol}
                        onPress={() => {
                          const copy = [...sessionExercises];
                          copy[sIdx].toleranceLevel = tol;
                          setSessionExercises(copy);
                        }}
                        style={[
                          styles.toleranceChip,
                          {
                            backgroundColor: isTol ? tolColor : theme.surface,
                            borderColor: isTol ? tolColor : theme.border
                          }
                        ]}
                      >
                        <Text style={{ color: isTol ? '#FFF' : theme.text, fontSize: 11, fontWeight: '600' }}>
                          {tol}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Observaciones y Modificaciones futuras */}
                <Input
                  label="Observaciones clínicas de ejecución"
                  value={seItem.clinicalObservations || ''}
                  onChangeText={(val) => {
                    const copy = [...sessionExercises];
                    copy[sIdx].clinicalObservations = val;
                    setSessionExercises(copy);
                  }}
                  placeholder="Ej: Buena alineación, fatiga en última repetición"
                />

                <Input
                  label="Modificaciones para próximas sesiones"
                  value={seItem.futureModificationsSuggested || ''}
                  onChangeText={(val) => {
                    const copy = [...sessionExercises];
                    copy[sIdx].futureModificationsSuggested = val;
                    setSessionExercises(copy);
                  }}
                  placeholder="Ej: Progresar carga o añadir repeticiones"
                />
              </Card>
            ))
          )}
        </View>
      ) : viewMode === 'tracking_evolution' ? (
        /* ======================================================== */
        /* VISTA: SEGUIMIENTO Y EVOLUCIÓN CLÍNICA INTEGRAL         */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          <View style={styles.trackingHeaderRow}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <View style={styles.titleWithIconRow}>
                <MaterialIcons name="insights" size={20} color={theme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Seguimiento y Evolución</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={fetchTrackingData}
              style={[styles.refreshTrackingBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              accessibilityLabel="Refrescar seguimiento"
            >
              <MaterialIcons name="refresh" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {loadingTracking ? (
            <LoadingState message="Cargando..." />
          ) : !trackingData ? (
            <EmptyState
              title="Sin registros de evolución"
            />
          ) : (
            <>
              {/* Tarjetas de Métricas Factuales en Strip Desplazable Horizontal */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.metricsScrollContainer}
                style={styles.metricsScrollView}
              >
                <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.metricIconCircle, { backgroundColor: theme.primaryLight + '25' }]}>
                    <MaterialIcons name="assignment" size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.metricNumber, { color: theme.primary }]}>
                    {trackingData.summaryMetrics?.totalRoutinesPrescribed || 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.text }]}>Rutinas Prescritas</Text>
                  <View style={[styles.metricSubBadge, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={[styles.metricSubText, { color: theme.textSecondary }]}>
                      {trackingData.summaryMetrics?.currentRoutinesCount || 0} vigentes
                    </Text>
                  </View>
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.metricIconCircle, { backgroundColor: theme.successBg }]}>
                    <MaterialIcons name="medical-services" size={18} color={theme.success} />
                  </View>
                  <Text style={[styles.metricNumber, { color: theme.success }]}>
                    {trackingData.summaryMetrics?.totalProfessionalSessionsConducted || 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.text }]}>Sesiones en Clínica</Text>
                  <View style={[styles.metricSubBadge, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={[styles.metricSubText, { color: theme.textSecondary }]}>
                      {trackingData.summaryMetrics?.totalExercisesExecutedInClinic || 0} ejerc. evaluados
                    </Text>
                  </View>
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.metricIconCircle, { backgroundColor: theme.infoBg }]}>
                    <MaterialIcons name="home" size={18} color={theme.info} />
                  </View>
                  <Text style={[styles.metricNumber, { color: theme.info }]}>
                    {trackingData.summaryMetrics?.totalPatientLogsReported || 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.text }]}>Reportes Hogar</Text>
                  <View style={[styles.metricSubBadge, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={[styles.metricSubText, { color: theme.textSecondary }]}>
                      Autónomos por paciente
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Filtros de Eventos Horizontales */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContainer}
                style={styles.filterScrollView}
              >
                {[
                  {
                    key: 'all',
                    label: 'Todo el Expediente',
                    icon: 'all-inclusive',
                    count: (trackingData.professionalSessions?.length || 0) +
                           (trackingData.patientReportedLogs?.length || 0) +
                           (trackingData.routines?.length || 0)
                  },
                  {
                    key: 'sessions',
                    label: 'Sesiones Clínicas',
                    icon: 'medical-services',
                    count: trackingData.professionalSessions?.length || 0
                  },
                  {
                    key: 'patient_logs',
                    label: 'Reportes Hogar',
                    icon: 'home',
                    count: trackingData.patientReportedLogs?.length || 0
                  },
                  {
                    key: 'routines',
                    label: 'Prescripciones',
                    icon: 'fitness-center',
                    count: trackingData.routines?.length || 0
                  }
                ].map((f) => {
                  const active = trackingFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setTrackingFilter(f.key as any)}
                      style={[
                        styles.trackingFilterChip,
                        {
                          backgroundColor: active ? theme.primary : theme.surface,
                          borderColor: active ? theme.primary : theme.border
                        }
                      ]}
                    >
                      <MaterialIcons
                        name={f.icon as any}
                        size={14}
                        color={active ? '#FFF' : theme.textSecondary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.filterChipText, { color: active ? '#FFF' : theme.text }]}>
                        {f.label}
                      </Text>
                      <View
                        style={[
                          styles.filterCountBadge,
                          { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.surfaceSubtle }
                        ]}
                      >
                        <Text style={[styles.filterCountText, { color: active ? '#FFF' : theme.textSecondary }]}>
                          {f.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 1. SECCIÓN SESIONES CLÍNICAS SUPERVISADAS */}
              {(trackingFilter === 'all' || trackingFilter === 'sessions') && (
                <View style={styles.trackingSectionBlock}>
                  <View style={styles.sectionHeaderLine}>
                    <MaterialIcons name="medical-services" size={17} color={theme.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.subHeading, { color: theme.text }]}>
                      Sesiones Clínicas con Supervisión Profesional ({trackingData.professionalSessions?.length || 0})
                    </Text>
                  </View>

                  {(!trackingData.professionalSessions || trackingData.professionalSessions.length === 0) ? (
                    <Card elevated padding="md" style={styles.emptyNoticeCard}>
                      <MaterialIcons name="event-note" size={28} color={theme.textMuted} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyNoticeTitle, { color: theme.text }]}>
                        Sin sesiones supervisadas registradas
                      </Text>
                      <Text style={[styles.emptyNoticeSubtitle, { color: theme.textSecondary }]}>
                        Presione "+ Registrar Sesión" para documentar la primera intervención clínica con ejercicios supervisados.
                      </Text>
                      {selectedTreatment && (
                        <Button
                          title="+ Registrar Sesión Ahora"
                          size="sm"
                          variant="outline"
                          style={{ marginTop: spacing.sm }}
                          onPress={handleStartSessionRecord}
                        />
                      )}
                    </Card>
                  ) : (
                    trackingData.professionalSessions.map((session: any) => (
                      <Card key={session.id} elevated style={styles.evolutionEventCard} padding="md">
                        {/* Cabecera del Evento de Sesión */}
                        <View style={styles.eventHeaderTop}>
                          <View style={styles.eventTitleRow}>
                            <View style={[styles.eventIconCircle, { backgroundColor: theme.successBg }]}>
                              <MaterialIcons name="medical-services" size={18} color={theme.success} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.eventTitle, { color: theme.text }]}>
                                Sesión #{session.session_number} • {new Date(session.session_date).toLocaleDateString('es-AR', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </Text>
                              <Text style={[styles.eventSubtitle, { color: theme.textSecondary }]}>
                                Lic. {session.kinesiologist_name} {session.kinesiologist_last_name} • Plan: {session.treatment_title}
                              </Text>
                            </View>
                          </View>

                          {/* Fila de Badges con Wrap Seguro */}
                          <View style={styles.badgeWrapRow}>
                            <Badge label="Supervisado en Clínica" variant="success" size="sm" />
                            {session.pain_level_reported !== null && (
                              <Badge
                                label={`Dolor EVA: ${session.pain_level_reported}/10`}
                                variant={session.pain_level_reported <= 3 ? 'success' : session.pain_level_reported <= 6 ? 'warning' : 'error'}
                                size="sm"
                              />
                            )}
                          </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: theme.border }]} />

                        {/* Bloque Clínico de Evolución Observada */}
                        <View style={[styles.clinicalNoteBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                          <View style={styles.clinicalNoteHeader}>
                            <MaterialIcons name="insights" size={16} color={theme.primary} style={{ marginRight: 6 }} />
                            <Text style={[styles.clinicalNoteTitle, { color: theme.primary }]}>Evolución del Paciente:</Text>
                          </View>
                          <Text style={[styles.clinicalNoteBody, { color: theme.text }]}>{session.patient_evolution}</Text>
                        </View>

                        {/* Procedimientos y Técnicas */}
                        {session.performed_procedures ? (
                          <View style={styles.clinicalSubSection}>
                            <View style={styles.subSectionHeader}>
                              <MaterialIcons name="healing" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
                              <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Procedimientos realizados:</Text>
                            </View>
                            <Text style={[styles.eventText, { color: theme.textSecondary }]}>{session.performed_procedures}</Text>
                          </View>
                        ) : null}

                        {/* Observaciones Adicionales */}
                        {session.observations ? (
                          <View style={styles.clinicalSubSection}>
                            <View style={styles.subSectionHeader}>
                              <MaterialIcons name="notes" size={14} color={theme.textMuted} style={{ marginRight: 4 }} />
                              <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Observaciones profesionales:</Text>
                            </View>
                            <Text style={[styles.eventText, { color: theme.textSecondary }]}>{session.observations}</Text>
                          </View>
                        ) : null}

                        {/* Ejercicios ejecutados en esta sesión */}
                        {session.executedExercises && session.executedExercises.length > 0 && (
                          <View style={[styles.sessionExListWrap, { borderTopColor: theme.border }]}>
                            <View style={styles.sessionExListHeader}>
                              <MaterialIcons name="fitness-center" size={15} color={theme.primary} style={{ marginRight: 5 }} />
                              <Text style={[styles.sessionExListTitle, { color: theme.primary }]}>
                                Ejercicios evaluados en sesión ({session.executedExercises.length}):
                              </Text>
                            </View>

                            {session.executedExercises.map((execEx: any) => (
                              <View key={execEx.id} style={[styles.executedExRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <View style={styles.executedExTopRow}>
                                  <Text style={[styles.executedExName, { color: theme.text }]}>
                                    {execEx.exercise_name}
                                  </Text>
                                  <Badge
                                    label={`Tolerancia: ${execEx.tolerance_level}`}
                                    variant={execEx.tolerance_level === 'Excelente' || execEx.tolerance_level === 'Buena' ? 'success' : execEx.tolerance_level === 'Regular' ? 'warning' : 'error'}
                                    size="sm"
                                  />
                                </View>

                                <View style={styles.miniPillsRow}>
                                  <View style={[styles.miniDataPill, { backgroundColor: theme.surfaceSubtle }]}>
                                    <Text style={[styles.miniDataPillText, { color: theme.textSecondary }]}>
                                      {execEx.sets_completed} series × {execEx.reps_completed} reps
                                    </Text>
                                  </View>
                                  <View style={[styles.miniDataPill, { backgroundColor: theme.surfaceSubtle }]}>
                                    <Text style={[styles.miniDataPillText, { color: theme.textSecondary }]}>
                                      Carga: {execEx.resistance_load || 'Corporal'}
                                    </Text>
                                  </View>
                                  {execEx.pain_level_reported !== null && (
                                    <View style={[styles.miniDataPill, { backgroundColor: theme.surfaceSubtle }]}>
                                      <Text style={[styles.miniDataPillText, { color: execEx.pain_level_reported <= 3 ? theme.success : theme.error }]}>
                                        Dolor: {execEx.pain_level_reported}/10
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {execEx.clinical_observations ? (
                                  <Text style={[styles.executedExObs, { color: theme.textMuted }]}>
                                    Obs: {execEx.clinical_observations}
                                  </Text>
                                ) : null}

                                {execEx.future_modifications_suggested ? (
                                  <View style={styles.executedExModifRow}>
                                    <MaterialIcons name="trending-up" size={13} color={theme.primary} style={{ marginRight: 4 }} />
                                    <Text style={[styles.executedExModif, { color: theme.primary }]}>
                                      Modificación sugerida: {execEx.future_modifications_suggested}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        )}
                      </Card>
                    ))
                  )}
                </View>
              )}

              {/* 2. SECCIÓN CUMPLIMIENTO INFORMADO POR EL PACIENTE (HOGAR) */}
              {(trackingFilter === 'all' || trackingFilter === 'patient_logs') && (
                <View style={styles.trackingSectionBlock}>
                  <View style={styles.sectionHeaderLine}>
                    <MaterialIcons name="home" size={17} color={theme.info} style={{ marginRight: 6 }} />
                    <Text style={[styles.subHeading, { color: theme.text }]}>
                      Cumplimiento Domiciliario Informado por el Paciente ({trackingData.patientReportedLogs?.length || 0})
                    </Text>
                  </View>

                  {(!trackingData.patientReportedLogs || trackingData.patientReportedLogs.length === 0) ? (
                    <Card elevated padding="md" style={styles.emptyNoticeCard}>
                      <MaterialIcons name="home-work" size={28} color={theme.textMuted} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyNoticeTitle, { color: theme.text }]}>
                        Sin registros domiciliarios del paciente
                      </Text>
                      <Text style={[styles.emptyNoticeSubtitle, { color: theme.textSecondary }]}>
                        El paciente aún no ha completado realizaciones autónomas desde su portal de salud.
                      </Text>
                    </Card>
                  ) : (
                    trackingData.patientReportedLogs.map((log: any) => (
                      <Card key={log.id} elevated style={styles.evolutionEventCard} padding="md">
                        <View style={styles.eventHeaderTop}>
                          <View style={styles.eventTitleRow}>
                            <View style={[styles.eventIconCircle, { backgroundColor: theme.infoBg }]}>
                              <MaterialIcons name="home" size={18} color={theme.info} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.eventTitle, { color: theme.text }]}>
                                {log.exercise_name}
                              </Text>
                              <Text style={[styles.eventSubtitle, { color: theme.textSecondary }]}>
                                Realizado: {new Date(log.completed_at || log.completed_date).toLocaleDateString('es-AR', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} • Rutina: {log.routine_name} (v{log.routine_version})
                              </Text>
                            </View>
                          </View>

                          <View style={styles.badgeWrapRow}>
                            <Badge label="Reporte Hogar (Paciente)" variant="info" size="sm" />
                            <Badge
                              label={`Molestia EVA: ${log.perceived_pain_level ?? 0}/10`}
                              variant={log.perceived_pain_level <= 3 ? 'success' : log.perceived_pain_level <= 6 ? 'warning' : 'error'}
                              size="sm"
                            />
                          </View>
                        </View>

                        <View style={styles.miniPillsRow}>
                          {log.sets_completed ? (
                            <View style={[styles.miniDataPill, { backgroundColor: theme.surfaceSubtle }]}>
                              <Text style={[styles.miniDataPillText, { color: theme.textSecondary }]}>
                                {log.sets_completed} series realizadas
                              </Text>
                            </View>
                          ) : null}
                          {log.reps_completed ? (
                            <View style={[styles.miniDataPill, { backgroundColor: theme.surfaceSubtle }]}>
                              <Text style={[styles.miniDataPillText, { color: theme.textSecondary }]}>
                                {log.reps_completed} reps por serie
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {log.patient_notes ? (
                          <View style={[styles.patientNoteQuoteBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                            <MaterialIcons name="chat-bubble-outline" size={15} color={theme.info} style={{ marginRight: 6, marginTop: 1 }} />
                            <Text style={[styles.patientNoteQuote, { color: theme.text }]}>
                              "{log.patient_notes}"
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    ))
                  )}
                </View>
              )}

              {/* 3. SECCIÓN HISTORIAL DE PRESCRIPCIONES Y VERSIONES */}
              {(trackingFilter === 'all' || trackingFilter === 'routines') && (
                <View style={styles.trackingSectionBlock}>
                  <View style={styles.sectionHeaderLine}>
                    <MaterialIcons name="fitness-center" size={17} color={theme.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.subHeading, { color: theme.text }]}>
                      Prescripciones Terapéuticas y Trazabilidad ({trackingData.routines?.length || 0})
                    </Text>
                  </View>

                  {(!trackingData.routines || trackingData.routines.length === 0) ? (
                    <Card elevated padding="md" style={styles.emptyNoticeCard}>
                      <MaterialIcons name="fitness-center" size={28} color={theme.textMuted} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyNoticeTitle, { color: theme.text }]}>
                        Sin rutinas prescritas en el expediente
                      </Text>
                    </Card>
                  ) : (
                    trackingData.routines.map((r: any) => (
                      <Card key={r.id} elevated style={styles.evolutionEventCard} padding="md">
                        <View style={styles.eventHeaderTop}>
                          <View style={styles.eventTitleRow}>
                            <View style={[styles.eventIconCircle, { backgroundColor: r.is_current === 1 ? theme.successBg : theme.surfaceSubtle }]}>
                              <MaterialIcons name="fitness-center" size={18} color={r.is_current === 1 ? theme.success : theme.textMuted} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.eventTitle, { color: theme.text }]}>
                                {r.name} (Versión {r.version})
                              </Text>
                              <Text style={[styles.eventSubtitle, { color: theme.textSecondary }]}>
                                Prescrito por Lic. {r.author_name} {r.author_last_name} • {new Date(r.created_at).toLocaleDateString('es-AR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.badgeWrapRow}>
                            <Badge
                              label={r.is_current === 1 ? 'Versión Vigente' : 'Versión Archivada'}
                              variant={r.is_current === 1 ? 'success' : 'neutral'}
                              size="sm"
                            />
                          </View>
                        </View>

                        {r.change_reason ? (
                          <View style={[styles.changeReasonBox, { backgroundColor: theme.primaryLight + '20', borderColor: theme.primary + '35' }]}>
                            <MaterialIcons name="edit-note" size={17} color={theme.primary} style={{ marginRight: 6 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.changeReasonLabel, { color: theme.primary }]}>Motivo del cambio de versión:</Text>
                              <Text style={[styles.changeReasonText, { color: theme.text }]}>{r.change_reason}</Text>
                            </View>
                          </View>
                        ) : null}

                        <View style={{ marginTop: spacing.xs }}>
                          <Text style={[styles.paramLabel, { color: theme.textMuted, marginBottom: 4 }]}>
                            Ejercicios prescritos ({r.exercises?.length || 0}):
                          </Text>
                          <View style={styles.prescribedExGrid}>
                            {r.exercises?.map((re: any) => (
                              <View key={re.id} style={[styles.prescribedExItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <View style={[styles.prescribedExOrderCircle, { backgroundColor: theme.primary }]}>
                                  <Text style={styles.prescribedExOrderText}>{re.execution_order}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.prescribedExName, { color: theme.text }]}>{re.name}</Text>
                                  <Text style={[styles.prescribedExParams, { color: theme.textSecondary }]}>
                                    {re.sets} series × {re.repetitions} reps • Carga: {re.resistance_load || 'Corporal'}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      ) : (
        /* ======================================================== */
        /* VISTA 4: VISTA GENERAL DEL PLAN Y RUTINAS VIGENTES       */
        /* ======================================================== */
        <View style={styles.viewContentContainer}>
          {treatments.length === 0 ? (
            <EmptyState
              title="Sin plan activo"
              subtitle="Creá un plan para asignar rutinas."
              action={{ label: '+ Crear Plan', onPress: handleStartCreatePlan }}
            />
          ) : (
            <>
              {/* Selector de Planes si existen múltiples */}
              {treatments.length > 1 && (
                <View style={styles.treatmentSelectorRow}>
                  <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Plan seleccionado:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {treatments.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.planTabBtn,
                          {
                            backgroundColor: selectedTreatment?.id === t.id ? theme.primary : theme.surface,
                            borderColor: selectedTreatment?.id === t.id ? theme.primary : theme.border
                          }
                        ]}
                        onPress={() => fetchTreatmentDetail(t.id)}
                      >
                        <Text style={{ color: selectedTreatment?.id === t.id ? '#FFF' : theme.text, fontSize: 12, fontWeight: '600' }}>
                          {t.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Ficha Resumen del Plan */}
              {selectedTreatment && (
                <Card elevated style={styles.planCard} padding="lg">
                  <View style={styles.planCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planTitle, { color: theme.text }]}>{selectedTreatment.title}</Text>
                      <Text style={[styles.planSubtitle, { color: theme.textSecondary }]}>
                        Responsable: Lic. {selectedTreatment.kinesiologist_name} {selectedTreatment.kinesiologist_last_name}
                      </Text>
                    </View>
                    <Badge
                      label={selectedTreatment.status === 'active' ? 'Plan Activo' : selectedTreatment.status}
                      variant={selectedTreatment.status === 'active' ? 'success' : 'neutral'}
                      size="sm"
                    />
                  </View>

                  <View style={[styles.planDetailsGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.planDetailItem}>
                      <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Diagnóstico / Motivo:</Text>
                      <Text style={[styles.planDetailVal, { color: theme.text }]}>{selectedTreatment.diagnosis_summary}</Text>
                    </View>
                    <View style={styles.planDetailItem}>
                      <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Objetivos Terapéuticos:</Text>
                      <Text style={[styles.planDetailVal, { color: theme.text }]}>{selectedTreatment.objectives}</Text>
                    </View>
                  </View>
                </Card>
              )}

              {/* Sección de Rutinas del Plan */}
              <View style={styles.routinesSectionHeader}>
                <View>
                  <Text style={[styles.sectionHeading, { color: theme.text }]}>Rutinas</Text>
                </View>
                <Button
                  title="+ Nueva Rutina"
                  size="sm"
                  variant="outline"
                  onPress={handleStartCreateRoutine}
                />
              </View>

              {routines.length === 0 ? (
                <View style={[styles.emptyRoutinesCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <MaterialIcons name="fitness-center" size={32} color={theme.textMuted} style={{ marginBottom: 6 }} />
                  <Text style={[styles.emptyItemsTitle, { color: theme.text }]}>Sin rutinas prescritas</Text>
                  <Button
                    title="Prescribir Rutina"
                    size="sm"
                    onPress={handleStartCreateRoutine}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                routines.map((routine) => {
                  const isCurrent = routine.is_current === 1;
                  return (
                    <Card
                      key={routine.id}
                      elevated
                      style={[
                        styles.routineCard,
                        isCurrent && { borderColor: theme.primary, borderWidth: 1.5 }
                      ]}
                      padding="lg"
                    >
                      <View style={styles.routineCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.routineTitleRow}>
                            <Text style={[styles.routineNameText, { color: theme.text }]}>{routine.name}</Text>
                            {isCurrent && (
                              <Badge label="Rutina Vigente" variant="success" size="sm" style={{ marginLeft: spacing.xs }} />
                            )}
                            <Badge label={`v${routine.version}`} variant="info" size="sm" style={{ marginLeft: spacing.xs }} />
                          </View>
                          <Text style={[styles.routineMetaText, { color: theme.textMuted }]}>
                            {routine.exercises_count} ejercicios • {routine.status === 'draft' ? 'Borrador' : routine.status === 'active' ? 'En ejecución' : routine.status}
                          </Text>
                        </View>

                        <View style={styles.routineHeaderActions}>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '12' }]}
                            onPress={() => handleOpenAddExerciseToRoutine(routine)}
                            accessibilityLabel="Agregar ejercicio a esta rutina"
                          >
                            <MaterialIcons name="add" size={18} color={theme.primary} />
                            <Text style={{ fontSize: typography.fontSize.xs, color: theme.primary, fontWeight: '700', marginLeft: 4 }}>
                              Ejercicio
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                            onPress={() => handleStartEditRoutine(routine)}
                            accessibilityLabel="Editar rutina"
                          >
                            <MaterialIcons name="edit" size={16} color={theme.text} />
                            <Text style={{ fontSize: typography.fontSize.xs, color: theme.text, fontWeight: '600', marginLeft: 4 }}>
                              Editar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                            onPress={() => handleOpenVersionHistory(routine)}
                            accessibilityLabel="Ver historial de versiones"
                          >
                            <MaterialIcons name="history" size={16} color={theme.text} />
                            <Text style={{ fontSize: typography.fontSize.xs, color: theme.text, fontWeight: '600', marginLeft: 4 }}>
                              Historial
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {routine.description ? (
                        <Text style={[styles.routineDescText, { color: theme.textSecondary }]}>
                          {routine.description}
                        </Text>
                      ) : null}

                      {/* Ejercicios de la rutina con edición, eliminación, orden y alta individual */}
                      {selectedRoutine?.id === routine.id ? (
                        <View style={styles.routineExercisesList}>
                          <View style={styles.routineExHeaderRow}>
                            <Text style={[styles.routineExListTitle, { color: theme.textMuted, marginBottom: 0 }]}>
                              Ejercicios ({selectedRoutine.exercises?.length || 0})
                            </Text>
                            <Button
                              title={addingExerciseToRoutineId === routine.id ? 'Cerrar catálogo' : '+ Agregar ejercicio'}
                              size="sm"
                              variant={addingExerciseToRoutineId === routine.id ? 'secondary' : 'outline'}
                              onPress={() => handleOpenAddExerciseToRoutine(routine)}
                            />
                          </View>

                          {/* Panel para agregar un nuevo ejercicio a esta rutina existente */}
                          {addingExerciseToRoutineId === routine.id && newRoutineExerciseDraft && (
                            <View
                              style={[
                                styles.inlineEditorCard,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.primary }
                              ]}
                            >
                              <Text style={[styles.inlineEditorTitle, { color: theme.primary }]}>
                                Agregar ejercicio a «{routine.name}»
                              </Text>

                              <Input
                                placeholder="Buscar ejercicio en biblioteca clínica..."
                                value={catalogSearch}
                                onChangeText={setCatalogSearch}
                                containerStyle={{ marginBottom: spacing.xs }}
                              />

                              <ScrollView
                                style={{ maxHeight: 150, marginBottom: spacing.sm }}
                                nestedScrollEnabled
                              >
                                {catalogLoading ? (
                                  <ActivityIndicator color={theme.primary} style={{ marginVertical: spacing.sm }} />
                                ) : catalogExercises.length === 0 ? (
                                  <Text style={[styles.catalogEmptyText, { color: theme.textMuted }]}>
                                    Sin ejercicios para mostrar.
                                  </Text>
                                ) : (
                                  catalogExercises.map((catEx) => {
                                    const isChosen = newRoutineExerciseDraft.exerciseId === catEx.id;
                                    return (
                                      <TouchableOpacity
                                        key={catEx.id}
                                        style={[
                                          styles.catalogExerciseRow,
                                          {
                                            borderBottomColor: theme.border,
                                            paddingHorizontal: spacing.xs,
                                            backgroundColor: isChosen ? theme.primary + '15' : 'transparent'
                                          }
                                        ]}
                                        onPress={() =>
                                          handleSelectCatalogForExistingRoutine(
                                            catEx,
                                            selectedRoutine.exercises?.length || 0
                                          )
                                        }
                                      >
                                        <View style={{ flex: 1 }}>
                                          <Text style={[styles.catalogExName, { color: theme.text }]}>
                                            {catEx.name}
                                          </Text>
                                          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                            {catEx.category} {catEx.body_zone ? `• ${catEx.body_zone}` : ''}
                                          </Text>
                                        </View>
                                        <MaterialIcons
                                          name={isChosen ? 'check-circle' : 'add-circle-outline'}
                                          size={20}
                                          color={isChosen ? theme.primary : theme.textMuted}
                                        />
                                      </TouchableOpacity>
                                    );
                                  })
                                )}
                              </ScrollView>

                              {newRoutineExerciseDraft.exerciseId ? (
                                <View style={{ marginTop: spacing.xs }}>
                                  <Input
                                    label="Nombre del ejercicio"
                                    value={newRoutineExerciseDraft.name}
                                    onChangeText={(v) =>
                                      setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, name: v })
                                    }
                                    placeholder="Nombre del ejercicio"
                                  />

                                  <View style={styles.paramRow}>
                                    <View style={styles.paramCol}>
                                      <Input
                                        label="Series"
                                        value={newRoutineExerciseDraft.sets}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, sets: v })
                                        }
                                        keyboardType="numeric"
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                    <View style={styles.paramCol}>
                                      <Input
                                        label="Repeticiones"
                                        value={newRoutineExerciseDraft.repetitions}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, repetitions: v })
                                        }
                                        keyboardType="numeric"
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                    <View style={styles.paramCol}>
                                      <Input
                                        label="Tiempo (seg)"
                                        value={newRoutineExerciseDraft.durationSeconds}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, durationSeconds: v })
                                        }
                                        keyboardType="numeric"
                                        placeholder="Opc."
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                    <View style={styles.paramCol}>
                                      <Input
                                        label="Descanso (seg)"
                                        value={newRoutineExerciseDraft.restSeconds}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, restSeconds: v })
                                        }
                                        keyboardType="numeric"
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                  </View>

                                  <View style={[styles.paramRow, { marginTop: spacing.xs }]}>
                                    <View style={styles.paramCol}>
                                      <Input
                                        label="Peso / Carga"
                                        value={newRoutineExerciseDraft.resistanceLoad}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, resistanceLoad: v })
                                        }
                                        placeholder="Ej: 4kg / Banda"
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                    <View style={{ width: 90 }}>
                                      <Input
                                        label="Orden"
                                        value={newRoutineExerciseDraft.executionOrder}
                                        onChangeText={(v) =>
                                          setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, executionOrder: v })
                                        }
                                        keyboardType="numeric"
                                        containerStyle={{ marginBottom: 0 }}
                                      />
                                    </View>
                                  </View>

                                  <View style={{ marginTop: spacing.xs }}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Lado:</Text>
                                    <View style={styles.sideButtonsRow}>
                                      {(['Bilateral', 'Izquierdo', 'Derecho', 'No aplica'] as const).map((side) => (
                                        <TouchableOpacity
                                          key={side}
                                          style={[
                                            styles.sideBtn,
                                            {
                                              backgroundColor:
                                                newRoutineExerciseDraft.bodySide === side ? theme.primary : theme.surface,
                                              borderColor:
                                                newRoutineExerciseDraft.bodySide === side ? theme.primary : theme.border
                                            }
                                          ]}
                                          onPress={() =>
                                            setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, bodySide: side })
                                          }
                                        >
                                          <Text
                                            style={{
                                              fontSize: typography.fontSize.xs,
                                              color: newRoutineExerciseDraft.bodySide === side ? '#FFF' : theme.text,
                                              fontWeight: '600'
                                            }}
                                          >
                                            {side}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>

                                  <Input
                                    label="Observaciones / Indicaciones"
                                    value={newRoutineExerciseDraft.customInstructions}
                                    onChangeText={(v) =>
                                      setNewRoutineExerciseDraft({ ...newRoutineExerciseDraft, customInstructions: v })
                                    }
                                    placeholder="Indicaciones para este ejercicio"
                                    containerStyle={{ marginTop: spacing.xs, marginBottom: spacing.sm }}
                                  />

                                  <View style={styles.inlineEditorActions}>
                                    <Button
                                      title="Cancelar"
                                      variant="secondary"
                                      size="sm"
                                      onPress={() => {
                                        setAddingExerciseToRoutineId(null);
                                        setNewRoutineExerciseDraft(null);
                                      }}
                                    />
                                    <Button
                                      title="Agregar a la rutina"
                                      size="sm"
                                      loading={addingIndividualExercise}
                                      onPress={() => handleSaveNewExerciseInRoutine(routine.id)}
                                    />
                                  </View>
                                </View>
                              ) : (
                                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                                  Tocá un ejercicio de la lista superior para configurar sus parámetros.
                                </Text>
                              )}
                            </View>
                          )}

                          {(!selectedRoutine.exercises || selectedRoutine.exercises.length === 0) ? (
                            <Text style={{ fontSize: 12, color: theme.textMuted, paddingVertical: spacing.sm }}>
                              Esta rutina no tiene ejercicios asignados. Usá «+ Agregar ejercicio» para incorporar uno.
                            </Text>
                          ) : (
                            selectedRoutine.exercises.map((ex: any, exIdx: number) => {
                              const totalExCount = selectedRoutine.exercises.length;
                              const isEditingThis =
                                editingRoutineExercise?.routineId === routine.id &&
                                editingRoutineExercise?.routineExerciseId === ex.id;
                              const isConfirmingDeleteThis =
                                confirmDeleteRoutineExercise?.routineId === routine.id &&
                                confirmDeleteRoutineExercise?.routineExerciseId === ex.id;

                              return (
                                <View
                                  key={ex.id}
                                  style={[
                                    styles.routineExContainer,
                                    {
                                      backgroundColor: theme.surface,
                                      borderColor: isEditingThis
                                        ? theme.primary
                                        : isConfirmingDeleteThis
                                        ? theme.error
                                        : theme.border
                                    }
                                  ]}
                                >
                                  <View style={styles.routineExRowTop}>
                                    {/* Orden y flechas de reordenamiento */}
                                    <View style={styles.orderBadgeCol}>
                                      <View style={[styles.miniOrderCircle, { backgroundColor: theme.primary }]}>
                                        <Text style={styles.miniOrderText}>{ex.execution_order}</Text>
                                      </View>
                                      {totalExCount > 1 && (
                                        <View style={styles.reorderArrows}>
                                          <TouchableOpacity
                                            disabled={exIdx === 0 || reorderingExerciseId === ex.id}
                                            onPress={() =>
                                              handleMoveExistingRoutineExercise(routine.id, ex, 'up', totalExCount)
                                            }
                                            style={{ opacity: exIdx === 0 ? 0.3 : 1 }}
                                            accessibilityLabel="Subir orden del ejercicio"
                                          >
                                            <MaterialIcons name="arrow-upward" size={14} color={theme.text} />
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            disabled={exIdx === totalExCount - 1 || reorderingExerciseId === ex.id}
                                            onPress={() =>
                                              handleMoveExistingRoutineExercise(routine.id, ex, 'down', totalExCount)
                                            }
                                            style={{ opacity: exIdx === totalExCount - 1 ? 0.3 : 1 }}
                                            accessibilityLabel="Bajar orden del ejercicio"
                                          >
                                            <MaterialIcons name="arrow-downward" size={14} color={theme.text} />
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>

                                    {/* Datos del ejercicio */}
                                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                      <Text style={[styles.routineExName, { color: theme.text }]}>
                                        {ex.exercise_name || ex.name}
                                      </Text>
                                      <Text style={[styles.routineExParams, { color: theme.textSecondary }]}>
                                        {ex.sets} series × {ex.repetitions} reps
                                        {ex.duration_seconds ? ` • Tiempo: ${ex.duration_seconds}s` : ''}
                                        {` • Descanso: ${ex.rest_seconds}s • Lado: ${ex.body_side}`}
                                        {ex.resistance_load ? ` • Carga: ${ex.resistance_load}` : ''}
                                      </Text>
                                      {ex.custom_instructions ? (
                                        <Text style={[styles.routineExNotes, { color: theme.primary }]}>
                                          Nota: {ex.custom_instructions}
                                        </Text>
                                      ) : null}
                                    </View>

                                    {/* Acciones individuales: Editar y Eliminar */}
                                    <View style={styles.routineExActions}>
                                      <TouchableOpacity
                                        style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                                        onPress={() =>
                                          isEditingThis
                                            ? setEditingRoutineExercise(null)
                                            : handleStartEditIndividualExercise(routine.id, ex)
                                        }
                                        accessibilityLabel="Editar ejercicio"
                                      >
                                        <MaterialIcons
                                          name={isEditingThis ? 'close' : 'edit'}
                                          size={16}
                                          color={theme.primary}
                                        />
                                        <Text style={{ fontSize: typography.fontSize.xs, color: theme.primary, fontWeight: '600', marginLeft: 4 }}>
                                          {isEditingThis ? 'Cerrar' : 'Editar'}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.iconBtn, { borderColor: theme.error + '50', backgroundColor: theme.errorBg }]}
                                        onPress={() => {
                                          setEditingRoutineExercise(null);
                                          setConfirmDeleteRoutineExercise(
                                            isConfirmingDeleteThis
                                              ? null
                                              : {
                                                  routineId: routine.id,
                                                  routineExerciseId: ex.id,
                                                  name: ex.exercise_name || ex.name || 'Ejercicio'
                                                }
                                          );
                                        }}
                                        accessibilityLabel="Eliminar ejercicio"
                                      >
                                        <MaterialIcons name="delete-outline" size={16} color={theme.error} />
                                        <Text style={{ fontSize: typography.fontSize.xs, color: theme.error, fontWeight: '600', marginLeft: 4 }}>
                                          Eliminar
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>

                                  {/* Confirmación antes de eliminar este ejercicio individual */}
                                  {isConfirmingDeleteThis && confirmDeleteRoutineExercise && (
                                    <View
                                      style={[
                                        styles.confirmDeleteBox,
                                        { backgroundColor: theme.errorBg, borderColor: theme.error + '50' }
                                      ]}
                                    >
                                      <Text style={[styles.confirmDeleteText, { color: theme.text }]}>
                                        ¿Querés eliminar «{confirmDeleteRoutineExercise.name}» de esta rutina?
                                      </Text>
                                      <View style={styles.inlineEditorActions}>
                                        <Button
                                          title="Cancelar"
                                          variant="secondary"
                                          size="sm"
                                          onPress={() => setConfirmDeleteRoutineExercise(null)}
                                        />
                                        <Button
                                          title="Eliminar"
                                          variant="danger"
                                          size="sm"
                                          loading={deletingExerciseId === ex.id}
                                          onPress={handleConfirmDeleteIndividualExercise}
                                        />
                                      </View>
                                    </View>
                                  )}

                                  {/* Formulario de edición individual en línea */}
                                  {isEditingThis && editingRoutineExercise && (
                                    <View
                                      style={[
                                        styles.inlineEditorForm,
                                        { borderTopColor: theme.border, backgroundColor: theme.surfaceSubtle }
                                      ]}
                                    >
                                      <Input
                                        label="Nombre del ejercicio"
                                        value={editingRoutineExercise.name}
                                        onChangeText={(v) =>
                                          setEditingRoutineExercise({ ...editingRoutineExercise, name: v })
                                        }
                                        placeholder="Nombre del ejercicio"
                                      />

                                      <View style={styles.paramRow}>
                                        <View style={styles.paramCol}>
                                          <Input
                                            label="Series"
                                            value={editingRoutineExercise.sets}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({ ...editingRoutineExercise, sets: v })
                                            }
                                            keyboardType="numeric"
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                        <View style={styles.paramCol}>
                                          <Input
                                            label="Repeticiones"
                                            value={editingRoutineExercise.repetitions}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({
                                                ...editingRoutineExercise,
                                                repetitions: v
                                              })
                                            }
                                            keyboardType="numeric"
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                        <View style={styles.paramCol}>
                                          <Input
                                            label="Tiempo (seg)"
                                            value={editingRoutineExercise.durationSeconds}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({
                                                ...editingRoutineExercise,
                                                durationSeconds: v
                                              })
                                            }
                                            keyboardType="numeric"
                                            placeholder="Opc."
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                        <View style={styles.paramCol}>
                                          <Input
                                            label="Descanso (seg)"
                                            value={editingRoutineExercise.restSeconds}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({
                                                ...editingRoutineExercise,
                                                restSeconds: v
                                              })
                                            }
                                            keyboardType="numeric"
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                      </View>

                                      <View style={[styles.paramRow, { marginTop: spacing.xs }]}>
                                        <View style={styles.paramCol}>
                                          <Input
                                            label="Peso / Carga"
                                            value={editingRoutineExercise.resistanceLoad}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({
                                                ...editingRoutineExercise,
                                                resistanceLoad: v
                                              })
                                            }
                                            placeholder="Ej: 4kg / Banda"
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                        <View style={{ width: 90 }}>
                                          <Input
                                            label="Orden"
                                            value={editingRoutineExercise.executionOrder}
                                            onChangeText={(v) =>
                                              setEditingRoutineExercise({
                                                ...editingRoutineExercise,
                                                executionOrder: v
                                              })
                                            }
                                            keyboardType="numeric"
                                            containerStyle={{ marginBottom: 0 }}
                                          />
                                        </View>
                                      </View>

                                      <View style={{ marginTop: spacing.xs }}>
                                        <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>
                                          Lado:
                                        </Text>
                                        <View style={styles.sideButtonsRow}>
                                          {(['Bilateral', 'Izquierdo', 'Derecho', 'No aplica'] as const).map((side) => (
                                            <TouchableOpacity
                                              key={side}
                                              style={[
                                                styles.sideBtn,
                                                {
                                                  backgroundColor:
                                                    editingRoutineExercise.bodySide === side
                                                      ? theme.primary
                                                      : theme.surface,
                                                  borderColor:
                                                    editingRoutineExercise.bodySide === side
                                                      ? theme.primary
                                                      : theme.border
                                                }
                                              ]}
                                              onPress={() =>
                                                setEditingRoutineExercise({
                                                  ...editingRoutineExercise,
                                                  bodySide: side
                                                })
                                              }
                                            >
                                              <Text
                                                style={{
                                                  fontSize: typography.fontSize.xs,
                                                  color:
                                                    editingRoutineExercise.bodySide === side ? '#FFF' : theme.text,
                                                  fontWeight: '600'
                                                }}
                                              >
                                                {side}
                                              </Text>
                                            </TouchableOpacity>
                                          ))}
                                        </View>
                                      </View>

                                      <Input
                                        label="Observaciones / Indicaciones"
                                        value={editingRoutineExercise.customInstructions}
                                        onChangeText={(v) =>
                                          setEditingRoutineExercise({
                                            ...editingRoutineExercise,
                                            customInstructions: v
                                          })
                                        }
                                        placeholder="Indicaciones para el paciente"
                                        containerStyle={{ marginTop: spacing.xs, marginBottom: spacing.sm }}
                                      />

                                      <View style={styles.inlineEditorActions}>
                                        <Button
                                          title="Cancelar"
                                          variant="secondary"
                                          size="sm"
                                          onPress={() => setEditingRoutineExercise(null)}
                                        />
                                        <Button
                                          title="Guardar cambios"
                                          size="sm"
                                          loading={savingIndividualExercise}
                                          onPress={handleSaveIndividualExercise}
                                        />
                                      </View>
                                    </View>
                                  )}
                                </View>
                              );
                            })
                          )}
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.expandRoutineBtn}
                          onPress={() => fetchRoutineDetail(routine.id)}
                        >
                          <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                            Ver ejercicios ({routine.exercises_count})
                          </Text>
                          <MaterialIcons name="expand-more" size={18} color={theme.primary} />
                        </TouchableOpacity>
                      )}

                      {/* Pie de rutina: cambiar estado */}
                      <View style={[styles.routineFooterRow, { borderTopColor: theme.border }]}>
                        {routine.status === 'active' && !isCurrent && (
                          <Button
                            title="Marcar como Vigente"
                            variant="outline"
                            size="sm"
                            onPress={() => handleToggleRoutineStatus(routine, 'active')}
                          />
                        )}
                        {routine.status === 'active' && (
                          <Button
                            title="Finalizar Rutina"
                            variant="secondary"
                            size="sm"
                            onPress={() => handleToggleRoutineStatus(routine, 'completed')}
                          />
                        )}
                        {routine.status === 'draft' && (
                          <Button
                            title="Activar Borrador"
                            variant="primary"
                            size="sm"
                            onPress={() => handleToggleRoutineStatus(routine, 'active')}
                          />
                        )}
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </View>
      )}
    </ModalWrapper>
  );
};

const styles = StyleSheet.create({
  viewContentContainer: {
    paddingBottom: spacing.lg
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    width: '100%'
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  sectionHeading: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md
  },
  subHeading: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  hintText: {
    fontSize: typography.fontSize.tiny
  },
  treatmentSelectorRow: {
    marginBottom: spacing.md
  },
  planTabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs
  },
  planCard: {
    marginBottom: spacing.lg
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  planTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold
  },
  planSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  planDetailsGrid: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  planDetailItem: {
    marginBottom: spacing.xs
  },
  planDetailVal: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18
  },
  routinesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs
  },
  emptyRoutinesCard: {
    padding: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  emptyItemsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center'
  },
  emptyItemsDesc: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 420
  },
  routineCard: {
    marginBottom: spacing.md
  },
  routineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  routineNameText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold
  },
  routineMetaText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2
  },
  routineHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  smallActionBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  routineDescText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginTop: spacing.xs,
    marginBottom: spacing.sm
  },
  routineExercisesList: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  routineExHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  routineExListTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs
  },
  routineExContainer: {
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
    overflow: 'hidden'
  },
  routineExRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.sm
  },
  routineExActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.xs
  },
  iconBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  inlineEditorCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  inlineEditorTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm
  },
  inlineEditorForm: {
    padding: spacing.md,
    borderTopWidth: 1
  },
  inlineEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  confirmDeleteBox: {
    padding: spacing.sm,
    borderTopWidth: 1
  },
  confirmDeleteText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs
  },
  routineExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.xs
  },
  miniOrderCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center'
  },
  miniOrderText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700'
  },
  routineExName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  routineExParams: {
    fontSize: typography.fontSize.xs,
    marginTop: 1
  },
  routineExNotes: {
    fontSize: typography.fontSize.tiny,
    fontStyle: 'italic',
    marginTop: 2
  },
  expandRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginTop: spacing.xs
  },
  routineFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.sm
  },
  editHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  statusToggleGroup: {
    flexDirection: 'row',
    gap: 4
  },
  statusChipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  routineItemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  emptyItemsBox: {
    padding: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: spacing.md
  },
  itemCard: {
    marginBottom: spacing.sm
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  orderBadgeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  orderNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center'
  },
  orderNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700'
  },
  reorderArrows: {
    gap: 2
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  itemBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2
  },
  removeItemBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  paramGrid: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.sm
  },
  paramRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  paramCol: {
    flex: 1,
    minWidth: 100
  },
  paramLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 4
  },
  sideButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  sideBtn: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  catalogSectionBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    marginBottom: spacing.md
  },
  catalogSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  catalogSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  catalogChipsScroll: {
    marginBottom: spacing.sm
  },
  catalogFilterChip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    marginRight: 8
  },
  catalogEmptyText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    paddingVertical: spacing.md
  },
  catalogExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1
  },
  catalogExName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  catalogExBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  versionCard: {
    marginBottom: spacing.md
  },
  versionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  versionBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center'
  },
  versionDate: {
    fontSize: typography.fontSize.tiny
  },
  versionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs
  },
  changeReasonBox: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  changeReasonLabel: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600'
  },
  changeReasonText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  versionFooterText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs
  },
  modalSubNavScroll: {
    borderBottomWidth: 1
  },
  modalSubNav: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    gap: 4
  },
  modalSubNavItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6
  },
  modalSubNavText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  scoreChip: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6
  },
  sessionExCard: {
    marginBottom: spacing.sm
  },
  sessionExHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  toleranceChip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center'
  },
  trackingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  refreshTrackingBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  metricsScrollView: {
    marginBottom: spacing.md
  },
  metricsScrollContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2
  },
  metricCard: {
    minWidth: 140,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  metricIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  metricNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  metricLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginTop: 2
  },
  metricSubBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginTop: 6
  },
  metricSubText: {
    fontSize: typography.fontSize.tiny,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium
  },
  filterScrollView: {
    marginBottom: spacing.md
  },
  filterScrollContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2
  },
  trackingFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    marginLeft: 6
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700'
  },
  trackingSectionBlock: {
    marginBottom: spacing.lg
  },
  sectionHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  emptyNoticeCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm
  },
  emptyNoticeTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center'
  },
  emptyNoticeSubtitle: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 340
  },
  evolutionEventCard: {
    marginBottom: spacing.sm
  },
  eventHeaderTop: {
    marginBottom: spacing.xs
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  eventIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  eventTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  eventSubtitle: {
    fontSize: typography.fontSize.tiny,
    marginTop: 1
  },
  badgeWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs
  },
  clinicalNoteBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginVertical: spacing.xs
  },
  clinicalNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  clinicalNoteTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  clinicalNoteBody: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18
  },
  clinicalSubSection: {
    marginTop: spacing.xs
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  eventText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 17
  },
  sessionExListWrap: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1
  },
  sessionExListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  sessionExListTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  executedExRow: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: 6
  },
  executedExTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4
  },
  executedExName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    flex: 1
  },
  miniPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4
  },
  miniDataPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm
  },
  miniDataPillText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium
  },
  executedExObs: {
    fontSize: typography.fontSize.tiny,
    fontStyle: 'italic',
    marginTop: 3
  },
  executedExModifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3
  },
  executedExModif: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium
  },
  patientNoteQuoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs
  },
  patientNoteQuote: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    lineHeight: 16,
    flex: 1
  },
  prescribedExGrid: {
    gap: 4,
    marginTop: 2
  },
  prescribedExItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xs
  },
  prescribedExOrderCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  prescribedExOrderText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700'
  },
  prescribedExName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  prescribedExParams: {
    fontSize: typography.fontSize.tiny,
    marginTop: 1
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    marginTop: spacing.xs
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs
  }
});
