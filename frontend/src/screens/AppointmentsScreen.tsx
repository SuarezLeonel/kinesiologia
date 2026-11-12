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
import { cachedPost, isRequestCanceled } from '../api/queryCache';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
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
  kinesiologist_id: z.coerce.number().nullable().optional(),
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
  const { isPhone, isSmallPhone, isDesktop, contentMaxWidth } = useResponsive();
  const { scopeVersions } = useDataSync();
  const { user, isAdmin, isReceptionist, isKinesiologist } = useAuth();
  const canManageAll = isAdmin || isReceptionist;

  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [selectedKineFilter, setSelectedKineFilter] = useState<'all' | 'unassigned' | number>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModalAppt, setDetailModalAppt] = useState<any | null>(null);
  const [createKineId, setCreateKineId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmCancelApptId, setConfirmCancelApptId] = useState<number | null>(null);
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedMobileDayIndex, setSelectedMobileDayIndex] = useState<number>(0);
  const [mobileViewMode, setMobileViewMode] = useState<'day' | 'week'>('day');

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

  const fetchHolidaysForYear = async (year = new Date().getFullYear(), forceRefresh = false) => {
    try {
      setHolidayError(null);
      const res = await cachedPost('/appointments/holidays/search', { year }, { staleTimeMs: 60_000, forceRefresh });
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
        await Promise.all([loadCalendarAndHolidays(true), fetchHolidaysForYear(new Date().getFullYear(), true)]);
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

  const fetchProfessionalsList = async (forceRefresh = false) => {
    try {
      const res = await cachedPost('/appointments/professionals', {}, { staleTimeMs: 60_000, forceRefresh });
      if (res.data?.success) {
        setProfessionalsList(res.data.data || []);
      }
    } catch {
      // Ignorar fallback
    }
  };

  const appointmentsAbortRef = useRef<AbortController | null>(null);
  const isFocusedRef = useRef(false);
  const needsApptsRefreshRef = useRef(false);
  const hasMountedFilterRef = useRef(false);

  const fetchAppointments = async (silent = false, forceRefresh = false) => {
    if (appointmentsAbortRef.current) {
      appointmentsAbortRef.current.abort();
    }
    const controller = new AbortController();
    appointmentsAbortRef.current = controller;

    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: POST para consultas
      const payload: any = {
        page: 1,
        limit: 300
      };
      if (canManageAll) {
        if (selectedKineFilter === 'unassigned') {
          payload.kinesiologistId = 'unassigned';
        } else if (selectedKineFilter !== 'all') {
          payload.kinesiologistId = Number(selectedKineFilter);
        }
      }
      if (searchTerm.trim()) {
        payload.search = searchTerm.trim();
      }

      const response = await cachedPost('/appointments/search', payload, {
        forceRefresh,
        signal: controller.signal
      });
      if (controller.signal.aborted) return;

      if (response.data?.success) {
        setAppointments(response.data.data || []);
        setError(null);
      }
    } catch (err: any) {
      if (isRequestCanceled(err) || controller.signal.aborted) return;
      if (!silent || appointments.length === 0) {
        setError(err.response?.data?.error?.message || 'Error al obtener la agenda de turnos');
      }
    } finally {
      if (appointmentsAbortRef.current === controller) {
        appointmentsAbortRef.current = null;
      }
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPatientsList = async (forceRefresh = false) => {
    try {
      const res = await cachedPost(
        '/patients/search',
        { page: 1, limit: 300 },
        { staleTimeMs: 30_000, forceRefresh }
      );
      if (res.data?.success) {
        const list = res.data.data || [];
        setPatients(list);
        if (list.length > 0 && (!selectedPatientId || selectedPatientId === 0)) {
          setValue('patient_id', list[0].id, { shouldValidate: true });
        }
      }
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      const shouldForce = needsApptsRefreshRef.current;
      needsApptsRefreshRef.current = false;
      fetchAppointments(hasMountedFilterRef.current, shouldForce);
      fetchPatientsList(false);
      fetchProfessionalsList(false);
      loadCalendarAndHolidays(false);

      return () => {
        isFocusedRef.current = false;
        if (appointmentsAbortRef.current) {
          appointmentsAbortRef.current.abort();
          appointmentsAbortRef.current = null;
        }
      };
    }, [selectedKineFilter])
  );

  useEffect(() => {
    if (!hasMountedFilterRef.current) {
      hasMountedFilterRef.current = true;
      return;
    }
    fetchAppointments(true, false);
  }, [selectedKineFilter]);

  useEffect(() => {
    if (
      scopeVersions.appointments > 0 ||
      scopeVersions.vacations > 0
    ) {
      if (isFocusedRef.current) {
        fetchAppointments(true, true);
      } else {
        needsApptsRefreshRef.current = true;
      }
    }
  }, [scopeVersions.appointments, scopeVersions.vacations]);

  useEffect(() => {
    if (scopeVersions.patients > 0 && isFocusedRef.current) {
      fetchPatientsList(true);
    }
  }, [scopeVersions.patients]);

  useEffect(() => {
    if (scopeVersions.users > 0 && isFocusedRef.current) {
      fetchProfessionalsList(true);
    }
  }, [scopeVersions.users]);

  useEffect(() => {
    if ((scopeVersions.services > 0 || scopeVersions.vacations > 0) && isFocusedRef.current) {
      loadCalendarAndHolidays(true);
    }
  }, [scopeVersions.services, scopeVersions.vacations]);

  const fetchAgendaSlots = async (dateStr: string, customMap?: Record<string, CalendarDayStatus>, targetKineId?: number | null) => {
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
      const activeKineId = targetKineId !== undefined ? targetKineId : createKineId;
      const res = await apiClient.post('/appointments/available-slots', {
        kinesiologistId: activeKineId || 2,
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
    fetchProfessionalsList();
    const cal = await fetchBookingCalendarAvailability('staff');
    setBookingMinDate(cal.minDate);
    setBookingMaxDate(cal.maxDate);
    setFirstAvailableDate(cal.firstAvailableDate);
    setCalendarByDate(cal.byDate);

    const defaultPid = patients.length > 0 ? patients[0].id : 0;
    const initialDate = targetDateStr || cal.firstAvailableDate;
    setApptDate(initialDate);
    setApptTime('10:00');

    const initialKineId = isKinesiologist
      ? (user?.id || 2)
      : (professionalsList.length > 0 ? professionalsList[0].id : 2);

    setCreateKineId(initialKineId);

    reset({
      patient_id: defaultPid,
      kinesiologist_id: initialKineId,
      service_id: 1,
      scheduled_at: `${initialDate} 10:00:00`,
      duration_minutes: 45,
      reason: 'Sesión de kinesiología y rehabilitación'
    });
    setShowPatientPicker(false);
    setPatientSearch('');
    setModalVisible(true);
    fetchAgendaSlots(initialDate, cal.byDate, initialKineId);
  };

  const onCreateAppointment = async (data: AppointmentFormData) => {
    setFormError(null);
    try {
      const targetKineId = createKineId !== undefined ? createKineId : data.kinesiologist_id;
      const payload: any = {
        ...data,
        kinesiologist_id: targetKineId || null
      };
      const response = await apiClient.post('/appointments', payload);
      if (response.data?.success) {
        const createdId = response.data.data?.id || Date.now();
        const pat = patients.find((p) => p.id === Number(data.patient_id));
        const kineObj = professionalsList.find((p) => p.id === Number(targetKineId));
        const optimisticItem = {
          id: createdId,
          patient_id: data.patient_id,
          kinesiologist_id: targetKineId || null,
          kinesiologist_name: kineObj?.name || null,
          kinesiologist_last_name: kineObj?.last_name || null,
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

  useEffect(() => {
    const todayIndex = weekDays.findIndex((d) => d.isToday);
    if (todayIndex !== -1) {
      setSelectedMobileDayIndex(todayIndex);
    } else {
      setSelectedMobileDayIndex(0);
    }
  }, [weekDays]);

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
    let baseList = appointments;
    if (canManageAll) {
      if (selectedKineFilter === 'unassigned') {
        baseList = baseList.filter((item) => !item.kinesiologist_id);
      } else if (selectedKineFilter !== 'all') {
        baseList = baseList.filter((item) => item.kinesiologist_id === Number(selectedKineFilter));
      }
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      baseList = baseList.filter((item) => {
        const fullName = `${item.patient_last_name || ''} ${item.patient_first_name || ''} ${item.patient_name || ''}`.toLowerCase();
        const dni = String(item.patient_dni || '');
        const kine = `${item.kinesiologist_last_name || ''} ${item.kinesiologist_name || ''}`.toLowerCase();
        const serv = String(item.service_name || '').toLowerCase();
        const notes = String(item.notes || item.reason || '').toLowerCase();
        return fullName.includes(q) || dni.includes(q) || kine.includes(q) || serv.includes(q) || notes.includes(q);
      });
    }

    const appointmentsInWeek = baseList.filter((item) => {
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
  }, [appointments, weekDays, canManageAll, selectedKineFilter, searchTerm]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: weekStats.all },
    { key: 'pending', label: 'Programados', count: weekStats.pending },
    { key: 'confirmed', label: 'Confirmados', count: weekStats.confirmed },
    { key: 'attended', label: 'Atendidos', count: weekStats.attended },
    { key: 'cancelled', label: 'Cancelados', count: weekStats.cancelled }
  ];

  const filteredAppointments = useMemo(() => {
    let list = appointments;

    if (statusFilter !== 'all') {
      list = list.filter((item) => {
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
    }

    if (canManageAll) {
      if (selectedKineFilter === 'unassigned') {
        list = list.filter((item) => !item.kinesiologist_id);
      } else if (selectedKineFilter !== 'all') {
        list = list.filter((item) => item.kinesiologist_id === Number(selectedKineFilter));
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((item) => {
        const fullName = `${item.patient_last_name || ''} ${item.patient_first_name || ''} ${item.patient_name || ''}`.toLowerCase();
        const dni = String(item.patient_dni || '');
        const kine = `${item.kinesiologist_last_name || ''} ${item.kinesiologist_name || ''}`.toLowerCase();
        const serv = String(item.service_name || '').toLowerCase();
        const notes = String(item.notes || item.reason || '').toLowerCase();
        return fullName.includes(q) || dni.includes(q) || kine.includes(q) || serv.includes(q) || notes.includes(q);
      });
    }

    return list;
  }, [appointments, statusFilter, selectedKineFilter, searchTerm, canManageAll]);

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

  const renderDayColumn = (day: typeof weekDays[0], isFullWidth = false) => {
    if (!day) return null;
    const dayAppointments = appointmentsByDay[day.dateStr] || [];
    const isToday = day.isToday;

    return (
      <View
        key={day.dateStr}
        style={[
          styles.dayColumn,
          !isPhone ? styles.dayColumnDesktop : (isFullWidth ? styles.dayColumnFullWidth : styles.dayColumnScroll),
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
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDetailModalAppt(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver detalle de turno de ${patientName}`}
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

                    {item.status === 'cancelled' && item.cancellation_reason ? (
                      <Text style={[styles.itemReasonText, { color: theme.error, fontWeight: '600' }]} numberOfLines={2}>
                        Motivo: {item.cancellation_reason}
                      </Text>
                    ) : null}

                    <View style={styles.itemKineRow}>
                      <MaterialIcons
                        name={item.kinesiologist_last_name ? 'medical-services' : 'person-outline'}
                        size={13}
                        color={item.kinesiologist_last_name ? theme.primary : theme.warning}
                      />
                      {item.kinesiologist_last_name ? (
                        <Text style={[styles.itemKineText, { color: theme.textSecondary }]} numberOfLines={1}>
                          Lic. {item.kinesiologist_last_name}{item.kinesiologist_name ? `, ${item.kinesiologist_name}` : ''}
                        </Text>
                      ) : (
                        <Badge label="Sin asignar" variant="warning" size="sm" />
                      )}
                    </View>
                  </TouchableOpacity>

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
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          width: '100%',
          flex: 1,
          paddingHorizontal: isSmallPhone ? spacing.sm : isPhone ? spacing.md : spacing.xl
        }
      ]}
    >
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

      {/* Buscador de turnos en tiempo real */}
      <View
        style={[
          styles.searchBarContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border
          }
        ]}
      >
        <MaterialIcons name="search" size={20} color={theme.textMuted} style={{ marginRight: spacing.xs }} />
        <Input
          placeholder="Buscar por paciente, DNI, profesional, servicio o notas..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          containerStyle={{ marginBottom: 0, flex: 1 }}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} accessibilityLabel="Limpiar búsqueda" style={{ padding: 4 }}>
            <MaterialIcons name="close" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selector / Filtro por Kinesiólogo para Administrador y Recepcionista */}
      {canManageAll && (
        <View style={styles.kineFilterContainer}>
          <View style={styles.kineFilterLabelRow}>
            <MaterialIcons name="medical-services" size={15} color={theme.primary} />
            <Text style={[styles.kineFilterLabel, { color: theme.textSecondary }]}>
              Filtrar por profesional:
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kineChipsRow}
          >
            <TouchableOpacity
              onPress={() => setSelectedKineFilter('all')}
              style={[
                styles.kineFilterChip,
                {
                  backgroundColor: selectedKineFilter === 'all' ? theme.primary : theme.surface,
                  borderColor: selectedKineFilter === 'all' ? theme.primary : theme.border
                }
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.kineFilterChipText,
                  { color: selectedKineFilter === 'all' ? '#FFFFFF' : theme.text }
                ]}
              >
                Todos los kinesiólogos
              </Text>
            </TouchableOpacity>

            {professionalsList.map((kine) => {
              const isSelected = selectedKineFilter === kine.id;
              return (
                <TouchableOpacity
                  key={kine.id}
                  onPress={() => setSelectedKineFilter(kine.id)}
                  style={[
                    styles.kineFilterChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.kineFilterChipText,
                      { color: isSelected ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    Lic. {kine.last_name || kine.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setSelectedKineFilter('unassigned')}
              style={[
                styles.kineFilterChip,
                {
                  backgroundColor: selectedKineFilter === 'unassigned' ? theme.warning : theme.surface,
                  borderColor: selectedKineFilter === 'unassigned' ? theme.warning : theme.border
                }
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.kineFilterChipText,
                  {
                    color: selectedKineFilter === 'unassigned' ? '#FFFFFF' : theme.warning,
                    fontWeight: '700'
                  }
                ]}
              >
                Sin asignar
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

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

      {/* Selector de Días en Móvil */}
      {isPhone && (
        <View style={styles.mobileSelectorContainer}>
          <View style={styles.mobileDaySelectorRow}>
            {weekDays.map((day, idx) => {
              const isSelected = selectedMobileDayIndex === idx && mobileViewMode === 'day';
              const dayAppts = appointmentsByDay[day.dateStr] || [];
              const hasAppts = dayAppts.length > 0;

              return (
                <TouchableOpacity
                  key={day.dateStr}
                  onPress={() => {
                    setSelectedMobileDayIndex(idx);
                    setMobileViewMode('day');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.dayName} ${day.dayNumber}`}
                  style={[
                    styles.mobileDayTab,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surface,
                      borderColor: isSelected
                        ? theme.primary
                        : day.isToday
                        ? theme.primary + '80'
                        : theme.border
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.mobileDayTabName,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : day.isToday
                          ? theme.primary
                          : theme.textSecondary
                      }
                    ]}
                  >
                    {day.dayName.slice(0, 3).toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.mobileDayTabNum,
                      { color: isSelected ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  {hasAppts && (
                    <View
                      style={[
                        styles.mobileDayDot,
                        { backgroundColor: isSelected ? '#FFFFFF' : theme.primary }
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.mobileModeToggleRow}>
            <TouchableOpacity
              onPress={() => setMobileViewMode(mobileViewMode === 'day' ? 'week' : 'day')}
              style={[
                styles.modeToggleBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }
              ]}
              accessibilityLabel="Alternar vista de agenda"
            >
              <MaterialIcons
                name={mobileViewMode === 'day' ? 'view-week' : 'view-day'}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.modeToggleText, { color: theme.textSecondary }]}>
                {mobileViewMode === 'day' ? 'Ver semana completa' : 'Ver día actual'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cuadro de Agenda: 1 Día en Móvil o Cuadro de 5 Días en Tablet/Escritorio */}
      {isPhone && mobileViewMode === 'day' ? (
        <ScrollView
          style={styles.gridOuterScroll}
          contentContainerStyle={{ paddingBottom: spacing.huge }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAppointments(true, true);
              }}
              tintColor={theme.primary}
            />
          }
        >
          {renderDayColumn(weekDays[selectedMobileDayIndex] || weekDays[0], true)}
        </ScrollView>
      ) : !isPhone ? (
        <ScrollView
          style={styles.gridOuterScroll}
          contentContainerStyle={styles.desktopOuterScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAppointments(true, true);
              }}
              tintColor={theme.primary}
            />
          }
        >
          <View style={styles.desktopColumnsContainer}>
            {weekDays.map((day) => renderDayColumn(day, false))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.gridOuterScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAppointments(true, true);
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
            {weekDays.map((day) => renderDayColumn(day, false))}
          </ScrollView>
        </ScrollView>
      )}

      {/* Modal para Agendar Turno */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Agendar Turno"
        errorMessage={formError}
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
            Profesional a cargo
          </Text>
          {isKinesiologist ? (
            <View
              style={[
                styles.readOnlySelector,
                { backgroundColor: theme.surface, borderColor: theme.border }
              ]}
            >
              <MaterialIcons name="medical-services" size={18} color={theme.primary} style={{ marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.readOnlyTitle, { color: theme.text }]}>
                  Lic. {user?.last_name || user?.name || 'Kinesiólogo'}
                </Text>
                <Text style={[styles.readOnlySubtitle, { color: theme.textSecondary }]}>
                  Turno asignado a tu agenda
                </Text>
              </View>
              <Badge label="Asignado" variant="success" size="sm" />
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {/* Opción Sin Asignar */}
              <TouchableOpacity
                onPress={() => {
                  setCreateKineId(null);
                  setValue('kinesiologist_id', null as any);
                  if (apptDate) fetchAgendaSlots(apptDate, calendarByDate, null);
                }}
                style={[
                  styles.kineOptionCard,
                  {
                    backgroundColor: createKineId === null ? theme.warning + '18' : theme.surface,
                    borderColor: createKineId === null ? theme.warning : theme.border
                  }
                ]}
              >
                <MaterialIcons
                  name="help-outline"
                  size={18}
                  color={createKineId === null ? theme.warning : theme.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.kineOptionName,
                      { color: createKineId === null ? theme.warning : theme.text, fontWeight: '700' }
                    ]}
                  >
                    Sin asignar (Pendiente)
                  </Text>
                  <Text style={{ fontSize: typography.fontSize.xs, color: theme.textSecondary }}>
                    Cualquier profesional disponible
                  </Text>
                </View>
                {createKineId === null && <MaterialIcons name="check" size={18} color={theme.warning} />}
              </TouchableOpacity>

              {/* Opciones por Kinesiólogo */}
              {professionalsList.map((kine) => {
                const isSelected = createKineId === kine.id;
                return (
                  <TouchableOpacity
                    key={kine.id}
                    onPress={() => {
                      setCreateKineId(kine.id);
                      setValue('kinesiologist_id', kine.id);
                      if (apptDate) fetchAgendaSlots(apptDate, calendarByDate, kine.id);
                    }}
                    style={[
                      styles.kineOptionCard,
                      {
                        backgroundColor: isSelected ? theme.primaryLight + '30' : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.border
                      }
                    ]}
                  >
                    <MaterialIcons
                      name="medical-services"
                      size={18}
                      color={isSelected ? theme.primary : theme.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.kineOptionName,
                          { color: isSelected ? theme.primary : theme.text, fontWeight: '700' }
                        ]}
                      >
                        Lic. {kine.last_name}, {kine.name}
                      </Text>
                      <Text style={{ fontSize: typography.fontSize.xs, color: theme.textSecondary }}>
                        Kinesiólogo y Fisioterapeuta
                      </Text>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
        errorMessage={holidayError}
        footer={
          <Button
            title="Cerrar"
            variant="secondary"
            size="md"
            onPress={() => setHolidaysModalVisible(false)}
          />
        }
      >
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

      {/* Modal de Detalle Individual del Turno */}
      <ModalWrapper
        visible={!!detailModalAppt}
        onClose={() => setDetailModalAppt(null)}
        title="Detalle del Turno"
        subtitle={detailModalAppt ? `${detailModalAppt.service_name || 'Sesión de Kinesiología'}` : undefined}
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
            <Button
              title="Cerrar"
              variant="secondary"
              size="md"
              onPress={() => setDetailModalAppt(null)}
              style={{ flex: 1 }}
            />
            {Boolean(detailModalAppt) && (detailModalAppt.status === 'pending' || detailModalAppt.status === 'scheduled') && (
              <Button
                title="Confirmar"
                size="md"
                onPress={() => {
                  const id = detailModalAppt.id;
                  setDetailModalAppt(null);
                  onUpdateStatus(id, 'confirmed');
                }}
                style={{ flex: 1 }}
              />
            )}
            {Boolean(detailModalAppt) && detailModalAppt.status === 'confirmed' && (
              <Button
                title="Atendido"
                size="md"
                onPress={() => {
                  const id = detailModalAppt.id;
                  setDetailModalAppt(null);
                  onUpdateStatus(id, 'attended');
                }}
                style={{ flex: 1 }}
              />
            )}
            {Boolean(detailModalAppt) && (detailModalAppt.status === 'cancelled' || detailModalAppt.status === 'absent') && (
              <Button
                title="Reactivar"
                size="md"
                onPress={() => {
                  const id = detailModalAppt.id;
                  setDetailModalAppt(null);
                  onUpdateStatus(id, 'pending');
                }}
                style={{ flex: 1 }}
              />
            )}
          </View>
        }
      >
        {Boolean(detailModalAppt) && (
          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.md }}>
              {/* Información del Paciente */}
              <View style={[styles.detailSectionCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={styles.detailSectionHeader}>
                  <MaterialIcons name="person" size={20} color={theme.primary} />
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Información del Paciente</Text>
                </View>
                <Text style={[styles.detailMainValue, { color: theme.text }]}>
                  {detailModalAppt.patient_last_name || ''}, {detailModalAppt.patient_first_name || detailModalAppt.patient_name || ''}
                </Text>
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>DNI:</Text>
                  <Text style={[styles.detailValText, { color: theme.text }]}>{detailModalAppt.patient_dni || 'Sin registrar'}</Text>
                </View>
                {Boolean(detailModalAppt.patient_phone) && (
                  <View style={styles.detailInfoRow}>
                    <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Teléfono:</Text>
                    <Text style={[styles.detailValText, { color: theme.text }]}>{detailModalAppt.patient_phone}</Text>
                  </View>
                )}
              </View>

              {/* Profesional Kinesiólogo Asignado */}
              <View style={[styles.detailSectionCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={styles.detailSectionHeader}>
                  <MaterialIcons name="medical-services" size={20} color={theme.primary} />
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Kinesiólogo Asignado</Text>
                </View>
                {detailModalAppt.kinesiologist_last_name ? (
                  <>
                    <Text style={[styles.detailMainValue, { color: theme.text }]}>
                      Lic. {detailModalAppt.kinesiologist_last_name}{detailModalAppt.kinesiologist_name ? `, ${detailModalAppt.kinesiologist_name}` : ''}
                    </Text>
                    <Text style={{ fontSize: typography.fontSize.xs, color: theme.textSecondary }}>
                      Kinesiólogo y Fisioterapeuta Especialista
                    </Text>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 }}>
                    <Badge label="Sin asignar" variant="warning" size="md" />
                    <Text style={{ fontSize: typography.fontSize.xs, color: theme.textSecondary }}>
                      Pendiente de asignación profesional
                    </Text>
                  </View>
                )}
              </View>

              {/* Fecha, Horario y Estado */}
              <View style={[styles.detailSectionCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={styles.detailSectionHeader}>
                  <MaterialIcons name="event" size={20} color={theme.primary} />
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Día, Horario y Estado</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Fecha y Hora:</Text>
                  <Text style={[styles.detailValText, { color: theme.text, fontWeight: '700' }]}>
                    {getAppointmentDateStr(detailModalAppt)} a las {getAppointmentTimeStr(detailModalAppt)} hs ({detailModalAppt.duration_minutes || 45} min)
                  </Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Estado:</Text>
                  <Badge
                    label={getStatusBadge(detailModalAppt.status).label}
                    variant={getStatusBadge(detailModalAppt.status).variant}
                    size="sm"
                  />
                </View>
                {Boolean(detailModalAppt.status === 'cancelled' && detailModalAppt.cancellation_reason) && (
                  <View style={styles.detailInfoRow}>
                    <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Motivo:</Text>
                    <Text style={[styles.detailValText, { color: theme.error, fontWeight: '600', flex: 1 }]}>
                      {detailModalAppt.cancellation_reason}
                    </Text>
                  </View>
                )}
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Servicio:</Text>
                  <Text style={[styles.detailValText, { color: theme.text }]}>{detailModalAppt.service_name || 'Kinesiología'}</Text>
                </View>
              </View>

              {/* Cobro y Arancel */}
              <View style={[styles.detailSectionCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={styles.detailSectionHeader}>
                  <MaterialIcons name="payments" size={20} color={theme.primary} />
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Cobro y Arancel</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Precio acordado:</Text>
                  <Text style={[styles.detailValText, { color: theme.text, fontWeight: '700' }]}>
                    ${Number(detailModalAppt.agreed_price || detailModalAppt.service_default_price || 0).toLocaleString('es-AR')} {detailModalAppt.currency || 'ARS'}
                  </Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Text style={[styles.detailLabelText, { color: theme.textSecondary }]}>Estado de pago:</Text>
                  <Badge
                    label={detailModalAppt.is_paid ? 'Pagado' : 'Pendiente de pago'}
                    variant={detailModalAppt.is_paid ? 'success' : 'neutral'}
                    size="sm"
                  />
                </View>
              </View>

              {/* Motivo de consulta / Observaciones */}
              {Boolean(detailModalAppt.notes || detailModalAppt.reason) && (
                <View style={[styles.detailSectionCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <View style={styles.detailSectionHeader}>
                    <MaterialIcons name="notes" size={20} color={theme.primary} />
                    <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Motivo / Observaciones</Text>
                  </View>
                  <Text style={{ fontSize: typography.fontSize.sm, color: theme.text }}>
                    {detailModalAppt.notes || detailModalAppt.reason}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md
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
  desktopOuterScrollContent: {
    paddingBottom: spacing.xxl
  },
  desktopColumnsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    alignItems: 'stretch'
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xxxl
  },
  dayColumn: {
    borderRadius: radii.lg,
    overflow: 'hidden'
  },
  dayColumnDesktop: {
    flex: 1,
    minWidth: 0,
    minHeight: 520
  },
  dayColumnScroll: {
    width: 280
  },
  dayColumnFullWidth: {
    width: '100%',
    minWidth: '100%',
    maxWidth: '100%',
    marginBottom: spacing.md
  },
  mobileSelectorContainer: {
    marginBottom: spacing.md
  },
  mobileDaySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  mobileDayTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1.5,
    minHeight: 52
  },
  mobileDayTabName: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  mobileDayTabNum: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: 1
  },
  mobileDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3
  },
  mobileModeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1
  },
  modeToggleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
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
    flex: 1,
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
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radii.sm
  },
  gridActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold
  },
  gridActionBtnSec: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  gridActionBtnSecText: {
    fontSize: 11,
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
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  kineFilterContainer: {
    marginBottom: spacing.sm
  },
  kineFilterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  kineFilterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  kineChipsRow: {
    gap: spacing.xs,
    paddingVertical: 2
  },
  kineFilterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kineFilterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  itemKineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  kineOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5
  },
  kineOptionName: {
    fontSize: typography.fontSize.sm
  },
  detailSectionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  detailSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  detailMainValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  detailLabelText: {
    fontSize: typography.fontSize.xs
  },
  detailValText: {
    fontSize: typography.fontSize.xs
  }
});
