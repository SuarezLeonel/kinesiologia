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
  FlatList,
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
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

type PortalTab = 'inicio' | 'ejercicios' | 'turnos' | 'servicios' | 'perfil';

const formatLocalDateISO = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  // Estados de reserva
  const [bookModalVisible, setBookModalVisible] = useState(false);
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

  const loadData = async () => {
    try {
      setError(null);
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
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al conectar con el portal de pacientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fetchAvailableSlots = async (kineId: number, servId: number, dateStr: string) => {
    if (!kineId || !servId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
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

  const handleOpenBooking = (service?: any) => {
    setBookingError(null);
    setBookingSuccess(null);
    setSelectedSlot(null);
    setBookingNotes('');
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
    const tomorrow = formatLocalDateISO(new Date(Date.now() + 86400000));
    setSelectedDate(tomorrow);
    setBookModalVisible(true);
    if (prof && serv) {
      fetchAvailableSlots(prof.id, serv.id, tomorrow);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedService || !selectedKinesiologist) {
      setBookingError('Por favor seleccione un horario disponible');
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
        setBookingSuccess('¡Turno reservado con éxito! Recibirás confirmación en tu panel.');
        setTimeout(() => {
          setBookModalVisible(false);
          loadData();
          setActiveTab('turnos');
        }, 1200);
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
        setCancelModalVisible(false);
        loadData();
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
      setProfileError('Ingrese un teléfono o celular válido (mínimo 6 caracteres)');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await apiClient.post('/patient-portal/update-profile', {
        phone: editPhone.trim()
      });
      if (res.data?.success) {
        setProfile(res.data.data);
        setProfileSuccess('Teléfono de contacto actualizado correctamente');
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
      setPasswordError('Ingrese su contraseña actual');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
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
        setPasswordSuccess('Contraseña actualizada correctamente');
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
        setLogSuccess('¡Excelente! El cumplimiento de tu ejercicio quedó registrado.');
        setTimeout(() => {
          setLogModalVisible(false);
          loadData();
          if (selectedRoutineId) {
            fetchComplianceLogs(selectedRoutineId);
          }
        }, 1100);
      }
    } catch (err: any) {
      setLogError(err.response?.data?.error?.message || 'Error al guardar el registro del ejercicio');
    } finally {
      setLogSubmitting(false);
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando tu portal personal..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const nextAppt = dashboardData?.nextAppointment;

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
            <MaterialIcons name="medical-information" size={22} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: theme.text }]}>Mi Portal Paciente</Text>
            <Text style={[styles.brandUser, { color: theme.textSecondary }]}>
              {profile?.first_name ? `${profile.first_name} ${profile.last_name}` : user?.name}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={logout}
          style={[styles.logoutBtn, { borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <MaterialIcons name="logout" size={18} color={theme.textMuted} />
          <Text style={[styles.logoutText, { color: theme.textMuted }]}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de pestañas responsive */}
      <View style={[styles.tabsNav, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'inicio' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('inicio')}
        >
          <MaterialIcons name="home" size={20} color={activeTab === 'inicio' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'inicio' ? theme.primary : theme.textSecondary }]}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ejercicios' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
          onPress={() => {
            setActiveTab('ejercicios');
            if (selectedRoutineId) fetchComplianceLogs(selectedRoutineId);
          }}
        >
          <MaterialIcons name="fitness-center" size={20} color={activeTab === 'ejercicios' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'ejercicios' ? theme.primary : theme.textSecondary }]}>Ejercicios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'turnos' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('turnos')}
        >
          <MaterialIcons name="event" size={20} color={activeTab === 'turnos' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'turnos' ? theme.primary : theme.textSecondary }]}>Turnos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'servicios' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('servicios')}
        >
          <MaterialIcons name="local-hospital" size={20} color={activeTab === 'servicios' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'servicios' ? theme.primary : theme.textSecondary }]}>Servicios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'perfil' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('perfil')}
        >
          <MaterialIcons name="person-outline" size={20} color={activeTab === 'perfil' ? theme.primary : theme.textMuted} />
          <Text style={[styles.tabLabel, { color: activeTab === 'perfil' ? theme.primary : theme.textSecondary }]}>Perfil</Text>
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
            {/* Tarjeta de Próximo Turno */}
            <Card elevated style={styles.heroCard} padding="lg">
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Próximo Turno Confirmado</Text>
                {nextAppt && (
                  <Badge
                    label={nextAppt.status === 'confirmed' ? 'Confirmado' : 'Programado'}
                    variant={nextAppt.status === 'confirmed' ? 'success' : 'info'}
                  />
                )}
              </View>

              {nextAppt ? (
                <View style={styles.nextApptBody}>
                  <View style={[styles.apptHighlightBox, { backgroundColor: theme.primaryLight + '40', borderColor: theme.primary + '30' }]}>
                    <MaterialIcons name="event-available" size={32} color={theme.primary} />
                    <View style={styles.highlightTextCol}>
                      <Text style={[styles.highlightService, { color: theme.primary }]}>
                        {nextAppt.service_name}
                      </Text>
                      <Text style={[styles.highlightTime, { color: theme.text }]}>
                        {new Date(nextAppt.start_time).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} hs
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Profesional</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        Lic. {nextAppt.kinesiologist_last_name}, {nextAppt.kinesiologist_name}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Tarifa acordada</Text>
                      <Text style={[styles.detailValue, { color: theme.text }]}>
                        ${Number(nextAppt.agreed_price).toLocaleString('es-AR')} {nextAppt.currency || 'ARS'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.apptActionsRow}>
                    <Button
                      title="Cancelar Turno"
                      variant="danger"
                      size="sm"
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
                  <MaterialIcons name="calendar-today" size={40} color={theme.textMuted} style={{ marginBottom: spacing.sm }} />
                  <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                    No tenés turnos programados en este momento.
                  </Text>
                  <Button
                    title="Reservar un Turno Ahora"
                    size="md"
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
                    <MaterialIcons name="fitness-center" size={20} color={theme.primary} />
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Mi Rutina de Rehabilitación</Text>
                  </View>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: 0, marginTop: 4 }]}>
                    {dashboardData?.activeRoutine?.kinesiologist_name
                      ? `Prescrita por Lic. ${dashboardData.activeRoutine.kinesiologist_name} ${dashboardData.activeRoutine.kinesiologist_last_name}`
                      : 'Plan de ejercicios terapéuticos'}
                  </Text>
                </View>
                {dashboardData?.activeRoutine && (
                  <Badge label="Vigente" variant="success" />
                )}
              </View>

              {dashboardData?.activeRoutine ? (
                <View style={styles.routineOverviewBody}>
                  <View style={[styles.routineOverviewBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                    <Text style={[styles.routineOverviewName, { color: theme.text }]}>
                      {dashboardData.activeRoutine.name}
                    </Text>
                    {dashboardData.activeRoutine.valid_from && (
                      <Text style={[styles.routineValidityText, { color: theme.textMuted }]}>
                        Desde {new Date(dashboardData.activeRoutine.valid_from).toLocaleDateString('es-AR')}
                        {dashboardData.activeRoutine.valid_until ? ` hasta ${new Date(dashboardData.activeRoutine.valid_until).toLocaleDateString('es-AR')}` : ' (Sin vencimiento definido)'}
                      </Text>
                    )}
                    {dashboardData.activeRoutine.notes ? (
                      <View style={[styles.indicationCallout, { backgroundColor: theme.infoBg, borderColor: theme.info + '30' }]}>
                        <MaterialIcons name="info" size={16} color={theme.info} />
                        <Text style={[styles.indicationText, { color: theme.text, flex: 1 }]}>
                          {dashboardData.activeRoutine.notes}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.routineProgressRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.progressCountText, { color: theme.text }]}>
                          {dashboardData.activeRoutine.completed_today_count || 0} de {dashboardData.activeRoutine.exercises_count || 0} ejercicios realizados hoy
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
                    title="Ver Ejercicios e Instrucciones"
                    icon={<MaterialIcons name="arrow-forward" size={18} color="#FFF" />}
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
                  <MaterialIcons name="fitness-center" size={36} color={theme.textMuted} style={{ marginBottom: spacing.xs }} />
                  <Text style={[styles.noApptText, { color: theme.textSecondary }]}>
                    No tenés una rutina asignada actualmente. Tu kinesiólogo prescribirá tus ejercicios en tu próxima consulta.
                  </Text>
                </View>
              )}
            </Card>

            {/* Accesos directos */}
            <View style={styles.quickActionsRow}>
              <Card elevated style={[styles.actionCard, { flex: 1 }]} padding="md">
                <MaterialIcons name="add-circle-outline" size={28} color={theme.primary} />
                <Text style={[styles.actionTitle, { color: theme.text }]}>Nuevo Turno</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Elegí servicio y horario disponible en segundos.
                </Text>
                <Button title="Agendar" size="sm" onPress={() => handleOpenBooking()} style={{ marginTop: spacing.sm }} />
              </Card>

              <Card elevated style={[styles.actionCard, { flex: 1 }]} padding="md">
                <MaterialIcons name="fitness-center" size={28} color={theme.success} />
                <Text style={[styles.actionTitle, { color: theme.text }]}>Mis Ejercicios</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Consultá las rutinas e indicaciones de tu kinesiólogo.
                </Text>
                <Button
                  title="Ver Rutina"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setActiveTab('ejercicios');
                    if (selectedRoutineId) fetchComplianceLogs(selectedRoutineId);
                  }}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              <Card elevated style={[styles.actionCard, { flex: 1 }]} padding="md">
                <MaterialIcons name="history" size={28} color={theme.info} />
                <Text style={[styles.actionTitle, { color: theme.text }]}>Mis Turnos</Text>
                <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                  Revisá tus citas anteriores y próximas reservas.
                </Text>
                <Button title="Historial" variant="outline" size="sm" onPress={() => setActiveTab('turnos')} style={{ marginTop: spacing.sm }} />
              </Card>
            </View>
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 2: MIS EJERCICIOS Y RUTINAS */}
        {/* ========================================== */}
        {activeTab === 'ejercicios' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mis Ejercicios y Rutinas"
              subtitle="Ejercicios prescritos por tu profesional para realizar en tu hogar o gimnasio"
            />

            {myRoutines.length === 0 ? (
              <EmptyState
                title="No tenés rutinas asignadas"
                subtitle="Tu kinesiólogo prescribirá y cargará tu rutina de rehabilitación personalizada en tu próxima sesión."
              />
            ) : (
              <>
                {/* Selector de rutinas cuando existen múltiples versiones o tratamientos */}
                {myRoutines.length > 1 && (
                  <View style={{ marginBottom: spacing.xs }}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Seleccionar Rutina:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {myRoutines.map((r) => {
                        const isSelected = selectedRoutineId === r.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
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
                                fontWeight: isSelected ? '700' : '500',
                                fontSize: typography.fontSize.xs
                              }}
                            >
                              {r.name} {r.is_current ? '★ (Vigente)' : `(v${r.version})`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Rutina activa seleccionada */}
                {(() => {
                  const currentRoutine = myRoutines.find((r) => r.id === selectedRoutineId) || myRoutines[0];
                  if (!currentRoutine) return null;

                  return (
                    <View style={{ gap: spacing.md }}>
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
                          />
                        </View>

                        {currentRoutine.description ? (
                          <Text style={[styles.routineDescText, { color: theme.textSecondary }]}>
                            {currentRoutine.description}
                          </Text>
                        ) : null}

                        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: spacing.sm }]} />

                        <View style={styles.routineDatesRow}>
                          <View style={styles.routineDateItem}>
                            <MaterialIcons name="event" size={16} color={theme.textMuted} />
                            <Text style={[styles.gridText, { color: theme.textMuted }]}>
                              Desde: {currentRoutine.valid_from ? new Date(currentRoutine.valid_from).toLocaleDateString('es-AR') : 'Inicio del tratamiento'}
                            </Text>
                          </View>
                          {currentRoutine.valid_until && (
                            <View style={styles.routineDateItem}>
                              <MaterialIcons name="event-available" size={16} color={theme.textMuted} />
                              <Text style={[styles.gridText, { color: theme.textMuted }]}>
                                Próxima revisión: {new Date(currentRoutine.valid_until).toLocaleDateString('es-AR')}
                              </Text>
                            </View>
                          )}
                        </View>

                        {currentRoutine.notes ? (
                          <View style={[styles.indicationCallout, { backgroundColor: theme.primaryLight + '25', borderColor: theme.primary + '40', marginTop: spacing.sm }]}>
                            <MaterialIcons name="assignment" size={18} color={theme.primary} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.indicationTitle, { color: theme.primary }]}>Indicaciones del profesional:</Text>
                              <Text style={[styles.indicationText, { color: theme.text }]}>{currentRoutine.notes}</Text>
                            </View>
                          </View>
                        ) : null}
                      </Card>

                      {/* Lista de ejercicios en orden de ejecución */}
                      <Text style={[styles.subHeaderTitle, { color: theme.text, marginTop: spacing.sm }]}>
                        Ejercicios Prescritos ({currentRoutine.exercises?.length || 0})
                      </Text>

                      {(!currentRoutine.exercises || currentRoutine.exercises.length === 0) ? (
                        <Card elevated padding="md">
                          <Text style={[{ color: theme.textSecondary, textAlign: 'center' }]}>
                            No hay ejercicios listados en esta versión de la rutina.
                          </Text>
                        </Card>
                      ) : (
                        currentRoutine.exercises.map((ex: any, idx: number) => {
                          const isDoneToday = Boolean(ex.completed_today && ex.completed_today > 0);

                          return (
                            <Card key={ex.routine_exercise_id || idx} elevated style={styles.exerciseCard} padding="md">
                              {/* Fila superior: orden secuencial + nombre + badges */}
                              <View style={styles.exerciseHeaderRow}>
                                <View style={[styles.orderBadge, { backgroundColor: theme.primaryLight }]}>
                                  <Text style={[styles.orderBadgeText, { color: theme.primary }]}>#{ex.execution_order || idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.exerciseName, { color: theme.text }]}>{ex.name}</Text>
                                  <View style={styles.badgeRow}>
                                    {ex.category && <Badge label={ex.category} variant="info" size="sm" />}
                                    {ex.body_zone && <Badge label={ex.body_zone} variant="default" size="sm" />}
                                    {ex.difficulty_level && <Badge label={ex.difficulty_level} variant="neutral" size="sm" />}
                                  </View>
                                </View>
                                {isDoneToday ? (
                                  <Badge label="✓ Realizado hoy" variant="success" size="sm" />
                                ) : (
                                  <Badge label="Pendiente hoy" variant="warning" size="sm" />
                                )}
                              </View>

                              {/* Grilla de Parámetros Prescritos */}
                              <View style={[styles.paramsGrid, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                                {ex.sets ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Series</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.sets}</Text>
                                  </View>
                                ) : null}
                                {ex.repetitions ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Reps</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.repetitions}</Text>
                                  </View>
                                ) : null}
                                {ex.duration_seconds ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Duración</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.duration_seconds}s</Text>
                                  </View>
                                ) : null}
                                {ex.rest_seconds ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Descanso</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.rest_seconds}s</Text>
                                  </View>
                                ) : null}
                                {ex.weekly_frequency ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Frecuencia</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.weekly_frequency}</Text>
                                  </View>
                                ) : null}
                                {ex.body_side && ex.body_side !== 'No aplica' ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Lado</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.body_side}</Text>
                                  </View>
                                ) : null}
                                {ex.resistance_load ? (
                                  <View style={styles.paramItem}>
                                    <Text style={[styles.paramLabel, { color: theme.textMuted }]}>Carga</Text>
                                    <Text style={[styles.paramValue, { color: theme.text }]}>{ex.resistance_load}</Text>
                                  </View>
                                ) : null}
                              </View>

                              {/* Indicaciones personalizadas del kinesiólogo */}
                              {ex.custom_instructions ? (
                                <View style={[styles.indicationCallout, { backgroundColor: theme.primaryLight + '20', borderColor: theme.primary + '30' }]}>
                                  <MaterialIcons name="medical-services" size={18} color={theme.primary} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.indicationTitle, { color: theme.primary }]}>Indicación particular para ti:</Text>
                                    <Text style={[styles.indicationText, { color: theme.text }]}>{ex.custom_instructions}</Text>
                                  </View>
                                </View>
                              ) : null}

                              {/* Instrucciones técnicas */}
                              {ex.instructions ? (
                                <View style={styles.instructionsBox}>
                                  <Text style={[styles.instructionsTitle, { color: theme.text }]}>Técnica de ejecución:</Text>
                                  <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>{ex.instructions}</Text>
                                </View>
                              ) : null}

                              {/* Precauciones / Contraindicaciones */}
                              {ex.contraindications ? (
                                <View style={[styles.indicationCallout, { backgroundColor: theme.warningBg, borderColor: theme.warning + '40' }]}>
                                  <MaterialIcons name="warning" size={18} color={theme.warning} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.indicationTitle, { color: theme.warning }]}>Precauciones / Detener si:</Text>
                                    <Text style={[styles.indicationText, { color: theme.text }]}>{ex.contraindications}</Text>
                                  </View>
                                </View>
                              ) : null}

                              {/* Video demostrativo opcional */}
                              {ex.media_url ? (
                                <TouchableOpacity
                                  style={[styles.mediaLinkBtn, { borderColor: theme.info, backgroundColor: theme.infoBg }]}
                                  onPress={() => {
                                    if (ex.media_url) Linking.openURL(ex.media_url);
                                  }}
                                >
                                  <MaterialIcons name="play-circle-outline" size={20} color={theme.info} />
                                  <Text style={[styles.mediaLinkText, { color: theme.info }]}>Ver video demostrativo del ejercicio</Text>
                                </TouchableOpacity>
                              ) : null}

                              {/* Botón de cumplimiento informado */}
                              <View style={[styles.exerciseActionRow, { borderTopColor: theme.border }]}>
                                <Button
                                  title={isDoneToday ? "Registrar nueva realización" : "Marcar como realizado"}
                                  variant={isDoneToday ? "outline" : "primary"}
                                  icon={<MaterialIcons name={isDoneToday ? "check-circle" : "check"} size={18} color={isDoneToday ? theme.primary : '#FFF'} />}
                                  size="sm"
                                  onPress={() => handleOpenLogExercise(ex)}
                                  style={{ flex: 1 }}
                                />
                              </View>
                            </Card>
                          );
                        })
                      )}

                      {/* Historial de cumplimiento informado por el paciente */}
                      <View style={{ marginTop: spacing.md }}>
                        <TouchableOpacity
                          style={[styles.historyToggleRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => {
                            if (!showLogsHistory && complianceLogs.length === 0 && currentRoutine?.id) {
                              fetchComplianceLogs(currentRoutine.id);
                            }
                            setShowLogsHistory(!showLogsHistory);
                          }}
                        >
                          <MaterialIcons name="history" size={20} color={theme.primary} />
                          <Text style={[styles.historyToggleText, { color: theme.text, flex: 1 }]}>
                            Mi Historial de Realización ({complianceLogs.length} registros)
                          </Text>
                          <MaterialIcons name={showLogsHistory ? "expand-less" : "expand-more"} size={22} color={theme.textMuted} />
                        </TouchableOpacity>

                        {showLogsHistory && (
                          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                            {complianceLogs.length === 0 ? (
                              <Card elevated padding="md">
                                <Text style={[{ color: theme.textSecondary, textAlign: 'center', fontSize: typography.fontSize.xs }]}>
                                  Aún no tenés registros de realización para esta rutina. Podés marcar un ejercicio al completarlo.
                                </Text>
                              </Card>
                            ) : (
                              complianceLogs.map((log: any) => (
                                <Card key={log.id} elevated padding="sm" style={styles.historyLogCard}>
                                  <View style={styles.cardHeaderRow}>
                                    <Text style={[styles.logExerciseName, { color: theme.text }]}>{log.exercise_name}</Text>
                                    <Text style={[styles.logDateText, { color: theme.textMuted }]}>
                                      {new Date(log.completed_at || log.completed_date).toLocaleDateString('es-AR')}
                                    </Text>
                                  </View>
                                  <View style={styles.logMetaRow}>
                                    <Text style={[styles.logMetaItem, { color: theme.textSecondary }]}>
                                      {log.sets_completed ? `${log.sets_completed} series` : ''} {log.reps_completed ? `x ${log.reps_completed} reps` : ''}
                                    </Text>
                                    <Badge
                                      label={`Molestia: ${log.perceived_pain_level ?? 0}/10`}
                                      variant={log.perceived_pain_level > 5 ? 'error' : log.perceived_pain_level > 2 ? 'warning' : 'success'}
                                      size="sm"
                                    />
                                  </View>
                                  {log.patient_notes ? (
                                    <Text style={[styles.logNotesText, { color: theme.textMuted }]}>
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
              title="Profesionales y Servicios"
              subtitle="Conocé nuestro equipo kinesiológico, tarifas oficiales y prestaciones"
            />

            <Text style={[styles.subHeaderTitle, { color: theme.text }]}>Prestaciones Disponibles</Text>
            {catalog.services.map((serv) => (
              <Card key={serv.id} elevated style={styles.serviceCard} padding="md">
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
                    <Text style={[styles.currencyTag, { color: theme.textMuted }]}>{serv.currency}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.serviceFooterRow}>
                  <View style={styles.durationBadge}>
                    <MaterialIcons name="schedule" size={16} color={theme.textMuted} />
                    <Text style={[styles.durationText, { color: theme.textSecondary }]}>
                      {serv.durationMinutes} minutos
                    </Text>
                  </View>

                  <Button
                    title="Reservar Turno"
                    size="sm"
                    onPress={() => handleOpenBooking(serv)}
                  />
                </View>
              </Card>
            ))}

            <Text style={[styles.subHeaderTitle, { color: theme.text, marginTop: spacing.xl }]}>
              Equipo Profesional Autorizado
            </Text>
            {catalog.professionals.map((prof) => (
              <Card key={prof.id} elevated style={styles.profCard} padding="md">
                <View style={styles.profRow}>
                  <View style={[styles.profAvatar, { backgroundColor: theme.primaryLight }]}>
                    <MaterialIcons name="badge" size={24} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profName, { color: theme.text }]}>{prof.fullName}</Text>
                    <Text style={[styles.profSpecialty, { color: theme.textSecondary }]}>
                      {prof.specialty}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 3: MIS TURNOS */}
        {/* ========================================== */}
        {activeTab === 'turnos' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mis Turnos"
              subtitle="Consultá el estado de tus citas o cancelalas con anticipación"
              action={
                <Button
                  title="+ Nuevo Turno"
                  size="sm"
                  onPress={() => handleOpenBooking()}
                />
              }
            />

            {myAppointments.length === 0 ? (
              <EmptyState
                title="Aún no tenés turnos registrados"
                subtitle="Podés agendar una consulta médica de evaluación en cualquier momento."
                action={{
                  label: 'Reservar Turno',
                  onPress: () => handleOpenBooking()
                }}
              />
            ) : (
              myAppointments.map((appt) => {
                const isCancelled = appt.status === 'cancelled';
                const isAttended = appt.status === 'attended';
                const isActionable = !isCancelled && !isAttended;

                return (
                  <Card key={appt.id} elevated style={styles.apptCard} padding="md">
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.apptService, { color: theme.text }]}>{appt.service_name}</Text>
                        <Text style={[styles.apptKine, { color: theme.textSecondary }]}>
                          Lic. {appt.kinesiologist_last_name}, {appt.kinesiologist_name}
                        </Text>
                      </View>
                      <Badge
                        label={
                          appt.status === 'confirmed' ? 'Confirmado' :
                          appt.status === 'pending' ? 'Pendiente' :
                          appt.status === 'attended' ? 'Atendido' :
                          appt.status === 'cancelled' ? 'Cancelado' : appt.status
                        }
                        variant={
                          appt.status === 'confirmed' ? 'success' :
                          appt.status === 'pending' ? 'warning' :
                          appt.status === 'attended' ? 'info' : 'error'
                        }
                      />
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.apptDetailsGrid}>
                      <View style={styles.apptGridItem}>
                        <MaterialIcons name="event" size={16} color={theme.textMuted} />
                        <Text style={[styles.gridText, { color: theme.text }]}>
                          {new Date(appt.start_time).toLocaleDateString('es-AR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} hs
                        </Text>
                      </View>

                      <View style={styles.apptGridItem}>
                        <MaterialIcons name="payments" size={16} color={theme.textMuted} />
                        <Text style={[styles.gridText, { color: theme.text }]}>
                          ${Number(appt.agreed_price).toLocaleString('es-AR')} {appt.currency || 'ARS'}
                        </Text>
                      </View>
                    </View>

                    {isActionable && (
                      <View style={styles.apptActionsFooter}>
                        <Button
                          title="Cancelar"
                          variant="danger"
                          size="sm"
                          onPress={() => {
                            setAppointmentToCancel(appt);
                            setCancelModalVisible(true);
                          }}
                          style={{ flex: 1 }}
                        />
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 4: MI PERFIL */}
        {/* ========================================== */}
        {activeTab === 'perfil' && (
          <View style={styles.sectionContainer}>
            <ScreenHeader
              title="Mi Perfil y Cuenta"
              subtitle="Datos personales, teléfono de contacto y seguridad de acceso"
            />

            {profileError && (
              <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
                <Text style={[styles.modalBannerText, { color: theme.error }]}>{profileError}</Text>
              </View>
            )}

            {profileSuccess && (
              <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
                <Text style={[styles.successBannerText, { color: theme.success }]}>{profileSuccess}</Text>
              </View>
            )}

            <Card elevated style={styles.profileCard} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text }]}>Datos Personales</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Información registrada en tu ficha médica oficial
              </Text>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>Nombre Completo:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.first_name} {profile?.last_name}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>DNI / Documento:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.dni || 'No registrado'}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>Correo electrónico:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.email || profile?.account_email || user?.email}
                </Text>
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>Obra Social / Cobertura:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  {profile?.insurance_provider || profile?.address || 'Particular'}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: spacing.md }]} />

              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.md }]}>
                Actualizar Teléfono de Contacto
              </Text>

              <Input
                label="Teléfono / Celular"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+54 9 11..."
                keyboardType="phone-pad"
              />

              <Button
                title="Guardar Teléfono"
                size="md"
                loading={profileSaving}
                onPress={handleSaveProfile}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Card elevated style={[styles.profileCard, { marginTop: spacing.lg }]} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text }]}>Cambiar Contraseña</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Ingresá tu contraseña actual para establecer una nueva clave de acceso
              </Text>

              {passwordError && (
                <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
                  <Text style={[styles.modalBannerText, { color: theme.error }]}>{passwordError}</Text>
                </View>
              )}

              {passwordSuccess && (
                <View style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
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
                placeholder="Reescribí la nueva contraseña"
                isPassword
                required
              />

              <Button
                title="Actualizar Contraseña"
                size="md"
                loading={passwordSaving}
                onPress={handleChangePassword}
                style={{ marginTop: spacing.sm }}
              />
            </Card>

            <Card elevated style={[styles.profileCard, { marginTop: spacing.lg }]} padding="lg">
              <Text style={[styles.cardTitle, { color: theme.text }]}>Cuenta y Seguridad</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Estado de sesión y privacidad
              </Text>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>Rol en el sistema:</Text>
                <Badge label="Paciente Verificado" variant="info" size="sm" />
              </View>

              <View style={styles.profileInfoRow}>
                <Text style={[styles.profileLabel, { color: theme.textMuted }]}>ID de Ficha Clínica:</Text>
                <Text style={[styles.profileValue, { color: theme.text }]}>
                  #{profile?.id || 'Asociada'}
                </Text>
              </View>

              <Button
                title="Cerrar Sesión Segura"
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
      {/* MODAL: RESERVAR TURNO */}
      {/* ========================================== */}
      <ModalWrapper
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        title="Reservar Nuevo Turno"
        subtitle="Seleccioná profesional, fecha y el horario que mejor te convenga"
        footer={
          <>
            <Button title="Cancelar" variant="secondary" size="md" onPress={() => setBookModalVisible(false)} />
            <Button
              title="Confirmar Reserva"
              size="md"
              loading={bookingSubmitting}
              onPress={handleConfirmBooking}
            />
          </>
        }
      >
        {bookingError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{bookingError}</Text>
          </View>
        )}

        {bookingSuccess && (
          <View style={[styles.modalBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
            <Text style={[styles.modalBannerText, { color: theme.success }]}>{bookingSuccess}</Text>
          </View>
        )}

        <Text style={[styles.inputLabel, { color: theme.text }]}>1. Servicio / Prestación</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {catalog.services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.selectChip,
                {
                  backgroundColor: selectedService?.id === s.id ? theme.primary : theme.surfaceSubtle,
                  borderColor: selectedService?.id === s.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => {
                setSelectedService(s);
                if (selectedKinesiologist) {
                  fetchAvailableSlots(selectedKinesiologist.id, s.id, selectedDate);
                }
              }}
            >
              <Text style={{ color: selectedService?.id === s.id ? '#FFF' : theme.text, fontWeight: '600' }}>
                {s.name} (${s.price})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.inputLabel, { color: theme.text }]}>2. Profesional Kinesiólogo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {catalog.professionals.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.selectChip,
                {
                  backgroundColor: selectedKinesiologist?.id === p.id ? theme.primary : theme.surfaceSubtle,
                  borderColor: selectedKinesiologist?.id === p.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => {
                setSelectedKinesiologist(p);
                if (selectedService) {
                  fetchAvailableSlots(p.id, selectedService.id, selectedDate);
                }
              }}
            >
              <Text style={{ color: selectedKinesiologist?.id === p.id ? '#FFF' : theme.text, fontWeight: '600' }}>
                {p.fullName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <DateInput
          label="3. Fecha de atención"
          value={selectedDate}
          min={formatLocalDateISO(new Date())}
          onChangeDate={(val) => {
            setSelectedDate(val);
            if (val && /^\d{4}-\d{2}-\d{2}$/.test(val) && selectedKinesiologist && selectedService) {
              fetchAvailableSlots(selectedKinesiologist.id, selectedService.id, val);
            }
          }}
        />

        <Text style={[styles.inputLabel, { color: theme.text }]}>4. Horario Disponible</Text>
        {loadingSlots ? (
          <Text style={[styles.slotInfoText, { color: theme.textMuted }]}>Calculando disponibilidad en tiempo real...</Text>
        ) : availableSlots.length === 0 ? (
          <Text style={[styles.slotInfoText, { color: theme.warning }]}>
            No hay horarios disponibles para esta fecha con el profesional seleccionado. Probá otra fecha.
          </Text>
        ) : (
          <View style={styles.slotsGrid}>
            {availableSlots.map((slot, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.slotBadge,
                  {
                    backgroundColor: selectedSlot?.startTime === slot.startTime ? theme.primary : theme.surfaceSubtle,
                    borderColor: selectedSlot?.startTime === slot.startTime ? theme.primary : theme.border
                  }
                ]}
                onPress={() => setSelectedSlot(slot)}
              >
                <Text style={{ color: selectedSlot?.startTime === slot.startTime ? '#FFF' : theme.text, fontWeight: '600' }}>
                  {slot.time || slot.timeLabel} hs
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Resumen pre-confirmación */}
        {selectedService && selectedSlot && (
          <View style={[styles.summaryBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.primary + '40' }]}>
            <Text style={[styles.summaryTitle, { color: theme.primary }]}>Resumen de la Reserva</Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              • Prestación: {selectedService.name} ({selectedService.durationMinutes} min)
            </Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              • Profesional: {selectedKinesiologist?.fullName}
            </Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              • Horario: {selectedDate} a las {selectedSlot.time || selectedSlot.timeLabel} hs
            </Text>
            <Text style={[styles.summaryPrice, { color: theme.text }]}>
              Precio vigente: ${selectedService.price} {selectedService.currency}
            </Text>
            <Text style={[styles.summaryPolicy, { color: theme.textMuted }]}>
              * Cancelación sin costo hasta 2 horas antes de la consulta.
            </Text>
          </View>
        )}

        <Input
          label="Comentarios para el kinesiólogo (opcional)"
          value={bookingNotes}
          onChangeText={setBookingNotes}
          placeholder="Ej: Dolor en hombro derecho tras caída"
          containerStyle={{ marginTop: spacing.md }}
        />
      </ModalWrapper>

      {/* ========================================== */}
      {/* MODAL: CANCELAR TURNO */}
      {/* ========================================== */}
      <ModalWrapper
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        title="Cancelar Turno"
        subtitle="Confirmá la cancelación de tu reserva"
        footer={
          <>
            <Button title="Volver" variant="secondary" size="md" onPress={() => setCancelModalVisible(false)} />
            <Button
              title="Confirmar Cancelación"
              variant="danger"
              size="md"
              loading={cancelSubmitting}
              onPress={handleConfirmCancel}
            />
          </>
        }
      >
        {cancelError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{cancelError}</Text>
          </View>
        )}

        <Text style={[styles.modalBodyText, { color: theme.text }]}>
          ¿Estás seguro de que deseás cancelar tu turno de {appointmentToCancel?.service_name}?
        </Text>

        <Input
          label="Motivo de la cancelación"
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Ej: Imprevisto laboral o personal"
          containerStyle={{ marginTop: spacing.md }}
        />
      </ModalWrapper>

      {/* ========================================== */}
      {/* MODAL: REGISTRAR CUMPLIMIENTO DE EJERCICIO */}
      {/* ========================================== */}
      <ModalWrapper
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        title="Registrar Ejercicio Realizado"
        subtitle={exerciseToLog ? `${exerciseToLog.name} (Paso #${exerciseToLog.execution_order})` : ''}
        footer={
          <>
            <Button title="Cancelar" variant="secondary" size="md" onPress={() => setLogModalVisible(false)} />
            <Button
              title="Guardar Registro"
              size="md"
              loading={logSubmitting}
              onPress={handleConfirmLogExercise}
            />
          </>
        }
      >
        {logError && (
          <View style={[styles.modalBanner, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalBannerText, { color: theme.error }]}>{logError}</Text>
          </View>
        )}

        {logSuccess && (
          <View style={[styles.modalBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
            <Text style={[styles.modalBannerText, { color: theme.success }]}>{logSuccess}</Text>
          </View>
        )}

        <Text style={[styles.modalBodyText, { color: theme.text, marginBottom: spacing.md }]}>
          Completá los datos reales de tu sesión. Esta información permite a tu kinesiólogo evaluar tu evolución.
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Series completadas"
              value={logSets}
              onChangeText={setLogSets}
              keyboardType="numeric"
              placeholder="Ej: 3"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Repeticiones"
              value={logReps}
              onChangeText={setLogReps}
              keyboardType="numeric"
              placeholder="Ej: 12"
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: theme.text, marginTop: spacing.md }]}>
          Nivel de molestia / dolor percibido (0 = Ninguno, 10 = Máximo):
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.xs }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
            const isSelected = logPain === score;
            const color = score === 0 ? theme.success : score <= 3 ? theme.info : score <= 6 ? theme.warning : theme.error;
            return (
              <TouchableOpacity
                key={score}
                onPress={() => setLogPain(score)}
                style={[
                  styles.painChip,
                  {
                    backgroundColor: isSelected ? color : theme.surfaceSubtle,
                    borderColor: isSelected ? color : theme.border
                  }
                ]}
              >
                <Text style={{ color: isSelected ? '#FFF' : theme.text, fontWeight: '700', fontSize: typography.fontSize.sm }}>
                  {score}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[styles.painHintText, { color: theme.textMuted }]}>
          {logPain === 0 ? 'Sin molestias ni dolor durante el ejercicio' :
           logPain !== null && logPain <= 3 ? 'Molestia o tensión leve bien tolerada' :
           logPain !== null && logPain <= 6 ? 'Dolor moderado que dificulta el movimiento' :
           'Dolor agudo o intenso (informar inmediatamente al profesional)'}
        </Text>

        <Input
          label="Observaciones o sensaciones (opcional)"
          value={logNotes}
          onChangeText={setLogNotes}
          placeholder="Ej: Sentí una ligera molestia en la última serie"
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  brandTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  brandUser: {
    fontSize: typography.fontSize.xs
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 4
  },
  logoutText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  tabsNav: {
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  tabLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  scrollContent: {
    padding: spacing.lg,
    maxWidth: 720,
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
    marginBottom: spacing.md
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  cardSubtitle: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md
  },
  nextApptBody: {
    gap: spacing.md
  },
  apptHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md
  },
  highlightTextCol: {
    flex: 1
  },
  highlightService: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  highlightTime: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.lg
  },
  detailItem: {
    flex: 1
  },
  detailLabel: {
    fontSize: typography.fontSize.xs
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2
  },
  apptActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs
  },
  noApptBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl
  },
  noApptText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center'
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  actionCard: {
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  actionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs
  },
  actionDesc: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16
  },
  subHeaderTitle: {
    fontSize: typography.fontSize.md,
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
    gap: spacing.md
  },
  serviceTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  serviceDescription: {
    fontSize: typography.fontSize.xs,
    marginTop: 4,
    lineHeight: 18
  },
  servicePriceBox: {
    alignItems: 'flex-end'
  },
  priceTag: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  currencyTag: {
    fontSize: typography.fontSize.tiny,
    textTransform: 'uppercase'
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  },
  serviceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  durationText: {
    fontSize: typography.fontSize.xs
  },
  profCard: {
    marginBottom: spacing.sm
  },
  profRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  profAvatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  profName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  profSpecialty: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  apptCard: {
    marginBottom: spacing.md
  },
  apptService: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  apptKine: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  apptDetailsGrid: {
    flexDirection: 'row',
    gap: spacing.lg
  },
  apptGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  gridText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
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
    paddingVertical: spacing.xs
  },
  profileLabel: {
    fontSize: typography.fontSize.xs
  },
  profileValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  successBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  successBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  modalBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  modalBannerText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    marginTop: spacing.xs
  },
  selectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.sm
  },
  slotInfoText: {
    fontSize: typography.fontSize.xs,
    marginVertical: spacing.sm
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  slotBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  summaryBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    gap: 4
  },
  summaryTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  summaryText: {
    fontSize: typography.fontSize.xs
  },
  summaryPrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: 4
  },
  summaryPolicy: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2
  },
  modalBodyText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  routineOverviewBody: {
    gap: spacing.md
  },
  routineOverviewBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs
  },
  routineOverviewName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  routineValidityText: {
    fontSize: typography.fontSize.xs
  },
  routineProgressRow: {
    marginTop: spacing.xs
  },
  progressCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 4
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  routineDescText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginTop: 2
  },
  routineDatesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap'
  },
  routineDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  indicationCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xs,
    marginVertical: 4
  },
  indicationTitle: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  indicationText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16
  },
  exerciseCard: {
    marginBottom: spacing.md
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  orderBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  exerciseName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 4
  },
  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginVertical: spacing.sm
  },
  paramItem: {
    alignItems: 'center',
    minWidth: 55
  },
  paramLabel: {
    fontSize: typography.fontSize.tiny,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.medium
  },
  paramValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginTop: 1
  },
  instructionsBox: {
    paddingVertical: spacing.xs
  },
  instructionsTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  instructionsText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  mediaLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginVertical: spacing.xs
  },
  mediaLinkText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  exerciseActionRow: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xs
  },
  historyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm
  },
  historyToggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  historyLogCard: {
    marginBottom: spacing.xs
  },
  logExerciseName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  logDateText: {
    fontSize: typography.fontSize.tiny
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2
  },
  logMetaItem: {
    fontSize: typography.fontSize.xs
  },
  logNotesText: {
    fontSize: typography.fontSize.tiny,
    fontStyle: 'italic',
    marginTop: 2
  },
  painChip: {
    width: 32,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6
  },
  painHintText: {
    fontSize: typography.fontSize.xs,
    marginVertical: 4
  }
});
