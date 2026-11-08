/**
 * @file AppointmentsScreen.tsx
 * @description Pantalla de agenda médica y turnos: filtro por kinesiólogo/fecha y cambio de asistencia.
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, BadgeVariant, DateInput } from '../components/ui';
import { LoadingState, ErrorState } from '../components/FeedbackStates';
import {
  fetchBookingCalendarAvailability,
  evaluateDateClient,
  getBookingWindow,
  invalidateBookingCalendarCache,
  CalendarDayStatus
} from '../utils/bookingCalendar';

const appointmentSchema = z.object({
  patient_id: z.coerce.number().positive('Seleccioná un paciente.'),
  kinesiologist_id: z.coerce.number().positive('Seleccioná un profesional.'),
  service_id: z.coerce.number().positive().default(1),
  scheduled_at: z.string().min(10, 'Seleccioná fecha y hora.'),
  duration_minutes: z.coerce.number().min(15, 'Mínimo 15 min.').max(180, 'Máximo 180 min.'),
  reason: z.string().optional()
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAppointmentDate(item: any): Date | null {
  const raw = item.start_time || item.scheduled_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getAppointmentDateStr(item: any): string {
  const d = getAppointmentDate(item);
  if (!d) return '';
  return formatDateISO(d);
}

function getAppointmentTimeStr(item: any): string {
  const d = getAppointmentDate(item);
  if (!d) return '10:00';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const AppointmentsScreen = () => {
  const { theme } = useAppTheme();
  const { scopeVersions } = useDataSync();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmCancelApptId, setConfirmCancelApptId] = useState<number | null>(null);
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()));

  // Estado para el selector desplegable de pacientes
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [apptDate, setApptDate] = useState<string>(() => formatDateISO(new Date()));
  const [apptTime, setApptTime] = useState<string>('10:00');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Ventana de reserva (hoy a hoy + 14 días calendario) y feriados
  const defaultWindow = useMemo(() => getBookingWindow(), []);
  const [bookingMinDate, setBookingMinDate] = useState<string>(defaultWindow.minDate);
  const [bookingMaxDate, setBookingMaxDate] = useState<string>(defaultWindow.maxDate);
  const [firstAvailableDate, setFirstAvailableDate] = useState<string>(defaultWindow.minDate);
  const [calendarByDate, setCalendarByDate] = useState<Record<string, CalendarDayStatus>>({});

  // Modal de feriados y días no laborables opcionales
  const [holidaysModalVisible, setHolidaysModalVisible] = useState(false);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [togglingHolidayDate, setTogglingHolidayDate] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema) as any,
    defaultValues: {
      patient_id: 0,
      kinesiologist_id: 2,
      service_id: 1,
      scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + ' 10:00:00',
      duration_minutes: 45,
      reason: 'Sesión de kinesiología y rehabilitación'
    }
  });

  const selectedPatientId = watch('patient_id');
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === Number(selectedPatientId)),
    [patients, selectedPatientId]
  );

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase().trim();
    return patients.filter((p) => {
      const fullName = `${p.last_name || ''} ${p.first_name || ''}`.toLowerCase();
      const dni = String(p.dni || '');
      return fullName.includes(q) || dni.includes(q);
    });
  }, [patients, patientSearch]);

  const loadCalendarAndHolidays = async (forceRefresh = false) => {
    try {
      const cal = await fetchBookingCalendarAvailability('staff', forceRefresh);
      setBookingMinDate(cal.minDate);
      setBookingMaxDate(cal.maxDate);
      setFirstAvailableDate(cal.firstAvailableDate);
      setCalendarByDate(cal.byDate);
    } catch {
      // Fallback en bookingCalendar
    }
  };

  const fetchHolidaysForYear = async (year = new Date().getFullYear()) => {
    try {
      setHolidayError(null);
      const res = await apiClient.post('/appointments/holidays/search', { year });
      if (res.data?.success) {
        const payload = res.data.data;
        setHolidaysList(Array.isArray(payload) ? payload : payload?.holidays || []);
      }
    } catch (err: any) {
      setHolidayError(err.response?.data?.error?.message || 'Error al consultar feriados');
    }
  };

  const handleToggleOptionalHoliday = async (dateStr: string, nextClosed: boolean) => {
    try {
      setTogglingHolidayDate(dateStr);
      setHolidayError(null);
      const res = await apiClient.post('/appointments/holidays/toggle-optional', {
        date: dateStr,
        isClosed: nextClosed
      });
      if (res.data?.success) {
        invalidateBookingCalendarCache();
        await Promise.all([loadCalendarAndHolidays(true), fetchHolidaysForYear()]);
        if (modalVisible && apptDate === dateStr) {
          fetchAgendaSlots(dateStr);
        }
      }
    } catch (err: any) {
      setHolidayError(err.response?.data?.error?.message || 'No se pudo actualizar el día no laborable');
    } finally {
      setTogglingHolidayDate(null);
    }
  };

  const fetchAppointments = async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: POST para consultas
      const response = await apiClient.post('/appointments/search', {
        page: 1,
        limit: 100
      });
      if (response.data?.success) {
        setAppointments(response.data.data);
        setError(null);
      }
    } catch (err: any) {
      if (!silent || appointments.length === 0) {
        setError(err.response?.data?.error?.message || 'Error al obtener la agenda de turnos');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPatientsList = async () => {
    try {
      const res = await apiClient.post('/patients/search', { page: 1, limit: 300 });
      if (res.data?.success) {
        const list = res.data.data || [];
        setPatients(list);
        if (list.length > 0 && (!selectedPatientId || selectedPatientId === 0)) {
          setValue('patient_id', list[0].id, { shouldValidate: true });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchAppointments(false);
    fetchPatientsList();
    loadCalendarAndHolidays(false);
  }, []);

  useEffect(() => {
    if (
      scopeVersions.appointments > 0 ||
      scopeVersions.patients > 0 ||
      scopeVersions.services > 0
    ) {
      fetchAppointments(true);
      fetchPatientsList();
      loadCalendarAndHolidays(true);
    }
  }, [scopeVersions.appointments, scopeVersions.patients, scopeVersions.services]);

  const fetchAgendaSlots = async (dateStr: string, customMap?: Record<string, CalendarDayStatus>) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const mapToUse = customMap || calendarByDate;
    const evalResult = evaluateDateClient(dateStr, mapToUse, bookingMinDate, bookingMaxDate);
    if (evalResult.disabled) {
      setAvailableSlots([]);
      setApptTime('');
      setFormError(evalResult.reason || 'El consultorio permanece cerrado en la fecha seleccionada.');
      return;
    }

    setLoadingSlots(true);
    setFormError(null);
    try {
      const res = await apiClient.post('/appointments/available-slots', {
        kinesiologistId: 2,
        serviceId: 1,
        date: dateStr
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        setAvailableSlots(list);
        if (list.length > 0) {
          const firstTime = list[0].time || list[0].timeLabel || '10:00';
          setApptTime(firstTime);
          setValue('scheduled_at', `${dateStr} ${firstTime}:00`, { shouldValidate: true });
        } else {
          setApptTime('');
        }
      }
    } catch {
      const recheck = evaluateDateClient(dateStr, mapToUse, bookingMinDate, bookingMaxDate);
      if (recheck.disabled) {
        setAvailableSlots([]);
        setApptTime('');
        setFormError(recheck.reason || 'Fecha no laborable');
        return;
      }
      const fallback = Array.from({ length: 11 }, (_, i) => {
        const timeStr = `${String(8 + i).padStart(2, '0')}:00`;
        return { startTime: `${dateStr} ${timeStr}:00`, time: timeStr, timeLabel: timeStr, available: true };
      });
      setAvailableSlots(fallback);
      setApptTime('10:00');
      setValue('scheduled_at', `${dateStr} 10:00:00`, { shouldValidate: true });
    } finally {
      setLoadingSlots(false);
    }
  };

  const openCreateModal = async (targetDateStr?: string) => {
    setFormError(null);
    fetchPatientsList();
    const cal = await fetchBookingCalendarAvailability('staff');
    setBookingMinDate(cal.minDate);
    setBookingMaxDate(cal.maxDate);
    setFirstAvailableDate(cal.firstAvailableDate);
    setCalendarByDate(cal.byDate);

    const defaultPid = patients.length > 0 ? patients[0].id : 0;
    const initialDate = targetDateStr || cal.firstAvailableDate;
    setApptDate(initialDate);
    setApptTime('10:00');
    reset({
      patient_id: defaultPid,
      kinesiologist_id: 2,
      service_id: 1,
      scheduled_at: `${initialDate} 10:00:00`,
      duration_minutes: 45,
      reason: 'Sesión de kinesiología y rehabilitación'
    });
    setShowPatientPicker(false);
    setPatientSearch('');
    setModalVisible(true);
    fetchAgendaSlots(initialDate, cal.byDate);
  };

  const onCreateAppointment = async (data: AppointmentFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/appointments', data);
      if (response.data?.success) {
        const createdId = response.data.data?.id || Date.now();
        const pat = patients.find((p) => p.id === Number(data.patient_id));
        const optimisticItem = {
          id: createdId,
          patient_id: data.patient_id,
          kinesiologist_id: data.kinesiologist_id,
          service_id: data.service_id,
          start_time: data.scheduled_at,
          scheduled_at: data.scheduled_at,
          duration_minutes: data.duration_minutes,
          notes: data.reason,
          reason: data.reason,
          status: 'scheduled',
          patient_first_name: pat?.first_name || '',
          patient_last_name: pat?.last_name || '',
          patient_dni: pat?.dni || ''
        };
        setAppointments((prev) => [optimisticItem, ...prev.filter((a) => a.id !== createdId)]);
        const targetDayDate = new Date(`${apptDate}T12:00:00`);
        if (!isNaN(targetDayDate.getTime())) {
          setCurrentWeekMonday(getMonday(targetDayDate));
        }
        setModalVisible(false);
        reset();
        await fetchAppointments(true);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al agendar el turno');
    }
  };

  const onUpdateStatus = async (appointmentId: number, nextStatus: string) => {
    const previousList = appointments;
    try {
      setUpdatingId(appointmentId);
      setAppointments((prev) =>
        prev.map((item) => (item.id === appointmentId ? { ...item, status: nextStatus } : item))
      );
      const res = await apiClient.patch(`/appointments/${appointmentId}`, {
        status: nextStatus
      });
      if (res.data?.success) {
        await fetchAppointments(true);
      }
    } catch (err: any) {
      setAppointments(previousList);
      console.error('Error al actualizar estado:', err?.response?.data || err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Cálculo de los 5 días de la semana (Lunes a Viernes)
  const weekDays = useMemo(() => {
    const todayStr = formatDateISO(new Date());
    return [0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(currentWeekMonday);
      d.setDate(d.getDate() + offset);
      const dateStr = formatDateISO(d);
      return {
        dayIndex: offset,
        dayName: DAY_NAMES[offset],
        dayNumber: d.getDate(),
        monthName: MONTH_NAMES[d.getMonth()],
        dateStr,
        date: d,
        isToday: dateStr === todayStr
      };
    });
  }, [currentWeekMonday]);

  const weekTitle = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[4];
    if (!first || !last) return '';
    if (first.monthName === last.monthName) {
      return `${first.dayNumber} al ${last.dayNumber} de ${first.monthName} ${first.date.getFullYear()}`;
    }
    return `${first.dayNumber} de ${first.monthName} al ${last.dayNumber} de ${last.monthName} ${first.date.getFullYear()}`;
  }, [weekDays]);

  const isCurrentWeek = useMemo(() => {
    return formatDateISO(currentWeekMonday) === formatDateISO(getMonday(new Date()));
  }, [currentWeekMonday]);

  const horizontalScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollViewportWidthRef = useRef<number>(
    Dimensions.get('window').width - (Platform.OS === 'web' ? spacing.xl * 2 : spacing.md * 2)
  );

  const centerOnToday = useCallback(
    (animated = false) => {
      if (!horizontalScrollRef.current) return;
      const todayIndex = weekDays.findIndex((d) => d.isToday);
      if (todayIndex === -1) {
        horizontalScrollRef.current.scrollTo({ x: 0, animated });
        return;
      }
      const columnWidth = 270;
      const gap = spacing.md;
      const viewportWidth = scrollViewportWidthRef.current;
      const totalContentWidth = weekDays.length * columnWidth + (weekDays.length - 1) * gap;
      const columnCenterX = todayIndex * (columnWidth + gap) + columnWidth / 2;
      const maxScrollX = Math.max(0, totalContentWidth - viewportWidth);
      const targetX = Math.max(0, Math.min(maxScrollX, columnCenterX - viewportWidth / 2));

      horizontalScrollRef.current.scrollTo({ x: targetX, animated });
    },
    [weekDays]
  );

  useFocusEffect(
    useCallback(() => {
      fetchAppointments(true);
      fetchPatientsList();
      const timer = setTimeout(() => {
        centerOnToday(false);
      }, 60);
      return () => clearTimeout(timer);
    }, [centerOnToday])
  );

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        centerOnToday(true);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [currentWeekMonday, loading, centerOnToday]);

  const goToPrevWeek = () => {
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() - 7);
    setCurrentWeekMonday(d);
  };

  const goToNextWeek = () => {
    const d = new Date(currentWeekMonday);
    d.setDate(d.getDate() + 7);
    setCurrentWeekMonday(d);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekMonday(getMonday(new Date()));
  };

  // Conteo de turnos de la semana para los chips de filtro
  const weekStats = useMemo(() => {
    const weekSet = new Set(weekDays.map((d) => d.dateStr));
    const appointmentsInWeek = appointments.filter((item) => {
      const dStr = getAppointmentDateStr(item);
      return weekSet.has(dStr);
    });

    const counts = {
      all: appointmentsInWeek.length,
      pending: 0,
      confirmed: 0,
      attended: 0,
      cancelled: 0
    };

    appointmentsInWeek.forEach((item) => {
      const s = String(item.status || '').toLowerCase();
      if (s === 'pending' || s === 'scheduled') counts.pending++;
      else if (s === 'confirmed') counts.confirmed++;
      else if (s === 'attended' || s === 'completed') counts.attended++;
      else if (s === 'cancelled' || s === 'absent' || s === 'no_show') counts.cancelled++;
    });

    return counts;
  }, [appointments, weekDays]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: weekStats.all },
    { key: 'pending', label: 'Programados', count: weekStats.pending },
    { key: 'confirmed', label: 'Confirmados', count: weekStats.confirmed },
    { key: 'attended', label: 'Atendidos', count: weekStats.attended },
    { key: 'cancelled', label: 'Cancelados', count: weekStats.cancelled }
  ];

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    return appointments.filter((item) => {
      const s = String(item.status || '').toLowerCase();
      if (statusFilter === 'pending') {
        return s === 'pending' || s === 'scheduled';
      }
      if (statusFilter === 'confirmed') {
        return s === 'confirmed';
      }
      if (statusFilter === 'attended') {
        return s === 'attended' || s === 'completed';
      }
      if (statusFilter === 'cancelled') {
        return s === 'cancelled' || s === 'absent' || s === 'no_show';
      }
      return s === statusFilter;
    });
  }, [appointments, statusFilter]);

  // Turnos agrupados por cada uno de los 5 días y ordenados por hora
  const appointmentsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    weekDays.forEach((d) => {
      map[d.dateStr] = [];
    });

    filteredAppointments.forEach((item) => {
      const dStr = getAppointmentDateStr(item);
      if (map[dStr]) {
        map[dStr].push(item);
      }
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const timeA = new Date(a.start_time || a.scheduled_at).getTime();
        const timeB = new Date(b.start_time || b.scheduled_at).getTime();
        return timeA - timeB;
      });
    });

    return map;
  }, [weekDays, filteredAppointments]);

  const getStatusBadge = (status: string): { label: string; variant: BadgeVariant } => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'attended':
      case 'completed':
        return { label: 'Atendido', variant: 'success' };
      case 'confirmed':
        return { label: 'Confirmado', variant: 'default' };
      case 'pending':
      case 'scheduled':
        return { label: 'Programado', variant: 'info' };
      case 'cancelled':
        return { label: 'Cancelado', variant: 'error' };
      case 'absent':
      case 'no_show':
        return { label: 'Ausente', variant: 'warning' };
      default:
        return { label: s || 'Pendiente', variant: 'neutral' };
    }
  };

  if (loading && !refreshing && appointments.length === 0) {
    return <LoadingState message="Cargando agenda..." />;
  }
  if (error && appointments.length === 0) {
    return <ErrorState message={error} onRetry={() => fetchAppointments(false)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Agenda de Turnos"
        subtitle="Lunes a viernes"
        action={
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            <Button
              title="Feriados"
              variant="secondary"
              size="sm"
              onPress={() => {
                fetchHolidaysForYear(new Date().getFullYear());
                setHolidaysModalVisible(true);
              }}
            />
            <Button
              title="+ Agendar Turno"
              onPress={() => openCreateModal()}
              size="sm"
            />
          </View>
        }
      />

      {/* Chips de filtro por estado */}
      <View style={styles.filterRow}>
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.primary : theme.surface,
                  borderColor: isActive ? theme.primary : theme.border
                }
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? '#FFFFFF' : theme.textSecondary }
                ]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Barra de navegación de la semana */}
      <View style={[styles.weekNavContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.navButton, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}
          onPress={goToPrevWeek}
          accessibilityLabel="Semana anterior"
          accessibilityRole="button"
        >
          <MaterialIcons name="chevron-left" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.weekInfoCenter}>
          <View style={styles.weekTitleRow}>
            <MaterialIcons name="calendar-today" size={16} color={theme.primary} />
            <Text style={[styles.weekTitleText, { color: theme.text }]}>
              {weekTitle}
            </Text>
          </View>
          {!isCurrentWeek && (
            <TouchableOpacity
              style={[styles.todayButton, { backgroundColor: theme.primarySoft || '#E8F5E9', borderColor: theme.primary }]}
              onPress={goToCurrentWeek}
            >
              <Text style={[styles.todayButtonText, { color: theme.primary }]}>Volver a esta semana</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.navButton, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}
          onPress={goToNextWeek}
          accessibilityLabel="Semana siguiente"
          accessibilityRole="button"
        >
          <MaterialIcons name="chevron-right" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Cuadro de 5 días (Lunes a Viernes) */}
      <ScrollView
        style={styles.gridOuterScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAppointments();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.columnsContainer}
          onLayout={(e) => {
            scrollViewportWidthRef.current = e.nativeEvent.layout.width;
            centerOnToday(false);
          }}
          onContentSizeChange={() => {
            centerOnToday(false);
          }}
        >
          {weekDays.map((day) => {
            const dayAppointments = appointmentsByDay[day.dateStr] || [];
            const isToday = day.isToday;

            return (
              <View
                key={day.dateStr}
                style={[
                  styles.dayColumn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isToday ? theme.primary : theme.border,
                    borderWidth: isToday ? 2 : 1
                  }
                ]}
              >
                {/* Cabecera del día */}
                <View
                  style={[
                    styles.dayColumnHeader,
                    {
                      backgroundColor: isToday ? (theme.primarySoft || '#E8F5E9') : theme.surfaceSubtle,
                      borderBottomColor: theme.border
                    }
                  ]}
                >
                  <View style={styles.dayHeaderTop}>
                    <View style={styles.dayTitleRow}>
                      <Text
                        style={[
                          styles.dayNameText,
                          { color: isToday ? theme.primary : theme.text }
                        ]}
                      >
                        {day.dayName.toUpperCase()}
                      </Text>
                      {isToday && (
                        <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                          <Text style={styles.todayBadgeText}>HOY</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.quickAddButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => openCreateModal(day.dateStr)}
                      accessibilityLabel={`Agendar turno para ${day.dayName}`}
                    >
                      <MaterialIcons name="add" size={16} color={theme.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dayHeaderBottom}>
                    <Text style={[styles.dayDateText, { color: theme.textSecondary }]}>
                      {day.dayNumber} {day.monthName.slice(0, 3)}
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: dayAppointments.length > 0 ? theme.primaryLight + '50' : theme.surface }]}>
                      <Text
                        style={[
                          styles.countBadgeText,
                          { color: dayAppointments.length > 0 ? theme.primary : theme.textMuted }
                        ]}
                      >
                        {dayAppointments.length} {dayAppointments.length === 1 ? 'turno' : 'turnos'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Lista de turnos del día */}
                <View style={styles.dayColumnBody}>
                  {dayAppointments.length === 0 ? (
                    <View style={styles.dayEmptyContainer}>
                      <MaterialIcons name="event-available" size={32} color={theme.textMuted} />
                      <Text style={[styles.dayEmptyText, { color: theme.textSecondary }]}>
                        Sin turnos
                      </Text>
                      <TouchableOpacity
                        style={[styles.dayEmptyAddBtn, { borderColor: theme.border }]}
                        onPress={() => openCreateModal(day.dateStr)}
                      >
                        <MaterialIcons name="add" size={14} color={theme.primary} />
                        <Text style={[styles.dayEmptyAddText, { color: theme.primary }]}>Agendar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    dayAppointments.map((item) => {
                      const badge = getStatusBadge(item.status);
                      const patientName = item.patient_name
                        ? `${item.patient_last_name || ''}, ${item.patient_name}`
                        : (item.patient_last_name && item.patient_first_name)
                          ? `${item.patient_last_name}, ${item.patient_first_name}`
                          : `Paciente #${item.patient_id}`;
                      const statusRaw = String(item.status || '').toLowerCase();
                      const isUpdating = updatingId === item.id;
                      const timeStr = getAppointmentTimeStr(item);

                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.appointmentItemCard,
                            {
                              backgroundColor: theme.surfaceElevated || theme.surface,
                              borderColor: theme.border
                            }
                          ]}
                        >
                          <View style={styles.itemHeader}>
                            <View style={styles.itemTimeRow}>
                              <MaterialIcons name="schedule" size={14} color={theme.primary} />
                              <Text style={[styles.itemTimeText, { color: theme.text }]}>
                                {timeStr} hs
                              </Text>
                              <Text style={[styles.itemDurationText, { color: theme.textSecondary }]}>
                                {item.duration_minutes || 45}m
                              </Text>
                            </View>
                            <Badge label={badge.label} variant={badge.variant} size="sm" />
                          </View>

                          <Text style={[styles.itemPatientName, { color: theme.text }]} numberOfLines={1}>
                            {patientName}
                          </Text>

                          <Text style={[styles.itemServiceName, { color: theme.primary }]} numberOfLines={1}>
                            {item.service_name || 'Sesión de Kinesiología'}
                          </Text>

                          {item.notes || item.reason ? (
                            <Text style={[styles.itemReasonText, { color: theme.textSecondary }]} numberOfLines={2}>
                              {item.notes || item.reason}
                            </Text>
                          ) : null}

                          <Text style={[styles.itemKineText, { color: theme.textMuted }]} numberOfLines={1}>
                            {item.kinesiologist_last_name ? `Lic. ${item.kinesiologist_last_name}` : 'Lic. Gómez'}
                          </Text>

                          {/* Acciones de cambio de estado */}
                          <View style={[styles.itemActionsRow, { borderTopColor: theme.border + '50' }]}>
                            {confirmCancelApptId === item.id ? (
                              <View style={{ gap: spacing.xs }}>
                                <Text style={{ fontSize: typography.fontSize.xs, fontWeight: '700', color: theme.error }}>
                                  ¿Cancelar este turno?
                                </Text>
                                <View style={styles.actionBtnGroup}>
                                  <TouchableOpacity
                                    style={[styles.gridActionBtnSec, { flex: 1, borderColor: theme.border }]}
                                    onPress={() => setConfirmCancelApptId(null)}
                                    disabled={isUpdating}
                                  >
                                    <Text style={[styles.gridActionBtnSecText, { color: theme.text }]}>No, volver</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.gridActionBtn, { backgroundColor: theme.error }]}
                                    onPress={() => {
                                      setConfirmCancelApptId(null);
                                      onUpdateStatus(item.id, 'cancelled');
                                    }}
                                    disabled={isUpdating}
                                  >
                                    <Text style={styles.gridActionBtnText}>Sí, cancelar</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : statusRaw === 'pending' || statusRaw === 'scheduled' ? (
                              <View style={styles.actionBtnGroup}>
                                <TouchableOpacity
                                  style={[styles.gridActionBtn, { backgroundColor: theme.primary }]}
                                  onPress={() => onUpdateStatus(item.id, 'confirmed')}
                                  disabled={isUpdating}
                                >
                                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                                  <Text style={styles.gridActionBtnText}>Confirmar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.gridActionBtnSec, { borderColor: theme.error + '60', backgroundColor: theme.errorBg }]}
                                  onPress={() => setConfirmCancelApptId(item.id)}
                                  disabled={isUpdating}
                                  accessibilityLabel="Cancelar turno"
                                >
                                  <MaterialIcons name="close" size={15} color={theme.error} />
                                  <Text style={[styles.gridActionBtnSecText, { color: theme.error }]}>Cancelar</Text>
                                </TouchableOpacity>
                              </View>
                            ) : statusRaw === 'confirmed' ? (
                              <View style={styles.actionBtnGroup}>
                                <TouchableOpacity
                                  style={[styles.gridActionBtn, { backgroundColor: '#10B981' }]}
                                  onPress={() => onUpdateStatus(item.id, 'attended')}
                                  disabled={isUpdating}
                                >
                                  <MaterialIcons name="done-all" size={16} color="#FFFFFF" />
                                  <Text style={styles.gridActionBtnText}>Atendido</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.gridActionBtnSec, { borderColor: theme.error + '60', backgroundColor: theme.errorBg }]}
                                  onPress={() => setConfirmCancelApptId(item.id)}
                                  disabled={isUpdating}
                                  accessibilityLabel="Cancelar turno"
                                >
                                  <MaterialIcons name="close" size={15} color={theme.error} />
                                  <Text style={[styles.gridActionBtnSecText, { color: theme.error }]}>Cancelar</Text>
                                </TouchableOpacity>
                              </View>
                            ) : statusRaw === 'cancelled' || statusRaw === 'absent' ? (
                              <TouchableOpacity
                                style={[styles.gridActionBtnSec, { borderColor: theme.primary, width: '100%', justifyContent: 'center' }]}
                                onPress={() => onUpdateStatus(item.id, 'pending')}
                                disabled={isUpdating}
                              >
                                <MaterialIcons name="restore" size={16} color={theme.primary} />
                                <Text style={[styles.gridActionBtnSecText, { color: theme.primary }]}>Reactivar</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.itemCompletedRow}>
                                <MaterialIcons name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.itemCompletedText}>Completado</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Modal para Agendar Turno */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Agendar Turno"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Confirmar Turno"
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onCreateAppointment)()}
            />
          </>
        }
      >
        {formError && (
          <View style={[styles.modalError, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        {/* SELECTOR DESPLEGABLE INTERACTIVO DE PACIENTES */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Paciente <Text style={{ color: theme.error }}>*</Text>
          </Text>

          <TouchableOpacity
            style={[
              styles.pickerTrigger,
              {
                backgroundColor: theme.surface,
                borderColor: showPatientPicker ? theme.primary : theme.border
              }
            ]}
            onPress={() => setShowPatientPicker(!showPatientPicker)}
          >
            <View style={styles.pickerTriggerContent}>
              <MaterialIcons name="person" size={20} color={theme.primary} style={{ marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                {selectedPatient ? (
                  <>
                    <Text style={[styles.pickerSelectedText, { color: theme.text }]}>
                      {selectedPatient.last_name}, {selectedPatient.first_name}
                    </Text>
                    <Text style={[styles.pickerSelectedSub, { color: theme.textSecondary }]}>
                      DNI: {selectedPatient.dni}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.pickerPlaceholder, { color: theme.textMuted }]}>
                    Seleccionar paciente...
                  </Text>
                )}
              </View>
              <MaterialIcons
                name={showPatientPicker ? 'arrow-drop-up' : 'arrow-drop-down'}
                size={24}
                color={theme.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {showPatientPicker && (
            <View style={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.searchBox, { borderBottomColor: theme.border }]}>
                <MaterialIcons name="search" size={18} color={theme.textMuted} style={{ marginRight: spacing.xs }} />
                <Input
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                  containerStyle={{ marginBottom: 0, flex: 1 }}
                />
              </View>

              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filteredPatients.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={[styles.dropdownEmptyText, { color: theme.textMuted }]}>
                      No se encontraron pacientes
                    </Text>
                  </View>
                ) : (
                  filteredPatients.map((p) => {
                    const isSelected = p.id === Number(selectedPatientId);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.patientRow,
                          { borderBottomColor: theme.border + '30' },
                          isSelected && { backgroundColor: theme.primaryLight + '40' }
                        ]}
                        onPress={() => {
                          setValue('patient_id', p.id, { shouldValidate: true });
                          setShowPatientPicker(false);
                          setPatientSearch('');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.patientRowName,
                              { color: isSelected ? theme.primary : theme.text }
                            ]}
                          >
                            {p.last_name}, {p.first_name}
                          </Text>
                          <Text style={[styles.patientRowDni, { color: theme.textSecondary }]}>
                            DNI: {p.dni}
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialIcons name="check" size={18} color={theme.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* SELECTOR DE PROFESIONAL KINESIÓLOGO */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Profesional a cargo <Text style={{ color: theme.error }}>*</Text>
          </Text>
          <View
            style={[
              styles.readOnlySelector,
              { backgroundColor: theme.surface, borderColor: theme.border }
            ]}
          >
            <MaterialIcons name="medical-services" size={18} color={theme.primary} style={{ marginRight: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.readOnlyTitle, { color: theme.text }]}>
                Lic. Carlos Gómez
              </Text>
              <Text style={[styles.readOnlySubtitle, { color: theme.textSecondary }]}>
                Kinesiólogo y Fisioterapeuta Especialista
              </Text>
            </View>
            <Badge label="Asignado" variant="success" size="sm" />
          </View>
        </View>

        <DateInput
          label="Fecha del turno (Lunes a Viernes — máx. 14 días)"
          value={apptDate}
          min={bookingMinDate}
          max={bookingMaxDate}
          disableWeekends={true}
          isDateDisabled={(d) => evaluateDateClient(d, calendarByDate, bookingMinDate, bookingMaxDate)}
          onChangeDate={(d) => {
            setApptDate(d);
            setValue('scheduled_at', `${d} ${apptTime || '10:00'}:00`, { shouldValidate: true });
            if (d) {
              fetchAgendaSlots(d);
            }
          }}
          error={formErrors.scheduled_at?.message}
          required
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Horario disponible <Text style={{ color: theme.error }}>*</Text>
          </Text>
          {loadingSlots ? (
            <Text style={{ color: theme.textMuted, fontSize: typography.fontSize.xs, marginVertical: spacing.xs }}>
              Buscando horarios...
            </Text>
          ) : availableSlots.length === 0 ? (
            <Text style={{ color: theme.warning, fontSize: typography.fontSize.xs, marginVertical: spacing.xs }}>
              No hay horarios disponibles.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
              {availableSlots.map((slot, idx) => {
                const slotTime = slot.time || slot.timeLabel;
                const isSelected = apptTime === slotTime;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.border
                    }}
                    onPress={() => {
                      setApptTime(slotTime);
                      setValue('scheduled_at', `${apptDate} ${slotTime}:00`, { shouldValidate: true });
                    }}
                  >
                    <Text style={{ color: isSelected ? '#FFF' : theme.text, fontWeight: '600', fontSize: typography.fontSize.xs }}>
                      {slotTime} hs
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Controller
          control={control}
          name="duration_minutes"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Duración (minutos)"
              value={String(value || '')}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="45"
              error={formErrors.duration_minutes?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="reason"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Motivo de consulta"
              value={value || ''}
              onChangeText={onChange}
              placeholder="Ej. Rehabilitación lumbar o evaluación inicial"
            />
          )}
        />
      </ModalWrapper>

      {/* Modal de Feriados Oficiales y Días No Laborables Opcionales */}
      <ModalWrapper
        visible={holidaysModalVisible}
        onClose={() => setHolidaysModalVisible(false)}
        title="Feriados y Días No Laborables"
        footer={
          <Button
            title="Cerrar"
            variant="secondary"
            size="md"
            onPress={() => setHolidaysModalVisible(false)}
          />
        }
      >
        {holidayError && (
          <View style={[styles.modalError, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{holidayError}</Text>
          </View>
        )}

        <Text style={{ color: theme.textSecondary, fontSize: typography.fontSize.xs, marginBottom: spacing.md }}>
          Cerrado sábados, domingos y feriados oficiales. Los días no laborables opcionales son configurables.
        </Text>

        <ScrollView style={{ maxHeight: 380 }}>
          {holidaysList.map((item) => {
            const isOptional = Boolean(item.isOptional);
            const isClosed = Boolean(item.isClosed);
            const isToggling = togglingHolidayDate === item.date;
            return (
              <View
                key={item.date}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border + '40',
                  gap: spacing.sm
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: typography.fontSize.sm }}>
                    {item.date} — {item.name}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: typography.fontSize.xs }}>
                    {isOptional
                      ? 'Día no laborable opcional'
                      : `Feriado ${item.scope === 'national' || item.scope === 'nacional' ? 'nacional' : item.scope === 'provincial' ? 'provincial' : 'municipal'}`}
                  </Text>
                </View>

                {isOptional ? (
                  <TouchableOpacity
                    disabled={isToggling}
                    onPress={() => handleToggleOptionalHoliday(item.date, !isClosed)}
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      backgroundColor: isClosed ? theme.error + '15' : '#10B98120',
                      borderColor: isClosed ? theme.error : '#10B981'
                    }}
                  >
                    <Text
                      style={{
                        color: isClosed ? theme.error : '#10B981',
                        fontWeight: '700',
                        fontSize: typography.fontSize.xs
                      }}
                    >
                      {isClosed ? 'Cerrado (Habilitar)' : 'Laborable (Cerrar)'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Badge label="Cerrado" variant="error" size="sm" />
                )}
              </View>
            );
          })}
        </ScrollView>
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md
  },
  formRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Platform.OS === 'web' ? spacing.md : 0
  },
  formCol: {
    flex: 1
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.md
  },
  filterChip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center'
  },
  filterText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  weekNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekInfoCenter: {
    alignItems: 'center',
    gap: spacing.xs
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2
  },
  weekTitleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  todayButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center'
  },
  todayButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  gridOuterScroll: {
    flex: 1
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xxxl
  },
  dayColumn: {
    width: 280,
    borderRadius: radii.lg,
    overflow: 'hidden'
  },
  dayColumnHeader: {
    padding: spacing.md,
    borderBottomWidth: 1
  },
  dayHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  dayNameText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  todayBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.xs
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: typography.fontWeight.bold
  },
  quickAddButton: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dayHeaderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dayDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  countBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.full
  },
  countBadgeText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold
  },
  dayColumnBody: {
    padding: spacing.sm,
    gap: spacing.sm,
    minHeight: 280
  },
  dayEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs
  },
  dayEmptyText: {
    fontSize: typography.fontSize.xs
  },
  dayEmptyAddBtn: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs
  },
  dayEmptyAddText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  appointmentItemCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  itemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  itemTimeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  itemDurationText: {
    fontSize: typography.fontSize.tiny
  },
  itemPatientName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  itemServiceName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  itemReasonText: {
    fontSize: typography.fontSize.tiny,
    lineHeight: 18
  },
  itemKineText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 1
  },
  itemActionsRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  gridActionBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm
  },
  gridActionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  gridActionBtnSec: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  gridActionBtnSecText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  itemCompletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2
  },
  itemCompletedText: {
    color: '#10B981',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium
  },
  modalError: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  modalErrorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  fieldContainer: {
    marginBottom: spacing.md
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs + 2
  },
  pickerTrigger: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center'
  },
  pickerTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pickerSelectedText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  pickerSelectedSub: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  pickerPlaceholder: {
    fontSize: typography.fontSize.base
  },
  dropdownContainer: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1
  },
  dropdownScroll: {
    maxHeight: 180
  },
  dropdownEmpty: {
    padding: spacing.md,
    alignItems: 'center'
  },
  dropdownEmptyText: {
    fontSize: typography.fontSize.xs
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1
  },
  patientRowName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  patientRowDni: {
    fontSize: typography.fontSize.xs,
    marginTop: 1
  },
  readOnlySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  readOnlyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  readOnlySubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 1
  }
});
