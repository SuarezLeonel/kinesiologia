/**
 * @file PatientPortalScreen.tsx
 * @description Pantalla del portal del paciente: ejercicios de Home Care y registro de cumplimiento con escala EVA.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Linking,
  StatusBar as RNStatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';
import {
  fetchBookingCalendarAvailability,
  evaluateDateClient,
  getBookingWindow,
  CalendarDayStatus
} from '../utils/bookingCalendar';

type PortalTab = 'inicio' | 'ejercicios' | 'turnos' | 'servicios' | 'perfil';
type BookingStep = 1 | 2 | 3 | 4 | 5 | 6;

const BOOKING_STEPS: { step: BookingStep; title: string }[] = [
  { step: 1, title: 'Servicio' },
  { step: 2, title: 'Profesional' },
  { step: 3, title: 'Fecha' },
  { step: 4, title: 'Horario' },
  { step: 5, title: 'Revisión' },
  { step: 6, title: 'Confirmar' }
];

const formatLocalDateISO = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatFullSpanishDate = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, day] = dateInput.split('-').map(Number);
    d = new Date(y, m - 1, day, 12, 0, 0);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return String(dateInput);
  const formatted = d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const buildFallbackSlots = (dateStr: string, durationMinutes = 45) => {
  const slots: any[] = [];
  for (let h = 8; h <= 18; h++) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    slots.push({
      startTime: `${dateStr} ${timeStr}:00`,
      time: timeStr,
      timeLabel: timeStr,
      durationMinutes,
      available: true
    });
  }
  return slots;
};

export const PatientPortalScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme } = useAppTheme();
  const { scopeVersions } = useDataSync();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<PortalTab>('inicio');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del portal
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<{ services: any[]; professionals: any[] }>({ services: [], professionals: [] });
  const [profile, setProfile] = useState<any>(null);

  // Estados de rutinas terapéuticas y prescripción de ejercicios
  const [myRoutines, setMyRoutines] = useState<any[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [complianceLogs, setComplianceLogs] = useState<any[]>([]);
  const [showLogsHistory, setShowLogsHistory] = useState(false);

  // Estados del modal de registro de ejercicio informado por el paciente
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [exerciseToLog, setExerciseToLog] = useState<any>(null);
  const [logSets, setLogSets] = useState('');
  const [logReps, setLogReps] = useState('');
  const [logPain, setLogPain] = useState<number | null>(0);
  const [logNotes, setLogNotes] = useState('');
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);

  // Estados de reserva guiada paso a paso (1 a 6)
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>(1);
  const [bookingConfirmedData, setBookingConfirmedData] = useState<any | null>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedKinesiologist, setSelectedKinesiologist] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDateISO(new Date(Date.now() + 86400000)));
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const defaultWindow = React.useMemo(() => getBookingWindow(), []);
  const [bookingMinDate, setBookingMinDate] = useState<string>(defaultWindow.minDate);
  const [bookingMaxDate, setBookingMaxDate] = useState<string>(defaultWindow.maxDate);
  const [calendarByDate, setCalendarByDate] = useState<Record<string, CalendarDayStatus>>({});

  // Estados de cancelación
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Estados de edición de perfil y cambio de contraseña
  const [editPhone, setEditPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: Consultas de negocio por POST
      const [dashRes, apptsRes, catRes, profRes, routinesRes] = await Promise.all([
        apiClient.post('/patient-portal/dashboard', {}),
        apiClient.post('/patient-portal/my-appointments', {}),
        apiClient.post('/patient-portal/catalog', {}),
        apiClient.post('/patient-portal/my-profile', {}),
        apiClient.post('/patient-portal/my-routines', {})
      ]);

      if (dashRes.data?.success) setDashboardData(dashRes.data.data);
      if (apptsRes.data?.success) setMyAppointments(apptsRes.data.data);
      if (catRes.data?.success) setCatalog(catRes.data.data);
      if (profRes.data?.success) {
        setProfile(profRes.data.data);
        setEditPhone(profRes.data.data.phone || '');
      }
      if (routinesRes.data?.success) {
        const routinesList = routinesRes.data.data || [];
        setMyRoutines(routinesList);
        if (routinesList.length > 0) {
          setSelectedRoutineId((prev) => {
            if (prev && routinesList.some((r: any) => r.id === prev)) return prev;
            return routinesList[0].id;
          });
        }
      }
      setError(null);
    } catch (err: any) {
      if (!silent || (!dashboardData && myAppointments.length === 0)) {
        setError(err.response?.data?.error?.message || 'Error al conectar con el portal de pacientes');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useEffect(() => {
    if (scopeVersions.patientPortal > 0) {
      loadData(true);
      if (selectedRoutineId) {
        fetchComplianceLogs(selectedRoutineId);
      }
    }
  }, [scopeVersions.patientPortal]);

  useEffect(() => {
    if (!loading) {
      loadData(true);
      if (activeTab === 'ejercicios' && selectedRoutineId) {
        fetchComplianceLogs(selectedRoutineId);
      }
    }
  }, [activeTab]);

  const fetchAvailableSlots = async (
    kineId: number,
    servId: number,
    dateStr: string,
    customMap?: Record<string, CalendarDayStatus>
  ) => {
    if (!kineId || !servId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const mapToUse = customMap || calendarByDate;
    const evalResult = evaluateDateClient(dateStr, mapToUse, bookingMinDate, bookingMaxDate);
    if (evalResult.disabled) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setBookingError(evalResult.reason || 'El consultorio permanece cerrado en la fecha seleccionada.');
      return;
    }

    setLoadingSlots(true);
    setBookingError(null);
    setSelectedSlot(null);
    try {
      const res = await apiClient.post('/patient-portal/available-slots', {
        kinesiologistId: Number(kineId),
        serviceId: Number(servId),
        date: dateStr
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        setAvailableSlots(list);
        if (list.length > 0) {
          setSelectedSlot(list[0]);
        }
      }
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 300));
        const retryRes = await apiClient.post('/patient-portal/available-slots', {
          kinesiologistId: Number(kineId),
          serviceId: Number(servId),
          date: dateStr
        });
        if (retryRes.data?.success) {
          const list = retryRes.data.data || [];
          setAvailableSlots(list);
          if (list.length > 0) {
            setSelectedSlot(list[0]);
          }
          return;
        }
      } catch {
        const recheck = evaluateDateClient(dateStr, mapToUse, bookingMinDate, bookingMaxDate);
        if (recheck.disabled) {
          setAvailableSlots([]);
          setSelectedSlot(null);
          setBookingError(recheck.reason || 'Fecha no laborable');
          return;
        }
        const fallback = buildFallbackSlots(dateStr, selectedService?.durationMinutes || 45);
        setAvailableSlots(fallback);
        if (fallback.length > 0) {
          setSelectedSlot(fallback[0]);
        }
      }
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleOpenBooking = async (service?: any) => {
    setBookingError(null);
    setBookingSuccess(null);
    setBookingConfirmedData(null);
    setBookingStep(service ? 2 : 1);
    setSelectedSlot(null);
    setBookingNotes('');
    const cal = await fetchBookingCalendarAvailability('patient');
    setBookingMinDate(cal.minDate);
    setBookingMaxDate(cal.maxDate);
    setCalendarByDate(cal.byDate);

    const serv = service || catalog.services[0] || {
      id: 1,
      name: 'Rehabilitación Traumatológica',
      durationMinutes: 45,
      price: 12000,
      currency: 'ARS'
    };
    const prof = catalog.professionals[0] || {
      id: 2,
      fullName: 'Lic. Kinesio, Carlos',
      specialty: 'Kinesiología y Fisioterapia Especializada'
    };
    setSelectedService(serv);
    setSelectedKinesiologist(prof);
    const initialDate = cal.firstAvailableDate;
    setSelectedDate(initialDate);
    setBookModalVisible(true);
    if (prof && serv) {
      fetchAvailableSlots(prof.id, serv.id, initialDate, cal.byDate);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedService || !selectedKinesiologist) {
      setBookingError('Seleccioná un horario disponible.');
      return;
    }
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const res = await apiClient.post('/patient-portal/book-appointment', {
        serviceId: selectedService.id,
        kinesiologistId: selectedKinesiologist.id,
        startTime: selectedSlot.startTime,
        notes: bookingNotes.trim() || undefined
      });
      if (res.data?.success) {
        setBookingSuccess('Turno reservado correctamente.');
        setBookingConfirmedData({
          serviceName: selectedService.name,
          durationMinutes: selectedService.durationMinutes,
          price: selectedService.price,
          currency: selectedService.currency || 'ARS',
          professionalName: selectedKinesiologist.fullName,
          professionalSpecialty: selectedKinesiologist.specialty,
          dateFormatted: formatFullSpanishDate(selectedDate),
          timeLabel: selectedSlot.time || selectedSlot.timeLabel,
          notes: bookingNotes.trim()
        });
        await loadData(true);
      }
    } catch (err: any) {
      setBookingError(err.response?.data?.error?.message || 'No se pudo completar la reserva');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await apiClient.post('/patient-portal/cancel-appointment', {
        appointmentId: appointmentToCancel.id,
        reason: cancelReason.trim() || 'Cancelado por el paciente'
      });
      if (res.data?.success) {
        setMyAppointments((prev) =>
          prev.map((a) => (a.id === appointmentToCancel.id ? { ...a, status: 'cancelled' } : a))
        );
        setCancelModalVisible(false);
        await loadData(true);
      }
    } catch (err: any) {
      setCancelError(err.response?.data?.error?.message || 'Error al cancelar el turno');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    if (!editPhone.trim() || editPhone.trim().length < 6) {
      setProfileError('Ingresá un teléfono válido.');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await apiClient.post('/patient-portal/update-profile', {
        phone: editPhone.trim()
      });
      if (res.data?.success) {
        setProfile(res.data.data);
        setProfileSuccess('Cambios guardados.');
        await loadData(true);
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.error?.message || 'Error al actualizar el teléfono');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword) {
      setPasswordError('Completá este campo.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await apiClient.post('/patient-portal/change-password', {
        currentPassword,
        newPassword
      });
      if (res.data?.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess('Contraseña actualizada.');
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.error?.message || 'Error al cambiar la contraseña');
    } finally {
      setPasswordSaving(false);
    }
  };

  const fetchComplianceLogs = async (routineId?: number) => {
    try {
      const res = await apiClient.post('/patient-portal/my-exercise-logs', {
        routineId: routineId || undefined
      });
      if (res.data?.success) {
        setComplianceLogs(res.data.data || []);
      }
    } catch {
      // Ignorar error no crítico
    }
  };

  const handleOpenLogExercise = (exercise: any) => {
    setExerciseToLog(exercise);
    setLogSets(exercise.sets ? String(exercise.sets) : '3');
    setLogReps(exercise.repetitions ? String(exercise.repetitions) : '10');
    setLogPain(0);
    setLogNotes('');
    setLogError(null);
    setLogSuccess(null);
    setLogModalVisible(true);
  };

  const handleConfirmLogExercise = async () => {
    if (!exerciseToLog) return;
    setLogSubmitting(true);
    setLogError(null);
    setLogSuccess(null);
    try {
      const res = await apiClient.post('/patient-portal/log-exercise', {
        routineExerciseId: exerciseToLog.routine_exercise_id,
        setsCompleted: logSets ? Number(logSets) : undefined,
        repsCompleted: logReps ? Number(logReps) : undefined,
        perceivedPainLevel: logPain !== null ? Number(logPain) : 0,
        patientNotes: logNotes.trim() || undefined
      });
      if (res.data?.success) {
        setLogSuccess('Ejercicio registrado.');
        await Promise.all([
          loadData(true),
          selectedRoutineId ? fetchComplianceLogs(selectedRoutineId) : Promise.resolve()
        ]);
        setTimeout(() => {
          setLogModalVisible(false);
        }, 900);
      }
    } catch (err: any) {
      setLogError(err.response?.data?.error?.message || 'Error al guardar el registro del ejercicio');
    } finally {
      setLogSubmitting(false);
    }
  };

  if (loading && !refreshing && !dashboardData && myAppointments.length === 0) {
    return <LoadingState message="Cargando..." />;
  }
  if (error && !dashboardData && myAppointments.length === 0) {
    return <ErrorState message={error} onRetry={() => loadData(false)} />;
  }

  const nextAppt = dashboardData?.nextAppointment;
  const upcomingAppointments = myAppointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'attended'
  );
  const pastAppointments = myAppointments.filter(
    (a) => a.status === 'cancelled' || a.status === 'attended'
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Encabezado del Portal del Paciente */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            paddingTop:
              Platform.OS === 'web'
                ? spacing.md
                : Math.max(insets.top, RNStatusBar.currentHeight || 0, 28) + spacing.sm
          }
        ]}
      >
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: theme.primaryLight }]}>
            <MaterialIcons name="medical-information" size={26} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandTitle, { color: theme.text }]}>Portal del Paciente</Text>
            <Text style={[styles.brandUser, { color: theme.textSecondary }]}>
              Hola, {profile?.first_name ? `${profile.first_name} ${profile.last_name}` : user?.name}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={logout}
          style={[styles.logoutBtn, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <MaterialIcons name="logout" size={20} color={theme.textSecondary} />
          <Text style={[styles.logoutText, { color: theme.text }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de pestañas principal con indicador claro de sección activa */}
      <View style={[styles.tabsNav, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Inicio"
          accessibilityState={{ selected: activeTab === 'inicio' }}
          style={[
            styles.tabItem,
            activeTab === 'inicio' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 4,
              backgroundColor: theme.primaryLight + '25'
            }
          ]}
          onPress={() => setActiveTab('inicio')}
        >
          <MaterialIcons name="home" size={24} color={activeTab === 'inicio' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'inicio' ? theme.primary : theme.textSecondary }]}>
            Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Mis turnos"
          accessibilityState={{ selected: activeTab === 'turnos' }}
          style={[
            styles.tabItem,
            activeTab === 'turnos' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 4,
              backgroundColor: theme.primaryLight + '25'
            }
          ]}
          onPress={() => setActiveTab('turnos')}
        >
          <MaterialIcons name="event" size={24} color={activeTab === 'turnos' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'turnos' ? theme.primary : theme.textSecondary }]}>
            Mis turnos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Mis ejercicios"
          accessibilityState={{ selected: activeTab === 'ejercicios' }}
          style={[
            styles.tabItem,
            activeTab === 'ejercicios' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 4,
              backgroundColor: theme.primaryLight + '25'
            }
          ]}
          onPress={() => {
            setActiveTab('ejercicios');
            if (selectedRoutineId) fetchComplianceLogs(selectedRoutineId);
          }}
        >
          <MaterialIcons name="fitness-center" size={24} color={activeTab === 'ejercicios' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'ejercicios' ? theme.primary : theme.textSecondary }]}>
            Ejercicios
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Profesionales y servicios"
          accessibilityState={{ selected: activeTab === 'servicios' }}
          style={[
            styles.tabItem,
            activeTab === 'servicios' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 4,
              backgroundColor: theme.primaryLight + '25'
            }
          ]}
          onPress={() => setActiveTab('servicios')}
        >
          <MaterialIcons name="local-hospital" size={24} color={activeTab === 'servicios' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'servicios' ? theme.primary : theme.textSecondary }]}>
            Profesionales
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Mi perfil"
          accessibilityState={{ selected: activeTab === 'perfil' }}
          style={[
            styles.tabItem,
            activeTab === 'perfil' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 4,
              backgroundColor: theme.primaryLight + '25'
            }
          ]}
          onPress={() => setActiveTab('perfil')}
        >
          <MaterialIcons name="person-outline" size={24} color={activeTab === 'perfil' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'perfil' ? theme.primary : theme.textSecondary }]}>
            Mi perfil
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido principal según pestaña */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={theme.primary} />}
      >
        {/* ========================================== */}
        {/* PESTAÑA 1: INICIO */}
        {/* ========================================== */}
        {activeTab === 'inicio' && (
          <View style={styles.sectionContainer}>
            {/* Acciones principales claramente identificables para el paciente */}
            <View style={styles.quickActionsGrid}>
              <Card elevated style={styles.actionCard} padding="lg">
                <View style={[styles.actionIconCircle, { backgroundColor: theme.primaryLight }]}>
                  <MaterialIcons name="add-circle-outline" size={30} color={theme.primary} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Solicitar un turno</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Reservá tu próxima sesión paso a paso.
                </Text>
                <Button
                  title="Solicitar turno"
                  size="md"
                  fullWidth
                  icon={<MaterialIcons name="event-available" size={20} color="#FFF" />}
                  onPress={() => handleOpenBooking()}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              <Card elevated style={styles.actionCard} padding="lg">
                <View style={[styles.actionIconCircle, { backgroundColor: theme.infoBg }]}>
                  <MaterialIcons name="event-note" size={30} color={theme.info} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Mis turnos</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Consultá tus próximos turnos y turnos anteriores.
                </Text>
                <Button
                  title="Ver mis turnos"
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => setActiveTab('turnos')}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              <Card elevated style={styles.actionCard} padding="lg">
                <View style={[styles.actionIconCircle, { backgroundColor: theme.successBg }]}>
                  <MaterialIcons name="fitness-center" size={30} color={theme.success} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Tratamiento y ejercicios</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Revisá las indicaciones y rutina de tu kinesiólogo.
                </Text>
                <Button
                  title="Ver mis ejercicios"
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => {
                    setActiveTab('ejercicios');
                    if (selectedRoutineId) fetchComplianceLogs(selectedRoutineId);
                  }}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              <Card elevated style={styles.actionCard} padding="lg">
                <View style={[styles.actionIconCircle, { backgroundColor: theme.warningBg }]}>
                  <MaterialIcons name="local-hospital" size={30} color={theme.warning} />
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>Profesionales y servicios</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Conocé los especialistas y tipos de consulta.
                </Text>
                <Button
                  title="Ver profesionales"
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => setActiveTab('servicios')}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            </View>

            {/* Tarjeta de Próximo Turno */}
            <Card elevated style={styles.heroCard} padding="lg">
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Tu próximo turno</Text>
                {nextAppt && (
                  <Badge
                    label={nextAppt.status === 'confirmed' ? 'Confirmado' : 'Programado'}
                    variant={nextAppt.status === 'confirmed' ? 'success' : 'info'}
                    size="md"
                  />
                )}
              </View>

              {nextAppt ? (
                <View style={styles.nextApptBody}>
                  <View style={[styles.apptHighlightBox, { backgroundColor: theme.primaryLight + '35', borderColor: theme.primary }]}>
                    <MaterialIcons name="event-available" size={36} color={theme.primary} />
                    <View style={styles.highlightTextCol}>
                      <Text style={[styles.highlightService, { color: theme.primary }]}>
                        {nextAppt.service_name}
                      </Text>
                      <Text style={[styles.highlightTime, { color: theme.text }]}>
                        {formatFullSpanishDate(nextAppt.start_time)} a las{' '}
                        {new Date(nextAppt.start_time).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        hs
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Profesional</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        Lic. {nextAppt.kinesiologist_last_name}, {nextAppt.kinesiologist_name}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Valor de la consulta</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        ${Number(nextAppt.agreed_price).toLocaleString('es-AR')} {nextAppt.currency || 'ARS'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.apptActionsRow}>
                    <Button
                      title="Ver todos mis turnos"
                      variant="outline"
                      size="md"
                      onPress={() => setActiveTab('turnos')}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Cancelar turno"
                      variant="danger"
                      size="md"
                      onPress={() => {
                        setAppointmentToCancel(nextAppt);
                        setCancelModalVisible(true);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.noApptBox}>
                  <MaterialIcons name="calendar-today" size={44} color={theme.textMuted} style={{ marginBottom: spacing.sm }} />
                  <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                    No tenés turnos programados en este momento.
                  </Text>
                  <Button
                    title="Solicitar turno"
                    size="lg"
                    icon={<MaterialIcons name="add-circle-outline" size={22} color="#FFF" />}
                    onPress={() => handleOpenBooking()}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              )}
            </Card>

            {/* Tarjeta de Rutina de Rehabilitación Vigente */}
            <Card elevated style={styles.heroCard} padding="lg">
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <MaterialIcons name="fitness-center" size={24} color={theme.primary} />
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Tu plan de ejercicios</Text>
                  </View>
                  {dashboardData?.activeRoutine?.kinesiologist_name ? (
                    <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: 0, marginTop: 4 }]}>
                      Indicado por Lic. {dashboardData.activeRoutine.kinesiologist_name} {dashboardData.activeRoutine.kinesiologist_last_name}
                    </Text>
                  ) : null}
                </View>
                {dashboardData?.activeRoutine && (
                  <Badge label="Vigente" variant="success" size="md" />
                )}
              </View>

              {dashboardData?.activeRoutine ? (
                <View style={styles.routineOverviewBody}>
                  <View style={[styles.routineOverviewBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                    <Text style={[styles.routineOverviewName, { color: theme.text }]}>
                      {dashboardData.activeRoutine.name}
                    </Text>
                    {dashboardData.activeRoutine.valid_from && (
                      <Text style={[styles.routineValidityText, { color: theme.textSecondary }]}>
                        Desde el {new Date(dashboardData.activeRoutine.valid_from).toLocaleDateString('es-AR')}
                        {dashboardData.activeRoutine.valid_until ? ` hasta el ${new Date(dashboardData.activeRoutine.valid_until).toLocaleDateString('es-AR')}` : ''}
                      </Text>
                    )}
                    {dashboardData.activeRoutine.notes ? (
                      <View style={[styles.indicationCallout, { backgroundColor: theme.infoBg, borderColor: theme.info }]}>
                        <MaterialIcons name="info" size={22} color={theme.info} />
                        <Text style={[styles.indicationText, { color: theme.text, flex: 1 }]}>
                          {dashboardData.activeRoutine.notes}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.routineProgressRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.progressCountText, { color: theme.text }]}>
                          Progreso de hoy: {dashboardData.activeRoutine.completed_today_count || 0} de {dashboardData.activeRoutine.exercises_count || 0} ejercicios realizados
                        </Text>
                        <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                backgroundColor: Number(dashboardData.activeRoutine.completed_today_count) >= Number(dashboardData.activeRoutine.exercises_count) && Number(dashboardData.activeRoutine.exercises_count) > 0 ? theme.success : theme.primary,
                                width: `${Math.min(100, Math.round(((Number(dashboardData.activeRoutine.completed_today_count) || 0) / Math.max(1, Number(dashboardData.activeRoutine.exercises_count) || 1)) * 100))}%`
                              }
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <Button
                    title="Abrir mis ejercicios"
                    icon={<MaterialIcons name="arrow-forward" size={20} color="#FFF" />}
                    size="md"
                    onPress={() => {
                      setActiveTab('ejercicios');
                      if (dashboardData.activeRoutine?.id) {
                        setSelectedRoutineId(dashboardData.activeRoutine.id);
                        fetchComplianceLogs(dashboardData.activeRoutine.id);
                      }
                    }}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              ) : (
                <View style={styles.noApptBox}>
                  <MaterialIcons name="fitness-center" size={44} color={theme.textMuted} style={{ marginBottom: spacing.xs }} />
                  <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                    Todavía no tenés una rutina de ejercicios asignada.
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 2: MIS EJERCICIOS Y RUTINAS */}
        {/* ========================================== */}
        {activeTab === 'ejercicios' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mis ejercicios e indicaciones"
              subtitle="Seguí las indicaciones de tu kinesiólogo paso a paso."
            />

            {myRoutines.length === 0 ? (
              <EmptyState
                title="Sin rutinas asignadas"
                subtitle="Tu kinesiólogo cargará tus ejercicios en la consulta."
              />
            ) : (
              <>
                {/* Selector de rutinas cuando existen múltiples versiones o tratamientos */}
                {myRoutines.length > 1 && (
                  <View style={{ marginBottom: spacing.xs }}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Seleccionar rutina:</Text>
                    <View style={styles.wrappedChipsRow}>
                      {myRoutines.map((r) => {
                        const isSelected = selectedRoutineId === r.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Rutina ${r.name}`}
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => {
                              setSelectedRoutineId(r.id);
                              fetchComplianceLogs(r.id);
                            }}
                            style={[
                              styles.selectChip,
                              {
                                backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                                borderColor: isSelected ? theme.primary : theme.border
                              }
                            ]}
                          >
                            <Text
                              style={{
                                color: isSelected ? '#FFF' : theme.text,
                                fontWeight: isSelected ? '700' : '600',
                                fontSize: typography.fontSize.base
                              }}
                            >
                              {r.name} {r.is_current ? '★ (Vigente)' : `(Versión ${r.version})`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Rutina activa seleccionada */}
                {(() => {
                  const currentRoutine = myRoutines.find((r) => r.id === selectedRoutineId) || myRoutines[0];
                  if (!currentRoutine) return null;

                  return (
                    <View style={{ gap: spacing.lg }}>
                      {/* Cabecera de la rutina */}
                      <Card elevated padding="lg">
                        <View style={styles.cardHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>{currentRoutine.name}</Text>
                            <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: 0 }]}>
                              {currentRoutine.treatment_title ? `Plan: ${currentRoutine.treatment_title} • ` : ''}
                              Lic. {currentRoutine.kinesiologist_name} {currentRoutine.kinesiologist_last_name}
                            </Text>
                          </View>
                          <Badge
                            label={currentRoutine.is_current ? 'Vigente' : currentRoutine.status === 'completed' ? 'Finalizada' : currentRoutine.status}
                            variant={currentRoutine.is_current ? 'success' : 'info'}
                            size="md"
                          />
                        </View>

                        {currentRoutine.description ? (
                          <Text style={[styles.routineDescText, { color: theme.textSecondary }]}>
                            {currentRoutine.description}
                          </Text>
                        ) : null}

                        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: spacing.md }]} />

                        <View style={styles.routineDatesRow}>
                          <View style={styles.routineDateItem}>
                            <MaterialIcons name="event" size={20} color={theme.textSecondary} />
                            <Text style={[styles.gridText, { color: theme.textSecondary }]}>
                              Desde: {currentRoutine.valid_from ? new Date(currentRoutine.valid_from).toLocaleDateString('es-AR') : 'Inicio del tratamiento'}
                            </Text>
                          </View>
                          {currentRoutine.valid_until && (
                            <View style={styles.routineDateItem}>
                              <MaterialIcons name="event-available" size={20} color={theme.textSecondary} />
                              <Text style={[styles.gridText, { color: theme.textSecondary }]}>
                                Próxima revisión: {new Date(currentRoutine.valid_until).toLocaleDateString('es-AR')}
                              </Text>
                            </View>
                          )}
                        </View>

                        {currentRoutine.notes ? (
                          <View style={[styles.indicationCallout, { backgroundColor: theme.primaryLight + '25', borderColor: theme.primary, marginTop: spacing.md }]}>
                            <MaterialIcons name="assignment" size={24} color={theme.primary} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.indicationTitle, { color: theme.primary }]}>Indicaciones del profesional:</Text>
                              <Text style={[styles.indicationText, { color: theme.text }]}>{currentRoutine.notes}</Text>
                            </View>
                          </View>
                        ) : null}
                      </Card>

                      {/* Lista de ejercicios en orden de ejecución */}
                      <Text style={[styles.subHeaderTitle, { color: theme.text, marginTop: spacing.xs }]}>
                        Ejercicios indicados ({currentRoutine.exercises?.length || 0})
                      </Text>

                      {(!currentRoutine.exercises || currentRoutine.exercises.length === 0) ? (
                        <Card elevated padding="lg">
                          <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                            No hay ejercicios listados en esta rutina.
                          </Text>
                        </Card>
                      ) : (
                        currentRoutine.exercises.map((ex: any, idx: number) => {
                          const isDoneToday = Boolean(ex.completed_today && ex.completed_today > 0);

                          return (
                            <Card key={ex.routine_exercise_id || idx} elevated style={styles.exerciseCard} padding="lg">
                              {/* Fila superior: orden secuencial + nombre + badges */}
                              <View style={styles.exerciseHeaderRow}>
                                <View style={[styles.orderBadge, { backgroundColor: theme.primaryLight }]}>
                                  <Text style={[styles.orderBadgeText, { color: theme.primary }]}>{ex.execution_order || idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.exerciseName, { color: theme.text }]}>{ex.name}</Text>
                                  <View style={styles.badgeRow}>
                                    {ex.category && <Badge label={ex.category} variant="info" size="md" />}
                                    {ex.body_zone && <Badge label={ex.body_zone} variant="default" size="md" />}
                                    {ex.difficulty_level && <Badge label={ex.difficulty_level} variant="neutral" size="md" />}
                                  </View>
                                </View>
                                {isDoneToday ? (
                                  <Badge label="✓ Realizado hoy" variant="success" size="md" />
                                ) : (
                                  <Badge label="Pendiente hoy" variant="warning" size="md" />
                                )}
                              </View>

                              {/* Grilla de Parámetros Prescritos */}
                              <View style={[styles.paramsGrid, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                                {ex.sets ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Series</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.sets}</Text>
                                  </View>
                                ) : null}
                                {ex.repetitions ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Repeticiones</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.repetitions}</Text>
                                  </View>
                                ) : null}
                                {ex.duration_seconds ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Duración</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.duration_seconds} seg</Text>
                                  </View>
                                ) : null}
                                {ex.rest_seconds ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Descanso</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.rest_seconds} seg</Text>
                                  </View>
                                ) : null}
                                {ex.weekly_frequency ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Frecuencia</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.weekly_frequency}</Text>
                                  </View>
                                ) : null}
                                {ex.body_side && ex.body_side !== 'No aplica' ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Lado</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.body_side}</Text>
                                  </View>
                                ) : null}
                                {ex.resistance_load ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textSecondary }]}>Peso / Carga</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.resistance_load}</Text>
                                  </View>
                                ) : null}
                              </View>

                              {/* Indicaciones personalizadas del kinesiólogo */}
                              {ex.custom_instructions ? (
                                <View style={[styles.indicationCallout, { backgroundColor: theme.primaryLight + '25', borderColor: theme.primary }]}>
                                  <MaterialIcons name="medical-services" size={22} color={theme.primary} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.indicationTitle, { color: theme.primary }]}>Indicación especial para vos:</Text>
                                    <Text style={[styles.indicationText, { color: theme.text }]}>{ex.custom_instructions}</Text>
                                  </View>
                                </View>
                              ) : null}

                              {/* Instrucciones técnicas */}
                              {ex.instructions ? (
                                <View style={styles.instructionsBox}>
                                  <Text style={[styles.instructionsTitle, { color: theme.text }]}>Cómo realizar el ejercicio:</Text>
                                  <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>{ex.instructions}</Text>
                                </View>
                              ) : null}

                              {/* Precauciones / Contraindicaciones */}
                              {ex.contraindications ? (
                                <View style={[styles.indicationCallout, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
                                  <MaterialIcons name="warning" size={22} color={theme.warning} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.indicationTitle, { color: theme.warning }]}>Precauciones (detener si ocurre):</Text>
                                    <Text style={[styles.indicationText, { color: theme.text }]}>{ex.contraindications}</Text>
                                  </View>
                                </View>
                              ) : null}

                              {/* Video demostrativo opcional */}
                              {ex.media_url ? (
                                <TouchableOpacity
                                  accessibilityRole="button"
                                  accessibilityLabel="Ver video demostrativo del ejercicio"
                                  style={[styles.mediaLinkBtn, { borderColor: theme.info, backgroundColor: theme.infoBg }]}
                                  onPress={() => {
                                    if (ex.media_url) Linking.openURL(ex.media_url);
                                  }}
                                >
                                  <MaterialIcons name="play-circle-outline" size={24} color={theme.info} />
                                  <Text style={[styles.mediaLinkText, { color: theme.info }]}>Ver video demostrativo del ejercicio</Text>
                                </TouchableOpacity>
                              ) : null}

                              {/* Botón de cumplimiento informado */}
                              <View style={[styles.exerciseActionRow, { borderTopColor: theme.border }]}>
                                <Button
                                  title={isDoneToday ? 'Registrar otra realización hoy' : 'Marcar ejercicio como realizado'}
                                  variant={isDoneToday ? 'outline' : 'primary'}
                                  icon={<MaterialIcons name={isDoneToday ? 'check-circle' : 'check'} size={22} color={isDoneToday ? theme.primary : '#FFF'} />}
                                  size="md"
                                  onPress={() => handleOpenLogExercise(ex)}
                                  style={{ flex: 1 }}
                                />
                              </View>
                            </Card>
                          );
                        })
                      )}

                      {/* Historial de cumplimiento informado por el paciente */}
                      <View style={{ marginTop: spacing.sm }}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Ver mi historial de realización de ejercicios"
                          style={[styles.historyToggleRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => {
                            if (!showLogsHistory && complianceLogs.length === 0 && currentRoutine?.id) {
                              fetchComplianceLogs(currentRoutine.id);
                            }
                            setShowLogsHistory(!showLogsHistory);
                          }}
                        >
                          <MaterialIcons name="history" size={24} color={theme.primary} />
                          <Text style={[styles.historyToggleText, { color: theme.text, flex: 1 }]}>
                            Mi historial de ejercicios realizados ({complianceLogs.length})
                          </Text>
                          <MaterialIcons name={showLogsHistory ? 'expand-less' : 'expand-more'} size={28} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {showLogsHistory && (
                          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                            {complianceLogs.length === 0 ? (
                              <Card elevated padding="lg">
                                <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                                  Aún no tenés registros de realización para esta rutina.
                                </Text>
                              </Card>
                            ) : (
                              complianceLogs.map((log: any) => (
                                <Card key={log.id} elevated padding="md" style={styles.historyLogCard}>
                                  <View style={styles.cardHeaderRow}>
                                    <Text style={[styles.logExerciseName, { color: theme.text }]}>{log.exercise_name}</Text>
                                    <Text style={[styles.logDateText, { color: theme.textSecondary }]}>
                                      {new Date(log.completed_at || log.completed_date).toLocaleDateString('es-AR')}
                                    </Text>
                                  </View>
                                  <View style={styles.logMetaRow}>
                                    <Text style={[styles.logMetaItem, { color: theme.textSecondary }]}>
                                      {log.sets_completed ? `${log.sets_completed} series` : ''}{' '}
                                      {log.reps_completed ? `× ${log.reps_completed} repeticiones` : ''}
                                    </Text>
                                    <Badge
                                      label={`Molestia: ${log.perceived_pain_level ?? 0} de 10`}
                                      variant={log.perceived_pain_level > 5 ? 'error' : log.perceived_pain_level > 2 ? 'warning' : 'success'}
                                      size="md"
                                    />
                                  </View>
                                  {log.patient_notes ? (
                                    <Text style={[styles.logNotesText, { color: theme.textSecondary }]}>
                                      "{log.patient_notes}"
                                    </Text>
                                  ) : null}
                                </Card>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })()}
              </>
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 3: PROFESIONALES Y SERVICIOS */}
        {/* ========================================== */}
        {activeTab === 'servicios' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Profesionales y servicios"
              subtitle="Conocé nuestros especialistas y tipos de consulta."
            />

            <Text style={[styles.subHeaderTitle, { color: theme.text }]}>Nuestros profesionales</Text>
            {catalog.professionals.map((prof) => (
              <Card key={prof.id} elevated style={styles.profCard} padding="lg">
                <View style={styles.profRow}>
                  <View style={[styles.profAvatar, { backgroundColor: theme.primaryLight }]}>
                    <MaterialIcons name="badge" size={28} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profName, { color: theme.text }]}>{prof.fullName}</Text>
                    <Text style={[styles.profSpecialty, { color: theme.textSecondary }]}>
                      {prof.specialty}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <Button
                    title="Solicitar turno con este profesional"
                    variant="outline"
                    size="md"
                    onPress={() => {
                      setSelectedKinesiologist(prof);
                      handleOpenBooking();
                    }}
                  />
                </View>
              </Card>
            ))}

            <Text style={[styles.subHeaderTitle, { color: theme.text, marginTop: spacing.lg }]}>
              Servicios y tipos de consulta
            </Text>
            {catalog.services.map((serv) => (
              <Card key={serv.id} elevated style={styles.serviceCard} padding="lg">
                <View style={styles.serviceHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceTitle, { color: theme.text }]}>{serv.name}</Text>
                    <Text style={[styles.serviceDescription, { color: theme.textSecondary }]}>
                      {serv.description}
                    </Text>
                  </View>
                  <View style={styles.servicePriceBox}>
                    <Text style={[styles.priceTag, { color: theme.primary }]}>
                      ${serv.price.toLocaleString('es-AR')}
                    </Text>
                    <Text style={[styles.currencyTag, { color: theme.textSecondary }]}>{serv.currency}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.serviceFooterRow}>
                  <View style={styles.durationBadge}>
                    <MaterialIcons name="schedule" size={20} color={theme.textSecondary} />
                    <Text style={[styles.durationText, { color: theme.textSecondary }]}>
                      Duración aproximada: {serv.durationMinutes} minutos
                    </Text>
                  </View>

                  <Button
                    title="Solicitar turno"
                    size="md"
                    onPress={() => handleOpenBooking(serv)}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 4: MIS TURNOS (Próximos y Anteriores) */}
        {/* ========================================== */}
        {activeTab === 'turnos' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mis turnos"
              subtitle="Consultá tus próximos turnos y tu historial de atención."
              action={
                <Button
                  title="Solicitar turno"
                  size="md"
                  icon={<MaterialIcons name="add-circle-outline" size={20} color="#FFF" />}
                  onPress={() => handleOpenBooking()}
                />
              }
            />

            {myAppointments.length === 0 ? (
              <EmptyState
                title="No tenés turnos registrados"
                subtitle="Podés solicitar un nuevo turno en cualquier momento."
                action={{
                  label: 'Solicitar turno',
                  onPress: () => handleOpenBooking()
                }}
              />
            ) : (
              <View style={{ gap: spacing.lg }}>
                {/* SECCIÓN: PRÓXIMOS TURNOS */}
                <View style={{ gap: spacing.md }}>
                  <Text style={[styles.subHeaderTitle, { color: theme.text }]}>
                    Próximos turnos ({upcomingAppointments.length})
                  </Text>

                  {upcomingAppointments.length === 0 ? (
                    <Card elevated padding="lg">
                      <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                        No tenés próximos turnos pendientes.
                      </Text>
                    </Card>
                  ) : (
                    upcomingAppointments.map((appt) => (
                      <Card key={appt.id} elevated style={styles.apptCard} padding="lg">
                        <View style={styles.cardHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.apptService, { color: theme.text }]}>{appt.service_name}</Text>
                            <Text style={[styles.apptKine, { color: theme.textSecondary }]}>
                              Profesional: Lic. {appt.kinesiologist_last_name}, {appt.kinesiologist_name}
                            </Text>
                          </View>
                          <Badge
                            label={appt.status === 'confirmed' ? 'Confirmado' : 'Programado'}
                            variant={appt.status === 'confirmed' ? 'success' : 'warning'}
                            size="md"
                          />
                        </View>

                        <View style={[styles.divider, { backgroundColor: theme.border }]} />

                        <View style={styles.apptDetailsGrid}>
                          <View style={styles.apptGridItem}>
                            <MaterialIcons name="event" size={22} color={theme.primary} />
                            <Text style={[styles.gridText, { color: theme.text }]}>
                              {formatFullSpanishDate(appt.start_time)} a las{' '}
                              {new Date(appt.start_time).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}{' '}
                              hs
                            </Text>
                          </View>

                          <View style={styles.apptGridItem}>
                            <MaterialIcons name="payments" size={22} color={theme.textSecondary} />
                            <Text style={[styles.gridText, { color: theme.text }]}>
                              Valor: ${Number(appt.agreed_price).toLocaleString('es-AR')} {appt.currency || 'ARS'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.apptActionsFooter}>
                          <Button
                            title="Cancelar turno"
                            variant="danger"
                            size="md"
                            onPress={() => {
                              setAppointmentToCancel(appt);
                              setCancelModalVisible(true);
                            }}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </Card>
                    ))
                  )}
                </View>

                {/* SECCIÓN: TURNOS ANTERIORES Y CANCELADOS */}
                {pastAppointments.length > 0 && (
                  <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
                    <Text style={[styles.subHeaderTitle, { color: theme.text }]}>
                      Turnos anteriores ({pastAppointments.length})
                    </Text>

                    {pastAppointments.map((appt) => (
                      <Card key={appt.id} elevated style={styles.apptCard} padding="lg">
                        <View style={styles.cardHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.apptService, { color: theme.text }]}>{appt.service_name}</Text>
                            <Text style={[styles.apptKine, { color: theme.textSecondary }]}>
                              Profesional: Lic. {appt.kinesiologist_last_name}, {appt.kinesiologist_name}
                            </Text>
                          </View>
                          <Badge
                            label={appt.status === 'attended' ? 'Atendido' : 'Cancelado'}
                            variant={appt.status === 'attended' ? 'info' : 'error'}
                            size="md"
                          />
                        </View>

                        <View style={[styles.divider, { backgroundColor: theme.border }]} />

                        <View style={styles.apptDetailsGrid}>
                          <View style={styles.apptGridItem}>
                            <MaterialIcons name="event" size={22} color={theme.textSecondary} />
                            <Text style={[styles.gridText, { color: theme.textSecondary }]}>
                              {formatFullSpanishDate(appt.start_time)} a las{' '}
                              {new Date(appt.start_time).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}{' '}
                              hs
                            </Text>
                          </View>

                          <View style={styles.apptGridItem}>
                            <MaterialIcons name="payments" size={22} color={theme.textSecondary} />
                            <Text style={[styles.gridText, { color: theme.textSecondary }]}>
                              ${Number(appt.agreed_price).toLocaleString('es-AR')} {appt.currency || 'ARS'}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 5: MI PERFIL */}
        {/* ========================================== */}
        {activeTab === 'perfil' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mi perfil"
              subtitle="Tus datos personales y de contacto."
            />

            {profileError && (
              <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
                <Text style={[styles.modalBannerText, { color: theme.error }]}>{profileError}</Text>
              </View>
            )}

            {profileSuccess && (
              <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success }]}>
                <Text style={[styles.successBannerText, { color: theme.success }]}>{profileSuccess}</Text>
              </View>
            )}

            <Card elevated style={styles.profileCard} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.sm }]}>Datos personales</Text>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Nombre completo:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.first_name} {profile?.last_name}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Documento (DNI):</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.dni || 'No registrado'}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Correo electrónico:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.email || profile?.account_email || user?.email}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Obra social o cobertura:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.insurance_provider || profile?.address || 'Particular'}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: spacing.md }]} />

              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.md }]}>
                Teléfono de contacto
              </Text>

              <Input
                label="Número de teléfono o celular"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Ej: +54 9 11 4567 8901"
                keyboardType="phone-pad"
              />

              <Button
                title="Guardar teléfono"
                size="md"
                loading={profileSaving}
                onPress={handleSaveProfile}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Card elevated style={[styles.profileCard, { marginTop: spacing.lg }]} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.sm }]}>Cambiar contraseña</Text>

              {passwordError && (
                <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
                  <Text style={[styles.modalBannerText, { color: theme.error }]}>{passwordError}</Text>
                </View>
              )}

              {passwordSuccess && (
                <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success }]}>
                  <Text style={[styles.successBannerText, { color: theme.success }]}>{passwordSuccess}</Text>
                </View>
              )}

              <Input
                label="Contraseña actual"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Ingresá tu contraseña actual"
                isPassword
                required
              />

              <Input
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Mínimo 8 caracteres"
                isPassword
                required
              />

              <Input
                label="Confirmar nueva contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Escribí de nuevo la contraseña"
                isPassword
                required
              />

              <Button
                title="Guardar nueva contraseña"
                size="md"
                loading={passwordSaving}
                onPress={handleChangePassword}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Card elevated style={[styles.profileCard, { marginTop: spacing.lg }]} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.sm }]}>Tu cuenta</Text>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Estado de la cuenta:</Text>
                <Badge label="Paciente verificado" variant="info" size="md" />
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>Número de historia clínica:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  #{profile?.id || 'Asociada'}
                </Text>
              </View>

              <Button
                title="Cerrar sesión"
                variant="outline"
                size="md"
                onPress={logout}
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ========================================== */}
      {/* MODAL: RESERVAR TURNO (6 PASOS GUIADOS + CONFIRMACIÓN) */}
      {/* ========================================== */}
      <ModalWrapper
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        title={bookingConfirmedData ? 'Reserva confirmada' : 'Solicitar turno'}
        subtitle={
          bookingConfirmedData
            ? 'Tu turno quedó agendado correctamente.'
            : `Paso ${bookingStep} de 6: ${BOOKING_STEPS[bookingStep - 1]?.title}`
        }
        footer={
          bookingConfirmedData ? (
            <>
              <Button
                title="Cerrar"
                variant="secondary"
                size="md"
                onPress={() => setBookModalVisible(false)}
              />
              <Button
                title="Ver mis turnos"
                size="md"
                icon={<MaterialIcons name="event-note" size={20} color="#FFF" />}
                onPress={() => {
                  setBookModalVisible(false);
                  setActiveTab('turnos');
                }}
              />
            </>
          ) : (
            <>
              {bookingStep > 1 ? (
                <Button
                  title="Paso anterior"
                  variant="outline"
                  size="md"
                  onPress={() => setBookingStep((prev) => Math.max(1, prev - 1) as BookingStep)}
                />
              ) : (
                <Button
                  title="Cancelar"
                  variant="secondary"
                  size="md"
                  onPress={() => setBookModalVisible(false)}
                />
              )}

              {bookingStep < 6 ? (
                <Button
                  title="Siguiente paso"
                  size="md"
                  disabled={
                    (bookingStep === 1 && !selectedService) ||
                    (bookingStep === 2 && !selectedKinesiologist) ||
                    (bookingStep === 3 && !selectedDate) ||
                    (bookingStep === 4 && !selectedSlot)
                  }
                  onPress={() => setBookingStep((prev) => Math.min(6, prev + 1) as BookingStep)}
                />
              ) : (
                <Button
                  title="Confirmar reserva"
                  size="lg"
                  loading={bookingSubmitting}
                  disabled={!selectedSlot || !selectedService || !selectedKinesiologist}
                  onPress={handleConfirmBooking}
                />
              )}
            </>
          )
        }
      >
        {bookingError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{bookingError}</Text>
          </View>
        )}

        {bookingConfirmedData ? (
          <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.sm }}>
            <View style={[styles.confirmedIconCircle, { backgroundColor: theme.successBg }]}>
              <MaterialIcons name="check-circle" size={56} color={theme.success} />
            </View>
            <Text style={[styles.confirmedHeadline, { color: theme.text }]}>
              ¡Tu turno fue reservado con éxito!
            </Text>
            <Text style={[styles.modalBodyText, { color: theme.textSecondary, textAlign: 'center' }]}>
              Guardá o revisá a continuación los datos de tu consulta:
            </Text>

            <View style={[styles.summaryBox, { width: '100%', backgroundColor: theme.surfaceSubtle, borderColor: theme.success }]}>
              <View style={styles.confirmDetailRow}>
                <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Fecha:</Text>
                <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                  {bookingConfirmedData.dateFormatted}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Horario:</Text>
                <Text style={[styles.confirmDetailValue, { color: theme.primary }]}>
                  {bookingConfirmedData.timeLabel} hs
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Profesional:</Text>
                <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                  {bookingConfirmedData.professionalName}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Servicio:</Text>
                <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                  {bookingConfirmedData.serviceName} ({bookingConfirmedData.durationMinutes} min)
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Valor:</Text>
                <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                  ${Number(bookingConfirmedData.price).toLocaleString('es-AR')} {bookingConfirmedData.currency}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {/* Barra de progreso de los 6 pasos */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperPillsRow}>
                {BOOKING_STEPS.map((item) => {
                  const isCurrent = bookingStep === item.step;
                  const isDone = bookingStep > item.step;
                  return (
                    <TouchableOpacity
                      key={item.step}
                      accessibilityRole="button"
                      accessibilityLabel={`Paso ${item.step}: ${item.title}`}
                      onPress={() => {
                        if (item.step < bookingStep) {
                          setBookingStep(item.step);
                        }
                      }}
                      style={[
                        styles.stepPill,
                        {
                          backgroundColor: isCurrent
                            ? theme.primary
                            : isDone
                            ? theme.primaryLight
                            : theme.surfaceSubtle,
                          borderColor: isCurrent || isDone ? theme.primary : theme.border
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepPillText,
                          {
                            color: isCurrent ? '#FFFFFF' : isDone ? theme.primary : theme.textSecondary
                          }
                        ]}
                      >
                        {item.step}. {item.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* PASO 1: SELECCIONAR EL SERVICIO O TIPO DE CONSULTA */}
            {bookingStep === 1 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  1. Seleccioná el servicio o tipo de consulta
                </Text>
                <Text style={[styles.modalBodyText, { color: theme.textSecondary }]}>
                  Tocá una opción de la lista para seleccionarla:
                </Text>
                {catalog.services.map((s) => {
                  const isSelected = selectedService?.id === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      style={[
                        styles.wizardOptionCard,
                        {
                          backgroundColor: isSelected ? theme.primaryLight + '35' : theme.surfaceSubtle,
                          borderColor: isSelected ? theme.primary : theme.border,
                          borderWidth: isSelected ? 2 : 1.5
                        }
                      ]}
                      onPress={() => {
                        setSelectedService(s);
                        if (selectedKinesiologist) {
                          fetchAvailableSlots(selectedKinesiologist.id, s.id, selectedDate);
                        }
                      }}
                    >
                      <MaterialIcons
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={26}
                        color={isSelected ? theme.primary : theme.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.wizardOptionTitle, { color: theme.text }]}>{s.name}</Text>
                        <Text style={[styles.wizardOptionSub, { color: theme.textSecondary }]}>
                          Duración: {s.durationMinutes} min · Valor: ${Number(s.price).toLocaleString('es-AR')} {s.currency || 'ARS'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* PASO 2: SELECCIONAR EL PROFESIONAL */}
            {bookingStep === 2 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  2. Seleccioná el profesional
                </Text>
                <Text style={[styles.modalBodyText, { color: theme.textSecondary }]}>
                  Elegí el kinesiólogo con quien querés atenderte:
                </Text>
                {catalog.professionals.map((p) => {
                  const isSelected = selectedKinesiologist?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      style={[
                        styles.wizardOptionCard,
                        {
                          backgroundColor: isSelected ? theme.primaryLight + '35' : theme.surfaceSubtle,
                          borderColor: isSelected ? theme.primary : theme.border,
                          borderWidth: isSelected ? 2 : 1.5
                        }
                      ]}
                      onPress={() => {
                        setSelectedKinesiologist(p);
                        if (selectedService) {
                          fetchAvailableSlots(p.id, selectedService.id, selectedDate);
                        }
                      }}
                    >
                      <MaterialIcons
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={26}
                        color={isSelected ? theme.primary : theme.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.wizardOptionTitle, { color: theme.text }]}>{p.fullName}</Text>
                        <Text style={[styles.wizardOptionSub, { color: theme.textSecondary }]}>
                          {p.specialty}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* PASO 3: ELEGIR UNA FECHA DISPONIBLE */}
            {bookingStep === 3 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  3. Elegí una fecha disponible
                </Text>
                <DateInput
                  label="Fecha del turno (lunes a viernes, próximos 14 días)"
                  value={selectedDate}
                  min={bookingMinDate}
                  max={bookingMaxDate}
                  disableWeekends={true}
                  inlineCalendar={true}
                  isDateDisabled={(d) => evaluateDateClient(d, calendarByDate, bookingMinDate, bookingMaxDate)}
                  onChangeDate={(val) => {
                    setSelectedDate(val);
                    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val) && selectedKinesiologist && selectedService) {
                      fetchAvailableSlots(selectedKinesiologist.id, selectedService.id, val);
                    }
                  }}
                />
              </View>
            )}

            {/* PASO 4: ELEGIR UN HORARIO */}
            {bookingStep === 4 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  4. Elegí un horario disponible
                </Text>
                <Text style={[styles.modalBodyText, { color: theme.textSecondary }]}>
                  Horarios disponibles para el <Text style={{ fontWeight: '700', color: theme.text }}>{formatFullSpanishDate(selectedDate)}</Text>:
                </Text>

                {loadingSlots ? (
                  <Text style={[styles.slotInfoText, { color: theme.textSecondary }]}>
                    Buscando horarios disponibles...
                  </Text>
                ) : availableSlots.length === 0 ? (
                  <View style={[styles.modalBanner, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
                    <Text style={[styles.modalBannerText, { color: theme.warning }]}>
                      No quedan horarios libres en esta fecha. Volvé al paso anterior para elegir otro día.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.slotsGrid}>
                    {availableSlots.map((slot, idx) => {
                      const isSlotSelected = selectedSlot?.startTime === slot.startTime;
                      return (
                        <TouchableOpacity
                          key={idx}
                          accessibilityRole="button"
                          accessibilityLabel={`Horario ${slot.time || slot.timeLabel} horas`}
                          accessibilityState={{ selected: isSlotSelected }}
                          style={[
                            styles.slotBadge,
                            {
                              backgroundColor: isSlotSelected ? theme.primary : theme.surfaceSubtle,
                              borderColor: isSlotSelected ? theme.primary : theme.border
                            }
                          ]}
                          onPress={() => setSelectedSlot(slot)}
                        >
                          <MaterialIcons
                            name="schedule"
                            size={20}
                            color={isSlotSelected ? '#FFF' : theme.primary}
                          />
                          <Text
                            style={{
                              color: isSlotSelected ? '#FFF' : theme.text,
                              fontWeight: '700',
                              fontSize: typography.fontSize.md
                            }}
                          >
                            {slot.time || slot.timeLabel} hs
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* PASO 5: REVISAR LOS DATOS DEL TURNO */}
            {bookingStep === 5 && (
              <View style={{ gap: spacing.md }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  5. Revisá los datos de tu turno
                </Text>
                <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.primary }]}>
                  <Text style={[styles.summaryTitle, { color: theme.primary }]}>Datos seleccionados</Text>
                  <Text style={[styles.summaryText, { color: theme.text }]}>
                    • Servicio: {selectedService?.name} ({selectedService?.durationMinutes} minutos)
                  </Text>
                  <Text style={[styles.summaryText, { color: theme.text }]}>
                    • Profesional: {selectedKinesiologist?.fullName}
                  </Text>
                  <Text style={[styles.summaryText, { color: theme.text }]}>
                    • Fecha: {formatFullSpanishDate(selectedDate)}
                  </Text>
                  <Text style={[styles.summaryText, { color: theme.text }]}>
                    • Horario: {selectedSlot?.time || selectedSlot?.timeLabel} hs
                  </Text>
                  <Text style={[styles.summaryPrice, { color: theme.text }]}>
                    Valor de la consulta: ${Number(selectedService?.price || 0).toLocaleString('es-AR')} {selectedService?.currency || 'ARS'}
                  </Text>
                </View>

                <Input
                  label="Comentarios o motivo de consulta (opcional)"
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                  placeholder="Ej: Dolor en hombro derecho"
                />
              </View>
            )}

            {/* PASO 6: CONFIRMAR LA RESERVA */}
            {bookingStep === 6 && (
              <View style={{ gap: spacing.md }}>
                <Text style={[styles.stepQuestionTitle, { color: theme.text }]}>
                  6. Confirmá tu reserva
                </Text>
                <Text style={[styles.modalBodyText, { color: theme.textSecondary }]}>
                  Verificá que la fecha, el horario y el profesional sean correctos y presioná "Confirmar reserva":
                </Text>
                <View style={[styles.summaryBox, { backgroundColor: theme.primaryLight + '25', borderColor: theme.primary }]}>
                  <View style={styles.confirmDetailRow}>
                    <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Fecha:</Text>
                    <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                      {formatFullSpanishDate(selectedDate)}
                    </Text>
                  </View>
                  <View style={styles.confirmDetailRow}>
                    <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Horario:</Text>
                    <Text style={[styles.confirmDetailValue, { color: theme.primary }]}>
                      {selectedSlot?.time || selectedSlot?.timeLabel} hs
                    </Text>
                  </View>
                  <View style={styles.confirmDetailRow}>
                    <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Profesional:</Text>
                    <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                      {selectedKinesiologist?.fullName}
                    </Text>
                  </View>
                  <View style={styles.confirmDetailRow}>
                    <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Servicio:</Text>
                    <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                      {selectedService?.name}
                    </Text>
                  </View>
                  {bookingNotes.trim() ? (
                    <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmDetailLabel, { color: theme.textSecondary }]}>Comentario:</Text>
                      <Text style={[styles.confirmDetailValue, { color: theme.text }]}>
                        {bookingNotes.trim()}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.summaryPolicy, { color: theme.textSecondary, marginTop: spacing.xs }]}>
                    Podés cancelar sin cargo hasta 2 horas antes del horario del turno.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ModalWrapper>

      {/* ========================================== */}
      {/* MODAL: CANCELAR TURNO */}
      {/* ========================================== */}
      <ModalWrapper
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        title="Confirmar cancelación de turno"
        footer={
          <>
            <Button title="Volver atrás" variant="secondary" size="md" onPress={() => setCancelModalVisible(false)} />
            <Button
              title="Sí, cancelar turno"
              variant="danger"
              size="md"
              loading={cancelSubmitting}
              onPress={handleConfirmCancel}
            />
          </>
        }
      >
        {cancelError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{cancelError}</Text>
          </View>
        )}

        <Text style={[styles.modalBodyText, { color: theme.text }]}>
          ¿Estás seguro de que querés cancelar este turno?
        </Text>

        {appointmentToCancel && (
          <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, marginTop: spacing.sm }]}>
            <Text style={[styles.summaryText, { color: theme.text, fontWeight: '700' }]}>
              {appointmentToCancel.service_name}
            </Text>
            <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
              {formatFullSpanishDate(appointmentToCancel.start_time)} a las{' '}
              {new Date(appointmentToCancel.start_time).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
              })}{' '}
              hs
            </Text>
          </View>
        )}

        <Input
          label="Motivo de cancelación (opcional)"
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Ej: No puedo asistir en ese horario"
          containerStyle={{ marginTop: spacing.md }}
        />
      </ModalWrapper>

      {/* ========================================== */}
      {/* MODAL: REGISTRAR CUMPLIMIENTO DE EJERCICIO */}
      {/* ========================================== */}
      <ModalWrapper
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        title="Registrar ejercicio realizado"
        subtitle={exerciseToLog ? `${exerciseToLog.name} (Ejercicio #${exerciseToLog.execution_order})` : ''}
        footer={
          <>
            <Button title="Cancelar" variant="secondary" size="md" onPress={() => setLogModalVisible(false)} />
            <Button
              title="Guardar registro"
              size="md"
              loading={logSubmitting}
              onPress={handleConfirmLogExercise}
            />
          </>
        }
      >
        {logError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{logError}</Text>
          </View>
        )}

        {logSuccess && (
          <View style={[styles.modalBanner, { backgroundColor: theme.successBg, borderColor: theme.success }]}>
            <Text style={[styles.modalBannerText, { color: theme.success }]}>{logSuccess}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Input
              label="Series realizadas"
              value={logSets}
              onChangeText={setLogSets}
              keyboardType="numeric"
              placeholder="Ej: 3"
            />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Input
              label="Repeticiones"
              value={logReps}
              onChangeText={setLogReps}
              keyboardType="numeric"
              placeholder="Ej: 10"
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: theme.text, marginTop: spacing.sm }]}>
          Nivel de molestia o dolor sentido (0 = Sin dolor, 10 = Dolor máximo):
        </Text>
        <View style={styles.painGrid}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
            const isSelected = logPain === score;
            const color = score === 0 ? theme.success : score <= 3 ? theme.info : score <= 6 ? theme.warning : theme.error;
            return (
              <TouchableOpacity
                key={score}
                accessibilityRole="button"
                accessibilityLabel={`Nivel de dolor ${score} de 10`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setLogPain(score)}
                style={[
                  styles.painChip,
                  {
                    backgroundColor: isSelected ? color : theme.surfaceSubtle,
                    borderColor: isSelected ? color : theme.border
                  }
                ]}
              >
                <Text style={{ color: isSelected ? '#FFF' : theme.text, fontWeight: '700', fontSize: typography.fontSize.md }}>
                  {score}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.painHintText, { color: theme.textSecondary }]}>
          {logPain === 0 ? '0: Sin molestias ni dolor durante el ejercicio.' :
           logPain !== null && logPain <= 3 ? `${logPain}: Molestia o tensión leve bien tolerada.` :
           logPain !== null && logPain <= 6 ? `${logPain}: Dolor moderado que dificulta el movimiento.` :
           `${logPain}: Dolor intenso (informar a tu kinesiólogo).`}
        </Text>

        <Input
          label="Comentarios para tu kinesiólogo (opcional)"
          value={logNotes}
          onChangeText={setLogNotes}
          placeholder="Ej: Me resultó más sencillo que ayer"
          containerStyle={{ marginTop: spacing.md }}
        />
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1.5
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 200
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  brandTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  brandUser: {
    fontSize: typography.fontSize.md,
    marginTop: 2
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: 6
  },
  logoutText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  tabsNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1.5
  },
  tabItem: {
    flex: 1,
    minWidth: 96,
    minHeight: 56,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  tabLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  scrollContent: {
    padding: spacing.lg,
    maxWidth: 820,
    alignSelf: 'center',
    width: '100%'
  },
  sectionContainer: {
    gap: spacing.lg
  },
  heroCard: {
    width: '100%'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  cardSubtitle: {
    fontSize: typography.fontSize.md,
    marginBottom: spacing.md
  },
  nextApptBody: {
    gap: spacing.md
  },
  apptHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    gap: spacing.md
  },
  highlightTextCol: {
    flex: 1
  },
  highlightService: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  highlightTime: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: 4,
    lineHeight: 26
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg
  },
  detailItem: {
    flex: 1,
    minWidth: 180
  },
  detailLabel: {
    fontSize: typography.fontSize.sm
  },
  detailValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 4
  },
  apptActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs
  },
  noApptBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl
  },
  noApptText: {
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 26
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  actionCard: {
    flex: 1,
    minWidth: 260,
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  actionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  actionDesc: {
    fontSize: typography.fontSize.md,
    lineHeight: 25
  },
  subHeaderTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs
  },
  serviceCard: {
    marginBottom: spacing.md
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  serviceTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  serviceDescription: {
    fontSize: typography.fontSize.md,
    marginTop: 6,
    lineHeight: 26
  },
  servicePriceBox: {
    alignItems: 'flex-end'
  },
  priceTag: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  currencyTag: {
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  },
  serviceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  durationText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium
  },
  profCard: {
    marginBottom: spacing.md
  },
  profRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  profAvatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  profName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  profSpecialty: {
    fontSize: typography.fontSize.md,
    marginTop: 4,
    lineHeight: 24
  },
  apptCard: {
    marginBottom: spacing.md
  },
  apptService: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  apptKine: {
    fontSize: typography.fontSize.md,
    marginTop: 4
  },
  apptDetailsGrid: {
    flexDirection: 'column',
    gap: spacing.sm
  },
  apptGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  gridText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 25,
    flex: 1
  },
  apptActionsFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md
  },
  profileCard: {
    width: '100%'
  },
  profileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  profileLabel: {
    fontSize: typography.fontSize.md
  },
  profileValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  successBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.md
  },
  successBannerText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  modalBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.md
  },
  modalBannerText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 24
  },
  inputLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.xs
  },
  wrappedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  selectChip: {
    minHeight: 46,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5,
    justifyContent: 'center'
  },
  stepperContainer: {
    marginBottom: spacing.xs
  },
  stepperPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  stepPill: {
    minHeight: 40,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  stepQuestionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  wizardOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    minHeight: 68
  },
  wizardOptionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  wizardOptionSub: {
    fontSize: typography.fontSize.base,
    marginTop: 2,
    lineHeight: 22
  },
  confirmedIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center'
  },
  confirmedHeadline: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center'
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: 4
  },
  confirmDetailLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium
  },
  confirmDetailValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    flexShrink: 1,
    textAlign: 'right'
  },
  slotInfoText: {
    fontSize: typography.fontSize.md,
    marginVertical: spacing.sm
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    minWidth: 120,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5
  },
  summaryBox: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    gap: 8
  },
  summaryTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  summaryText: {
    fontSize: typography.fontSize.md,
    lineHeight: 26
  },
  summaryPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: 6
  },
  summaryPolicy: {
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginTop: 4
  },
  modalBodyText: {
    fontSize: typography.fontSize.md,
    lineHeight: 26
  },
  routineOverviewBody: {
    gap: spacing.md
  },
  routineOverviewBox: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    gap: spacing.sm
  },
  routineOverviewName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  routineValidityText: {
    fontSize: typography.fontSize.md
  },
  routineProgressRow: {
    marginTop: spacing.xs
  },
  progressCountText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 8
  },
  progressBarBg: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6
  },
  routineDescText: {
    fontSize: typography.fontSize.md,
    lineHeight: 26,
    marginTop: 4
  },
  routineDatesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap'
  },
  routineDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  indicationCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: spacing.sm,
    marginVertical: 6
  },
  indicationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  indicationText: {
    fontSize: typography.fontSize.md,
    lineHeight: 26
  },
  exerciseCard: {
    marginBottom: spacing.md
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  orderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center'
  },
  orderBadgeText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  exerciseName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6
  },
  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginVertical: spacing.md
  },
  paramItem: {
    alignItems: 'center',
    minWidth: 78
  },
  paramLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  paramValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  instructionsBox: {
    paddingVertical: spacing.sm
  },
  instructionsTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  instructionsText: {
    fontSize: typography.fontSize.md,
    lineHeight: 26
  },
  mediaLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 8,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginVertical: spacing.sm
  },
  mediaLinkText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  exerciseActionRow: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    marginTop: spacing.sm
  },
  historyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: spacing.sm
  },
  historyToggleText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  historyLogCard: {
    marginBottom: spacing.xs
  },
  logExerciseName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  logDateText: {
    fontSize: typography.fontSize.sm
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4
  },
  logMetaItem: {
    fontSize: typography.fontSize.md
  },
  logNotesText: {
    fontSize: typography.fontSize.base,
    fontStyle: 'italic',
    marginTop: 4
  },
  painGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginVertical: spacing.sm
  },
  painChip: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  painHintText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginVertical: 6,
    lineHeight: 24
  }
});
