/**
 * @file VacationsScreen.tsx
 * @description Pantalla de gestión de vacaciones y licencias para kinesiólogos,
 * y centro de notificaciones de turnos cancelados por vacaciones para recepción y administración.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Clipboard,
  Linking
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import { spacing, radii, typography, controlHeights } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';
import { apiClient } from '../api/client';
import { cachedPost, isRequestCanceled } from '../api/queryCache';

export interface VacationItem {
  id: number;
  kinesiologist_id: number;
  kinesiologistId?: number;
  start_date: string;
  startDate?: string;
  end_date: string;
  endDate?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes?: string | null;
  affected_appointments_count?: number;
  affectedAppointmentsCount?: number;
  pending_affected_count?: number;
  pendingAffectedCount?: number;
  kinesiologist_name?: string;
  kinesiologist_last_name?: string;
  cancelled_at?: string | null;
  cancelledAt?: string | null;
  cancelled_by?: number | null;
  cancelledBy?: number | null;
  cancelled_by_name?: string | null;
  cancelledByName?: string | null;
  cancelled_by_last_name?: string | null;
  cancelledByLastName?: string | null;
  cancelled_by_role?: string | null;
  cancelledByRole?: string | null;
  cancellation_reason?: string | null;
  cancellationReason?: string | null;
  effective_end_date?: string | null;
  effectiveEndDate?: string | null;
  created_by?: number;
  createdBy?: number;
  created_by_name?: string;
  createdByName?: string;
  created_by_last_name?: string;
  createdByLastName?: string;
  created_by_role?: string;
  createdByRole?: string;
}

const shiftDateISO = (dateStr: string, deltaDays: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const formatDateTimeDisplay = (dtStr?: string | null): string => {
  if (!dtStr) return '';
  const match = String(dtStr).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!match) return String(dtStr);
  const [, yyyy, mm, dd, hhmm] = match;
  return hhmm ? `${dd}/${mm}/${yyyy} ${hhmm} hs` : `${dd}/${mm}/${yyyy}`;
};

const getEffectiveVacationStatus = (
  item: VacationItem,
  todayStr: string
): 'scheduled' | 'active' | 'completed' | 'cancelled' => {
  if (item.status === 'cancelled') return 'cancelled';
  const startFmt = item.start_date || item.startDate || '';
  const endFmt = item.end_date || item.endDate || '';
  if (item.status === 'completed' || (endFmt && endFmt < todayStr)) return 'completed';
  if (item.status === 'active' || (startFmt && startFmt <= todayStr && (!endFmt || endFmt >= todayStr))) {
    return 'active';
  }
  return 'scheduled';
};

export interface AffectedAppointment {
  id: number;
  patient_id: number;
  patient_first_name: string;
  patient_last_name: string;
  patient_dni: string;
  patient_phone: string;
  service_name: string;
  start_time: string;
  end_time: string;
  date_display?: string;
  time_display?: string;
  status: string;
  cancellation_reason?: string | null;
  notes?: string;
  kinesiologist_name?: string;
  kinesiologist_last_name?: string;
  notification_id?: number | null;
  tracking_status?: 'pending_notification' | 'notified' | null;
  whatsapp_message?: string | null;
  notified_at?: string | null;
}

export interface CancellationNotificationItem {
  id: number;
  vacation_id: number;
  appointment_id: number;
  patient_id: number;
  kinesiologist_id: number;
  patient_name: string;
  patient_phone: string | null;
  kinesiologist_name: string;
  appointment_start_time: string;
  date_display: string;
  time_display: string;
  cancellation_reason: string;
  whatsapp_message: string;
  tracking_status: 'pending_notification' | 'notified';
  notified_at: string | null;
  notified_by: number | null;
  notified_by_name?: string | null;
  service_name?: string | null;
  vacation_start_date?: string;
  vacation_end_date?: string;
}

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    Clipboard.setString(text);
    return true;
  } catch {
    try {
      Clipboard.setString(text);
      return true;
    } catch {
      return false;
    }
  }
};

const buildWhatsAppUrl = (phone: string | null | undefined, message: string): string | null => {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

export interface Professional {
  id: number;
  name: string;
  last_name: string;
  role_name?: string;
}

export const VacationsScreen = () => {
  const { theme } = useAppTheme();
  const { isPhone, isSmallPhone, contentMaxWidth } = useResponsive();
  const { user, isAdmin, isReceptionist, isKinesiologist } = useAuth();
  const { scopeVersions } = useDataSync();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const canManageAll = isAdmin || isReceptionist;
  const hasLoadedRef = useRef(false);
  const isFocusedRef = useRef(false);
  const needsRefreshRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadDataRef = useRef<(opts?: { forceRefresh?: boolean; silent?: boolean }) => Promise<void>>(async () => {});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos
  const [vacations, setVacations] = useState<VacationItem[]>([]);
  const [cancellationNotifications, setCancellationNotifications] = useState<CancellationNotificationItem[]>([]);
  const [notifSummary, setNotifSummary] = useState({ pendingCount: 0, notifiedCount: 0, totalCount: 0 });
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  // Filtros (para recepcionista / admin)
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'active' | 'completed' | 'cancelled'>('all');
  const [selectedKineFilter, setSelectedKineFilter] = useState<number | 'all'>('all');
  const [notifFilter, setNotifFilter] = useState<'pending_notification' | 'notified' | 'all'>('pending_notification');

  // Acciones de notificaciones (copiado, WhatsApp, seguimiento)
  const [copiedFeedback, setCopiedFeedback] = useState<{
    key: string;
    message: string;
    isError?: boolean;
  } | null>(null);
  const [markingNotifId, setMarkingNotifId] = useState<number | null>(null);
  const [notifActionError, setNotifActionError] = useState<string | null>(null);

  // Modal de registro de vacaciones (Kinesiólogo / Admin)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedCreateKineId, setSelectedCreateKineId] = useState<number | null>(null);
  const [kineDropdownOpen, setKineDropdownOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    kinesiologistId?: number;
    kinesiologistName?: string;
    kinesiologistDisplayName?: string;
    affectedCount: number;
    hasConflicts: boolean;
    affectedAppointments: AffectedAppointment[];
  } | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Modal de Cancelación de Vacaciones
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [vacationToCancel, setVacationToCancel] = useState<VacationItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modal de Turnos Cancelados por Vacaciones (Recepción / Admin)
  const [affectedModalVisible, setAffectedModalVisible] = useState(false);
  const [selectedVacationAlert, setSelectedVacationAlert] = useState<VacationItem | null>(null);
  const [affectedAppointments, setAffectedAppointments] = useState<AffectedAppointment[]>([]);
  const [loadingAffected, setLoadingAffected] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const selectedCreateKine = useMemo(
    () => professionals.find((p) => p.id === selectedCreateKineId) || null,
    [professionals, selectedCreateKineId]
  );

  // Carga inicial y obtención de datos con caché, deduplicación y cancelación
  const loadData = useCallback(
    async ({ forceRefresh = false, silent = false }: { forceRefresh?: boolean; silent?: boolean } = {}) => {
      if (!user) return;
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!silent) {
          setError(null);
        }
        const promises: Promise<any>[] = [
          cachedPost(
            '/vacations/search',
            {
              status: statusFilter === 'all' ? undefined : statusFilter,
              kinesiologistId: selectedKineFilter === 'all' ? undefined : selectedKineFilter
            },
            { forceRefresh, signal: controller.signal }
          )
        ];

        if (canManageAll) {
          promises.push(
            cachedPost(
              '/vacations/cancellation-notifications',
              {
                trackingStatus: notifFilter,
                kinesiologistId: selectedKineFilter === 'all' ? undefined : selectedKineFilter
              },
              { forceRefresh, signal: controller.signal }
            )
          );
          promises.push(
            cachedPost('/appointments/professionals', {}, { staleTimeMs: 60_000, forceRefresh: false, signal: controller.signal })
          );
        }

        const results = await Promise.all(promises);
        if (controller.signal.aborted) return;

        const searchRes = results[0];
        setVacations(Array.isArray(searchRes.data?.data) ? searchRes.data.data : (searchRes.data || []));

        if (canManageAll) {
          const notifRes = results[1]?.data?.data || results[1]?.data || {};
          setCancellationNotifications(Array.isArray(notifRes.items) ? notifRes.items : []);
          setNotifSummary({
            pendingCount: Number(notifRes.summary?.pendingCount || 0),
            notifiedCount: Number(notifRes.summary?.notifiedCount || 0),
            totalCount: Number(notifRes.summary?.totalCount || 0)
          });

          const profRes = results[2];
          const rawProfs: Professional[] = Array.isArray(profRes.data?.data) ? profRes.data.data : (profRes.data || []);
          setProfessionals(
            rawProfs.filter((p) => !p.role_name || p.role_name === 'kinesiologist' || p.role_name === 'kinesiologo')
          );
        }
        hasLoadedRef.current = true;
      } catch (err: any) {
        if (isRequestCanceled(err) || controller.signal.aborted) return;
        setError(err?.response?.data?.message || err?.message || 'Error al sincronizar datos de vacaciones');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, statusFilter, selectedKineFilter, notifFilter, canManageAll]
  );

  loadDataRef.current = loadData;

  // Cambio de filtros mientras la pantalla está enfocada (evita doble ejecución junto con useFocusEffect)
  useEffect(() => {
    if (!hasLoadedRef.current || !isFocusedRef.current) return;
    loadData({ silent: true });
  }, [loadData]);

  // Refrescar únicamente cuando mutan vacaciones/turnos relevantes
  useEffect(() => {
    if (!user) return;
    if (scopeVersions.vacations === 0 && scopeVersions.appointments === 0) return;
    if (isFocusedRef.current) {
      loadDataRef.current({ forceRefresh: true, silent: true });
    } else {
      needsRefreshRef.current = true;
    }
  }, [scopeVersions.vacations, scopeVersions.appointments, user]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      const shouldForce = needsRefreshRef.current;
      needsRefreshRef.current = false;
      loadDataRef.current({ forceRefresh: shouldForce, silent: hasLoadedRef.current });

      return () => {
        isFocusedRef.current = false;
        if (abortRef.current) {
          abortRef.current.abort();
          abortRef.current = null;
        }
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData({ forceRefresh: true, silent: true });
  };

  const openCreateModal = () => {
    setSelectedCreateKineId(null);
    setKineDropdownOpen(false);
    setStartDate('');
    setEndDate('');
    setNotes('');
    setPreviewResult(null);
    setFormFeedback(null);
    setCreateModalVisible(true);
  };

  // Previsualizar vacaciones antes de confirmar
  const handlePreview = async () => {
    if (isAdmin && !selectedCreateKineId) {
      setFormFeedback({ type: 'error', message: 'Seleccioná un kinesiólogo antes de comprobar turnos asignados.' });
      return;
    }
    if (!startDate || !endDate) {
      setFormFeedback({ type: 'error', message: 'Seleccioná la fecha de inicio y la fecha de finalización.' });
      return;
    }
    if (endDate < startDate) {
      setFormFeedback({ type: 'error', message: 'La fecha de finalización no puede ser anterior a la de inicio.' });
      return;
    }
    if (startDate < todayStr) {
      setFormFeedback({ type: 'error', message: 'No se pueden registrar vacaciones en fechas pasadas.' });
      return;
    }

    try {
      setPreviewLoading(true);
      setFormFeedback(null);
      const res = await apiClient.post('/vacations/preview', {
        ...(isAdmin && selectedCreateKineId ? { kinesiologistId: selectedCreateKineId } : {}),
        startDate,
        endDate
      });

      const data = res.data?.data || res.data;
      setPreviewResult({
        kinesiologistId: data.kinesiologistId,
        kinesiologistName: data.kinesiologistName,
        kinesiologistDisplayName: data.kinesiologistDisplayName,
        affectedCount: Number(data.affectedCount || 0),
        hasConflicts: Boolean(data.hasConflicts || data.affectedCount > 0),
        affectedAppointments: data.affectedAppointments || []
      });
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Error al previsualizar turnos asignados.'
      });
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirmar y crear vacaciones
  const handleCreateVacation = async () => {
    if (isAdmin && !selectedCreateKineId) {
      setFormFeedback({ type: 'error', message: 'Seleccioná el kinesiólogo para registrar sus vacaciones.' });
      return;
    }
    if (!startDate || !endDate) {
      setFormFeedback({ type: 'error', message: 'Completá las fechas de inicio y finalización.' });
      return;
    }
    if (startDate < todayStr) {
      setFormFeedback({ type: 'error', message: 'No se pueden registrar vacaciones en fechas pasadas.' });
      return;
    }
    if (endDate < startDate) {
      setFormFeedback({ type: 'error', message: 'La fecha de finalización debe ser igual o posterior a la de inicio.' });
      return;
    }

    try {
      setCreateSubmitting(true);
      setFormFeedback(null);

      const createRes = await apiClient.post('/vacations/create', {
        ...(isAdmin && selectedCreateKineId ? { kinesiologistId: selectedCreateKineId } : {}),
        startDate,
        endDate,
        notes: notes.trim() || undefined
      });

      const createdData = createRes.data?.data || createRes.data || {};
      const cancelledCount = Number(
        createdData.cancelledAppointmentsCount ?? createdData.affected_appointments_count ?? 0
      );

      const kineLabel = selectedCreateKine
        ? `${selectedCreateKine.name} ${selectedCreateKine.last_name}`.trim()
        : '';
      const cancelledSuffix =
        cancelledCount > 0
          ? ` Se ${cancelledCount === 1 ? 'canceló automáticamente 1 turno' : `cancelaron automáticamente ${cancelledCount} turnos`} y se notificó a recepción.`
          : '';
      const successMessage =
        isAdmin && kineLabel
          ? `¡Vacaciones registradas para ${kineLabel} (${startDate} al ${endDate})!${cancelledSuffix}`
          : `¡Período de vacaciones registrado exitosamente!${cancelledSuffix}`;

      setFormFeedback({ type: 'success', message: successMessage });
      setTimeout(() => {
        setCreateModalVisible(false);
        setSelectedCreateKineId(null);
        setKineDropdownOpen(false);
        setStartDate('');
        setEndDate('');
        setNotes('');
        setPreviewResult(null);
        setFormFeedback(null);
        loadData({ silent: true });
      }, 1000);
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Error al guardar el período de vacaciones.'
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Cancelar vacaciones (futuras o en curso)
  const handleConfirmCancelVacation = async () => {
    if (!vacationToCancel) return;
    try {
      setCancelSubmitting(true);
      setCancelError(null);
      const res = await apiClient.post('/vacations/cancel', {
        vacationId: vacationToCancel.id,
        reason: cancelReason.trim() || undefined
      });

      const payload = res.data?.data || res.data || {};
      const successText =
        res.data?.message ||
        payload?.message ||
        'Período de vacaciones cancelado con éxito.';

      setCancelModalVisible(false);
      setVacationToCancel(null);
      setCancelReason('');
      setActionSuccessMsg(successText);
      await loadData({ forceRefresh: true, silent: true });
    } catch (err: any) {
      setCancelError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Error al cancelar el período de vacaciones.'
      );
      loadData({ forceRefresh: true, silent: true });
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Cargar turnos afectados de una vacación
  const handleOpenAffected = useCallback(async (vacation: VacationItem) => {
    setSelectedVacationAlert(vacation);
    setAffectedModalVisible(true);
    setLoadingAffected(true);
    try {
      const res = await apiClient.post('/vacations/affected-appointments', {
        vacationId: vacation.id
      });
      setAffectedAppointments(Array.isArray(res.data?.data) ? res.data.data : (res.data || []));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error al consultar turnos afectados');
    } finally {
      setLoadingAffected(false);
    }
  }, []);

  // Acceso directo desde Dashboard / Notificaciones a una vacación específica
  useEffect(() => {
    const targetVacationId = route?.params?.vacationId;
    if (!targetVacationId || loading || !canManageAll) return;

    const matched = vacations.find((v) => Number(v.id) === Number(targetVacationId));

    if (matched) {
      handleOpenAffected(matched);
      navigation.setParams({ vacationId: undefined });
    }
  }, [route?.params?.vacationId, loading, canManageAll, vacations, handleOpenAffected, navigation]);

  const showCopyFeedback = (key: string, message: string, isError = false) => {
    setCopiedFeedback({ key, message, isError });
    setTimeout(() => {
      setCopiedFeedback((prev) => (prev?.key === key ? null : prev));
    }, 2500);
  };

  const handleCopyValue = async (key: string, value: string, successLabel: string) => {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      showCopyFeedback(key, successLabel, false);
    } else {
      showCopyFeedback(key, 'No se pudo copiar al portapapeles.', true);
    }
  };

  const handleOpenWhatsApp = async (key: string, phone: string | null | undefined, message: string) => {
    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      showCopyFeedback(key, 'Teléfono del paciente inválido o no registrado.', true);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      showCopyFeedback(key, 'No se pudo abrir WhatsApp en este dispositivo.', true);
    }
  };

  const handleMarkNotificationSent = async (notificationId: number) => {
    try {
      setMarkingNotifId(notificationId);
      setNotifActionError(null);
      const res = await apiClient.post('/vacations/mark-notification-sent', {
        notificationId
      });
      const updated: CancellationNotificationItem | undefined = res.data?.data;

      if (updated) {
        setAffectedAppointments((prev) =>
          prev.map((a) =>
            a.notification_id === notificationId
              ? {
                  ...a,
                  tracking_status: 'notified',
                  notified_at: updated.notified_at
                }
              : a
          )
        );
      }

      await loadData({ silent: true });
    } catch (err: any) {
      setNotifActionError(
        err?.response?.data?.message || err?.message || 'Error al marcar la notificación como enviada.'
      );
    } finally {
      setMarkingNotifId(null);
    }
  };

  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'scheduled':
        return {
          variant: 'info' as const,
          label: 'Programadas',
          accentColor: theme.info,
          description: 'Licencia futura programada'
        };
      case 'active':
        return {
          variant: 'success' as const,
          label: 'En curso',
          accentColor: theme.success,
          description: 'Licencia actualmente vigente'
        };
      case 'completed':
        return {
          variant: 'neutral' as const,
          label: 'Finalizadas',
          accentColor: theme.textMuted,
          description: 'Período finalizado'
        };
      case 'cancelled':
        return {
          variant: 'error' as const,
          label: 'Canceladas',
          accentColor: theme.error,
          description: 'Canceladas antes de finalizar'
        };
      default:
        return {
          variant: 'neutral' as const,
          label: status,
          accentColor: theme.border,
          description: ''
        };
    }
  };

  const getStatusBadge = (status: string) => {
    const meta = getStatusMeta(status);
    return <Badge variant={meta.variant} label={meta.label} />;
  };

  if (loading && !refreshing) {
    return <LoadingState message="Cargando sistema de vacaciones..." />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { width: '100%', paddingHorizontal: isPhone ? spacing.md : spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <ScreenHeader
          title={
            isAdmin
              ? 'Gestión de vacaciones'
              : isKinesiologist
              ? 'Vacaciones'
              : 'Vacaciones y Notificaciones'
          }
          subtitle={
            isKinesiologist
              ? 'Registrá tus períodos de descanso y consultá los turnos que serán cancelados automáticamente.'
              : isAdmin
              ? 'Administrá las vacaciones de los kinesiólogos y supervisá las notificaciones por turnos cancelados.'
              : 'Consultá las vacaciones de los kinesiólogos y contactá a los pacientes con turnos cancelados.'
          }
          action={
            (isKinesiologist || isAdmin) ? (
              <Button
                title={isAdmin ? '+ Registrar vacaciones de kinesiólogo' : '+ Registrar Vacaciones'}
                variant="primary"
                size="sm"
                onPress={openCreateModal}
              />
            ) : undefined
          }
        />

        {Boolean(error) && (
          <View style={[styles.errorBanner, { backgroundColor: (theme.error || '#EF4444') + '15', borderColor: theme.error }]}>
            <MaterialIcons name="error-outline" size={20} color={theme.error} />
            <Text style={[styles.errorBannerText, { color: theme.error }]}>{error}</Text>
          </View>
        )}

        {Boolean(actionSuccessMsg) && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: (theme.success || '#10B981') + '15', borderColor: theme.success || '#10B981' }
            ]}
          >
            <MaterialIcons name="check-circle" size={20} color={theme.success || '#10B981'} />
            <Text style={[styles.errorBannerText, { color: theme.success || '#10B981' }]}>{actionSuccessMsg}</Text>
            <TouchableOpacity
              onPress={() => setActionSuccessMsg(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              style={{ padding: 4 }}
            >
              <MaterialIcons name="close" size={18} color={theme.success || '#10B981'} />
            </TouchableOpacity>
          </View>
        )}

        {/* =========================================================================
            NOTIFICACIONES DE TURNOS CANCELADOS POR VACACIONES (RECEPCIÓN / ADMIN)
            ========================================================================= */}
        {canManageAll && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="notifications-active" size={22} color={theme.warning || '#F59E0B'} />
              <Text style={[styles.sectionTitle, { color: theme.text, flex: 1 }]}>
                Notificaciones de turnos cancelados ({notifSummary.pendingCount} pendientes)
              </Text>
            </View>

            <View style={styles.notifFilterRow}>
              {[
                { key: 'pending_notification' as const, label: `Pendientes (${notifSummary.pendingCount})` },
                { key: 'notified' as const, label: `Notificados (${notifSummary.notifiedCount})` },
                { key: 'all' as const, label: `Todos (${notifSummary.totalCount})` }
              ].map((tab) => {
                const active = notifFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setNotifFilter(tab.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? theme.primary : theme.surfaceSubtle,
                        borderColor: active ? theme.primary : theme.border
                      }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar notificaciones: ${tab.label}`}
                  >
                    <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : theme.text }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {Boolean(notifActionError) && (
              <View style={[styles.errorBanner, { backgroundColor: (theme.error || '#EF4444') + '15', borderColor: theme.error }]}>
                <MaterialIcons name="error-outline" size={18} color={theme.error} />
                <Text style={[styles.errorBannerText, { color: theme.error }]}>{notifActionError}</Text>
              </View>
            )}

            {cancellationNotifications.length === 0 ? (
              <View style={[styles.notifEmptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MaterialIcons
                  name={notifFilter === 'pending_notification' ? 'check-circle-outline' : 'notifications-none'}
                  size={28}
                  color={notifFilter === 'pending_notification' ? (theme.success || '#10B981') : theme.textMuted}
                />
                <Text style={[styles.notifEmptyText, { color: theme.textSecondary }]}>
                  {notifFilter === 'pending_notification'
                    ? 'No hay pacientes pendientes de notificar por cancelaciones de vacaciones.'
                    : 'No se encontraron notificaciones con el filtro seleccionado.'}
                </Text>
              </View>
            ) : (
              cancellationNotifications.map((notif) => {
                const whatsappUrl = buildWhatsAppUrl(notif.patient_phone, notif.whatsapp_message);
                const msgFeedbackKey = `notif-msg-${notif.id}`;
                const phoneFeedbackKey = `notif-phone-${notif.id}`;
                const activeFeedback =
                  copiedFeedback?.key === msgFeedbackKey || copiedFeedback?.key === phoneFeedbackKey
                    ? copiedFeedback
                    : null;
                const isNotified = notif.tracking_status === 'notified';

                return (
                  <View
                    key={notif.id}
                    style={[
                      styles.alertCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isNotified ? theme.border : (theme.warning || '#F59E0B')
                      }
                    ]}
                  >
                    <View style={styles.notifCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.patientNameText, { color: theme.text }]}>
                          {notif.patient_name}
                        </Text>
                        <Text style={[styles.patientSubText, { color: theme.textSecondary }]}>
                          Teléfono: {notif.patient_phone || 'Sin teléfono registrado'}
                        </Text>
                      </View>
                      <Badge
                        variant={isNotified ? 'success' : 'warning'}
                        label={isNotified ? 'Paciente notificado' : 'Pendiente de notificación'}
                      />
                    </View>

                    <View style={styles.notifMetaGrid}>
                      <Text style={[styles.notifMetaLine, { color: theme.text }]}>
                        <Text style={styles.notifMetaLabel}>Kinesiólogo: </Text>
                        {notif.kinesiologist_name}
                      </Text>
                      <Text style={[styles.notifMetaLine, { color: theme.text }]}>
                        <Text style={styles.notifMetaLabel}>Turno cancelado: </Text>
                        {notif.date_display} a las {notif.time_display} hs
                        {notif.service_name ? ` — ${notif.service_name}` : ''}
                      </Text>
                      <Text style={[styles.notifMetaLine, { color: theme.error }]}>
                        <Text style={styles.notifMetaLabel}>Motivo: </Text>
                        {notif.cancellation_reason}
                      </Text>
                      {Boolean(isNotified && notif.notified_at) && (
                        <Text style={[styles.notifMetaLine, { color: theme.success || '#10B981' }]}>
                          Notificado el {notif.notified_at}
                          {notif.notified_by_name ? ` por ${notif.notified_by_name}` : ''}
                        </Text>
                      )}
                    </View>

                    <View style={[styles.whatsappMsgBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                      <Text style={[styles.whatsappMsgTitle, { color: theme.textSecondary }]}>
                        Mensaje listo para WhatsApp:
                      </Text>
                      <Text selectable style={[styles.whatsappMsgText, { color: theme.text }]}>
                        {notif.whatsapp_message}
                      </Text>
                    </View>

                    {activeFeedback && (
                      <View
                        style={[
                          styles.inlineToast,
                          {
                            backgroundColor: activeFeedback.isError
                              ? (theme.error || '#EF4444') + '15'
                              : (theme.success || '#10B981') + '15',
                            borderColor: activeFeedback.isError ? theme.error : (theme.success || '#10B981')
                          }
                        ]}
                      >
                        <MaterialIcons
                          name={activeFeedback.isError ? 'error-outline' : 'check-circle'}
                          size={16}
                          color={activeFeedback.isError ? theme.error : (theme.success || '#10B981')}
                        />
                        <Text
                          style={{
                            fontSize: typography.fontSize.xs,
                            fontWeight: typography.fontWeight.semibold,
                            color: activeFeedback.isError ? theme.error : (theme.success || '#10B981')
                          }}
                        >
                          {activeFeedback.message}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.notifActionsRow, { borderTopColor: theme.border }]}>
                      <Button
                        title="Copiar mensaje"
                        variant="secondary"
                        size="sm"
                        onPress={() => handleCopyValue(msgFeedbackKey, notif.whatsapp_message, '¡Mensaje copiado al portapapeles!')}
                        icon={<MaterialIcons name="content-copy" size={16} color={theme.primary} />}
                      />
                      <Button
                        title="Copiar teléfono"
                        variant="outline"
                        size="sm"
                        disabled={!notif.patient_phone}
                        onPress={() =>
                          handleCopyValue(
                            phoneFeedbackKey,
                            notif.patient_phone || '',
                            '¡Teléfono copiado al portapapeles!'
                          )
                        }
                        icon={<MaterialIcons name="phone" size={16} color={notif.patient_phone ? theme.primary : theme.textMuted} />}
                      />
                      <Button
                        title="Abrir WhatsApp"
                        variant="secondary"
                        size="sm"
                        disabled={!whatsappUrl}
                        onPress={() => handleOpenWhatsApp(phoneFeedbackKey, notif.patient_phone, notif.whatsapp_message)}
                        icon={<MaterialIcons name="chat" size={16} color={whatsappUrl ? (theme.success || '#10B981') : theme.textMuted} />}
                      />
                      {!isNotified && (
                        <Button
                          title="Marcar como notificado"
                          variant="primary"
                          size="sm"
                          loading={markingNotifId === notif.id}
                          disabled={markingNotifId !== null}
                          onPress={() => handleMarkNotificationSent(notif.id)}
                          icon={<MaterialIcons name="check" size={16} color={theme.primaryContrast} />}
                        />
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* =========================================================================
            FILTROS PARA ADMINISTRACIÓN Y RECEPCIÓN (y estado)
            ========================================================================= */}
        <View style={[styles.filtersCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {canManageAll && (
            <>
              <Text style={[styles.filterGroupTitle, { color: theme.textSecondary }]}>Filtrar por kinesiólogo:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                <TouchableOpacity
                  onPress={() => setSelectedKineFilter('all')}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedKineFilter === 'all' ? theme.primary : theme.surfaceSubtle,
                      borderColor: selectedKineFilter === 'all' ? theme.primary : theme.border
                    }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: selectedKineFilter === 'all' ? '#FFFFFF' : theme.textSecondary }]}>
                    Todos los kinesiólogos
                  </Text>
                </TouchableOpacity>

                {professionals.map((p) => {
                  const isSelected = selectedKineFilter === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setSelectedKineFilter(p.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                          borderColor: isSelected ? theme.primary : theme.border
                        }
                      ]}
                    >
                      <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : theme.textSecondary }]}>
                        {p.name} {p.last_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text style={[styles.filterGroupTitle, { color: theme.textSecondary, marginTop: canManageAll ? spacing.sm : 0 }]}>
            Filtrar por estado:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
            {[
              { key: 'all', label: 'Todos' },
              { key: 'scheduled', label: 'Programadas' },
              { key: 'active', label: 'En curso' },
              { key: 'completed', label: 'Finalizadas' },
              { key: 'cancelled', label: 'Canceladas' }
            ].map((st) => {
              const isSelected = statusFilter === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => setStatusFilter(st.key as any)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : theme.textSecondary }]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* =========================================================================
            LISTADO DE PERÍODOS DE VACACIONES
            ========================================================================= */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="beach-access" size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {isKinesiologist
                ? 'Mis períodos de vacaciones'
                : isAdmin
                ? 'Períodos registrados de kinesiólogos'
                : 'Registro de vacaciones del consultorio'}
            </Text>
          </View>

          {vacations.length === 0 ? (
            <EmptyState
              title="No hay períodos registrados"
              subtitle={
                isKinesiologist
                  ? 'Aún no registraste vacaciones. Podés hacerlo con el botón superior "+ Registrar Vacaciones".'
                  : 'No se encontraron registros de vacaciones con los filtros aplicados.'
              }
            />
          ) : (
            vacations.map((item) => {
              const startFmt = item.start_date || item.startDate || '';
              const endFmt = item.end_date || item.endDate || '';
              const effectiveStatus = getEffectiveVacationStatus(item, todayStr);
              const statusMeta = getStatusMeta(effectiveStatus);
              const kineDisplayName = `${item.kinesiologist_name || ''} ${item.kinesiologist_last_name || ''}`.trim();
              const kineFullName = kineDisplayName
                ? `${kineDisplayName} (Lic. ${item.kinesiologist_last_name || ''}, ${item.kinesiologist_name || ''})`
                : `Kinesiólogo #${item.kinesiologist_id}`;
              const isOwnVacation = Number(item.kinesiologist_id) === Number(user?.id);
              const canCancel =
                (isAdmin || (isKinesiologist && isOwnVacation)) &&
                (effectiveStatus === 'scheduled' || effectiveStatus === 'active');
              const createdByRole = item.created_by_role || item.createdByRole;
              const affectedCount = Number(item.affected_appointments_count || item.affectedAppointmentsCount || 0);
              const canViewAffected = canManageAll && affectedCount > 0;
              const cancelledAt = item.cancelled_at || item.cancelledAt || null;
              const cancelledByName = `${item.cancelled_by_name || item.cancelledByName || ''} ${item.cancelled_by_last_name || item.cancelledByLastName || ''}`.trim();
              const cancelledByRole = item.cancelled_by_role || item.cancelledByRole || null;
              const cancellationReason = item.cancellation_reason || item.cancellationReason || null;
              const effectiveEndDate = item.effective_end_date || item.effectiveEndDate || null;
              const cancelledDateOnly = cancelledAt ? String(cancelledAt).slice(0, 10) : '';

              return (
                <Card
                  key={item.id}
                  style={[
                    styles.vacationCard,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor: statusMeta.accentColor,
                      opacity: effectiveStatus === 'completed' ? 0.88 : 1
                    }
                  ]}
                >
                  <View style={styles.vacationCardHeader}>
                    <View style={{ flex: 1 }}>
                      {canManageAll && (
                        <Text style={[styles.vacationKineName, { color: theme.primary }]}>
                          {kineFullName}
                        </Text>
                      )}
                      <View style={styles.dateRangeRow}>
                        <MaterialIcons name="date-range" size={18} color={statusMeta.accentColor} />
                        <Text style={[styles.dateRangeText, { color: theme.text }]}>
                          {startFmt} al {endFmt}
                        </Text>
                      </View>
                      {Boolean(statusMeta.description) && (
                        <Text style={[styles.statusSubText, { color: theme.textMuted }]}>
                          {statusMeta.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.badgesCol}>
                      {getStatusBadge(effectiveStatus)}
                      {Boolean(canManageAll && createdByRole) && (
                        <Badge
                          variant={createdByRole === 'admin' ? 'info' : 'neutral'}
                          label={createdByRole === 'admin' ? 'Por Administración' : 'Por Profesional'}
                          size="sm"
                        />
                      )}
                    </View>
                  </View>

                  {item.notes ? (
                    <Text style={[styles.vacationNotes, { color: theme.textSecondary }]}>
                      <Text style={{ fontWeight: typography.fontWeight.semibold }}>Motivo / Observación: </Text>
                      {item.notes}
                    </Text>
                  ) : null}

                  {effectiveStatus === 'cancelled' && (
                    <View
                      style={[
                        styles.cancellationAuditBox,
                        { backgroundColor: theme.errorBg || '#FFEBEE', borderColor: theme.error + '40' }
                      ]}
                    >
                      <Text style={[styles.cancellationAuditTitle, { color: theme.error }]}>
                        Registro de cancelación
                      </Text>
                      {Boolean(cancelledAt) && (
                        <Text style={[styles.cancellationAuditLine, { color: theme.text }]}>
                          <Text style={{ fontWeight: typography.fontWeight.semibold }}>Fecha y hora: </Text>
                          {formatDateTimeDisplay(cancelledAt)}
                        </Text>
                      )}
                      {Boolean(cancelledByName) && (
                        <Text style={[styles.cancellationAuditLine, { color: theme.text }]}>
                          <Text style={{ fontWeight: typography.fontWeight.semibold }}>Cancelada por: </Text>
                          {cancelledByName}
                          {cancelledByRole === 'admin' ? ' (Administración)' : cancelledByRole ? ' (Profesional)' : ''}
                        </Text>
                      )}
                      {Boolean(cancellationReason) && (
                        <Text style={[styles.cancellationAuditLine, { color: theme.text }]}>
                          <Text style={{ fontWeight: typography.fontWeight.semibold }}>Motivo: </Text>
                          {cancellationReason}
                        </Text>
                      )}
                      {Boolean(effectiveEndDate) && (
                        <Text style={[styles.cancellationAuditLine, { color: theme.textSecondary }]}>
                          <Text style={{ fontWeight: typography.fontWeight.semibold }}>Historial conservado: </Text>
                          {startFmt} al {effectiveEndDate} (disponibilidad restablecida desde el {cancelledDateOnly || effectiveEndDate})
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={[styles.vacationCardFooter, { borderTopColor: theme.border }]}>
                    <Text style={[styles.affectedStatsText, { color: theme.textMuted }]}>
                      Turnos cancelados automáticamente: {affectedCount}
                    </Text>

                    <View style={styles.cardFooterActions}>
                      {canViewAffected && (
                        <Button
                          title="Ver turnos cancelados"
                          variant="secondary"
                          size="sm"
                          onPress={() => handleOpenAffected(item)}
                          icon={<MaterialIcons name="event-busy" size={16} color={theme.primary} />}
                        />
                      )}

                      {canCancel && (
                        <Button
                          title="Cancelar vacaciones"
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            setActionSuccessMsg(null);
                            setVacationToCancel(item);
                            setCancelReason('');
                            setCancelError(null);
                            setCancelModalVisible(true);
                          }}
                          icon={<MaterialIcons name="cancel" size={16} color={theme.error || '#EF4444'} />}
                        />
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* =========================================================================
          MODAL: REGISTRAR NUEVO PERÍODO DE VACACIONES (Kinesiólogo / Admin)
          ========================================================================= */}
      <ModalWrapper
        visible={createModalVisible}
        onClose={() => {
          setKineDropdownOpen(false);
          setCreateModalVisible(false);
        }}
        title={isAdmin ? 'Registrar Vacaciones de Kinesiólogo' : 'Registrar Nuevo Período de Vacaciones'}
        errorMessage={formFeedback?.type === 'error' ? formFeedback.message : null}
        successMessage={formFeedback?.type === 'success' ? formFeedback.message : null}
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => {
                setKineDropdownOpen(false);
                setCreateModalVisible(false);
              }}
              disabled={createSubmitting}
            />
            <Button
              title="Confirmar Vacaciones"
              variant="primary"
              size="md"
              onPress={handleCreateVacation}
              loading={createSubmitting}
            />
          </>
        }
      >
        <View style={styles.modalBody}>
          <Text style={[styles.modalHelper, { color: theme.textSecondary }]}>
            {isAdmin
              ? 'Seleccioná el kinesiólogo y las fechas de su licencia. Como administrador, gestionás las vacaciones de los profesionales sin registrar períodos propios.'
              : 'Seleccioná las fechas de tu licencia. Antes de confirmar, revisá el resumen interactivo para advertir si existen turnos asignados durante ese lapso.'}
          </Text>

          {/* Selector desplegable de kinesiólogo (solo Administrador) */}
          {isAdmin && (
            <View style={styles.selectorSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Kinesiólogo *</Text>
              <TouchableOpacity
                onPress={() => setKineDropdownOpen((prev) => !prev)}
                accessibilityRole="combobox"
                accessibilityLabel="Seleccionar kinesiólogo"
                accessibilityState={{ expanded: kineDropdownOpen }}
                style={[
                  styles.dropdownTrigger,
                  {
                    backgroundColor: theme.surface,
                    borderColor: kineDropdownOpen
                      ? theme.primary
                      : selectedCreateKine
                      ? theme.primary + '80'
                      : theme.border
                  }
                ]}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={selectedCreateKine ? theme.primary : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.dropdownTriggerText,
                      { color: selectedCreateKine ? theme.text : theme.textMuted }
                    ]}
                  >
                    {selectedCreateKine
                      ? `${selectedCreateKine.name} ${selectedCreateKine.last_name}`
                      : 'Seleccioná un kinesiólogo...'}
                  </Text>
                </View>
                <MaterialIcons
                  name={kineDropdownOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={22}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {kineDropdownOpen && (
                <View
                  style={[
                    styles.dropdownMenu,
                    { backgroundColor: theme.surface, borderColor: theme.border }
                  ]}
                >
                  {professionals.length === 0 ? (
                    <Text style={[styles.dropdownEmptyText, { color: theme.textMuted }]}>
                      No hay kinesiólogos activos disponibles para seleccionar.
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {professionals.map((prof) => {
                        const isSelected = selectedCreateKineId === prof.id;
                        return (
                          <TouchableOpacity
                            key={prof.id}
                            onPress={() => {
                              setSelectedCreateKineId(prof.id);
                              setKineDropdownOpen(false);
                              setPreviewResult(null);
                              setFormFeedback(null);
                            }}
                            style={[
                              styles.dropdownOption,
                              {
                                backgroundColor: isSelected ? theme.primaryLight : 'transparent',
                                borderBottomColor: theme.border
                              }
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.dropdownOptionTitle,
                                  { color: isSelected ? theme.primary : theme.text }
                                ]}
                              >
                                {prof.name} {prof.last_name}
                              </Text>
                              <Text style={[styles.dropdownOptionSub, { color: theme.textSecondary }]}>
                                Lic. {prof.last_name}, {prof.name}
                              </Text>
                            </View>
                            {isSelected && (
                              <MaterialIcons name="check" size={20} color={theme.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}

          <DateInput
            label="Fecha de inicio"
            value={startDate}
            onChangeDate={(d) => {
              setStartDate(d);
              setPreviewResult(null);
            }}
            min={todayStr}
            required
            helperText="Primer día de vacaciones (no se permiten fechas pasadas)"
          />

          <View style={{ height: spacing.md }} />

          <DateInput
            label="Fecha de finalización"
            value={endDate}
            onChangeDate={(d) => {
              setEndDate(d);
              setPreviewResult(null);
            }}
            min={startDate || todayStr}
            required
            helperText="Último día de vacaciones (debe ser igual o posterior al inicio)"
          />

          <View style={{ height: spacing.md }} />

          <Input
            label="Motivo u observaciones (opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej. Receso anual de verano, congreso médico..."
            multiline
            numberOfLines={2}
          />

          {/* Resumen visible de kinesiólogo seleccionado y fechas antes de confirmar */}
          {Boolean(isAdmin ? (selectedCreateKine || startDate || endDate) : (startDate && endDate)) && (
            <View
              style={[
                styles.registerSummaryCard,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: selectedCreateKine || !isAdmin ? theme.primary + '50' : theme.border
                }
              ]}
            >
              <View style={styles.registerSummaryHeader}>
                <MaterialIcons name="assignment-ind" size={18} color={theme.primary} />
                <Text style={[styles.registerSummaryTitle, { color: theme.text }]}>
                  Resumen de vacaciones a registrar
                </Text>
              </View>
              {isAdmin && (
                <Text style={[styles.registerSummaryLine, { color: theme.textSecondary }]}>
                  <Text style={{ fontWeight: typography.fontWeight.bold, color: theme.text }}>Kinesiólogo: </Text>
                  {selectedCreateKine
                    ? `${selectedCreateKine.name} ${selectedCreateKine.last_name}`
                    : 'Pendiente de selección'}
                </Text>
              )}
              <Text style={[styles.registerSummaryLine, { color: theme.textSecondary }]}>
                <Text style={{ fontWeight: typography.fontWeight.bold, color: theme.text }}>Período: </Text>
                {startDate && endDate
                  ? `Desde el ${startDate} hasta el ${endDate}`
                  : startDate
                  ? `Desde el ${startDate} (elegí fecha de finalización)`
                  : 'Seleccioná inicio y finalización'}
              </Text>
            </View>
          )}

          {/* Botón de Previsualización */}
          <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Button
              title="Comprobar turnos asignados"
              variant="outline"
              size="md"
              onPress={handlePreview}
              loading={previewLoading}
              icon={<MaterialIcons name="visibility" size={18} color={theme.primary} />}
            />
          </View>

          {/* Resultado de la previsualización */}
          {previewResult && (
            <View
              style={[
                styles.previewBox,
                {
                  backgroundColor: previewResult.hasConflicts ? (theme.warning || '#F59E0B') + '15' : (theme.success || '#10B981') + '15',
                  borderColor: previewResult.hasConflicts ? (theme.warning || '#F59E0B') : (theme.success || '#10B981')
                }
              ]}
            >
              <View style={styles.previewHeader}>
                <MaterialIcons
                  name={previewResult.hasConflicts ? 'warning' : 'check-circle'}
                  size={24}
                  color={previewResult.hasConflicts ? (theme.warning || '#F59E0B') : (theme.success || '#10B981')}
                />
                <Text style={[styles.previewTitle, { color: theme.text }]}>
                  {previewResult.hasConflicts
                    ? `¡Atención! Se detectaron ${previewResult.affectedCount} ${previewResult.affectedCount === 1 ? 'turno asignado' : 'turnos asignados'}`
                    : 'Sin conflictos en agenda'}
                </Text>
              </View>

              <Text style={[styles.previewDesc, { color: theme.textSecondary }]}>
                {previewResult.hasConflicts
                  ? isAdmin
                    ? `Al confirmar estas vacaciones para ${previewResult.kinesiologistName || (selectedCreateKine ? `${selectedCreateKine.name} ${selectedCreateKine.last_name}` : 'el profesional')}, estos turnos se cancelarán automáticamente (sin reprogramarse ni reasignarse a otro profesional) conservando su historial. Recepción recibirá una notificación por cada paciente.`
                    : 'Al confirmar tus vacaciones, estos turnos se cancelarán automáticamente dejando constancia del motivo en la base de datos (no se eliminan ni se reasignan). Recepción recibirá una notificación por cada paciente afectado.'
                  : isAdmin
                  ? `El kinesiólogo ${previewResult.kinesiologistName || (selectedCreateKine ? `${selectedCreateKine.name} ${selectedCreateKine.last_name}` : 'seleccionado')} no tiene turnos agendados del ${startDate} al ${endDate}.`
                  : 'No tenés ningún turno agendado en las fechas seleccionadas. Podés confirmar tu período de vacaciones con total tranquilidad.'}
              </Text>

              {previewResult.hasConflicts && previewResult.affectedAppointments.length > 0 && (
                <View style={styles.previewList}>
                  <Text style={[styles.previewListTitle, { color: theme.text }]}>Turnos que se cancelarán automáticamente:</Text>
                  {previewResult.affectedAppointments.slice(0, 5).map((app) => (
                    <View key={app.id} style={[styles.previewItemRow, { borderBottomColor: theme.border }]}>
                      <MaterialIcons name="access-time" size={16} color={theme.textSecondary} />
                      <Text style={[styles.previewItemText, { color: theme.text }]}>
                        {app.start_time?.slice(0, 16)} hs — {app.patient_last_name}, {app.patient_first_name} ({app.service_name})
                      </Text>
                    </View>
                  ))}
                  {previewResult.affectedAppointments.length > 5 && (
                    <Text style={[styles.previewMore, { color: theme.textMuted }]}>
                      ... y {previewResult.affectedAppointments.length - 5} turnos adicionales.
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

        </View>
      </ModalWrapper>

      {/* =========================================================================
          MODAL: CANCELAR VACACIONES (FUTURAS O EN CURSO)
          ========================================================================= */}
      <ModalWrapper
        visible={cancelModalVisible}
        onClose={() => {
          setCancelError(null);
          setCancelModalVisible(false);
        }}
        title="Cancelar Vacaciones"
        errorMessage={cancelError}
        footer={
          <>
            <Button
              title="Volver"
              variant="secondary"
              size="md"
              onPress={() => {
                setCancelError(null);
                setCancelModalVisible(false);
              }}
              disabled={cancelSubmitting}
            />
            <Button
              title="Sí, cancelar vacaciones"
              variant="danger"
              size="md"
              onPress={handleConfirmCancelVacation}
              loading={cancelSubmitting}
            />
          </>
        }
      >
        <View style={styles.modalBody}>
          {(() => {
            if (!vacationToCancel) return null;
            const modalStatus = getEffectiveVacationStatus(vacationToCancel, todayStr);
            const modalStart = vacationToCancel.start_date || vacationToCancel.startDate || '';
            const modalEnd = vacationToCancel.end_date || vacationToCancel.endDate || '';
            const isInProgress = modalStatus === 'active';
            const hasPastDays = isInProgress && Boolean(modalStart && modalStart < todayStr);
            const yesterdayStr = shiftDateISO(todayStr, -1);

            return (
              <>
                <Text style={[styles.modalHelper, { color: theme.textSecondary }]}>
                  {isInProgress
                    ? isAdmin
                      ? '¿Confirmás la cancelación de estas vacaciones en curso? La disponibilidad del kinesiólogo quedará restablecida a partir de hoy, conservando en el historial los días ya transcurridos.'
                      : '¿Confirmás la cancelación de tus vacaciones en curso? Volverás a estar disponible para recibir turnos a partir de hoy, conservando en el historial los días previos.'
                    : isAdmin
                    ? '¿Estás seguro de que deseás cancelar este período de vacaciones programado? La disponibilidad del kinesiólogo para reservas y turnos en esas fechas quedará restablecida.'
                    : '¿Estás seguro de que deseás cancelar este período de vacaciones programado? Tu disponibilidad para reservas y turnos en esas fechas quedará restablecida.'}
                </Text>

                <View style={[styles.detailCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <View style={[styles.modalDetailTopRow, { marginBottom: spacing.xs }]}>
                    <Text style={[styles.detailDates, { color: theme.text }]}>
                      Período registrado: {modalStart} al {modalEnd}
                    </Text>
                    {getStatusBadge(modalStatus)}
                  </View>

                  {Boolean(isAdmin && (vacationToCancel.kinesiologist_name || vacationToCancel.kinesiologist_last_name)) && (
                    <Text style={[styles.detailSubLine, { color: theme.primary }]}>
                      Kinesiólogo: {vacationToCancel.kinesiologist_name} {vacationToCancel.kinesiologist_last_name}
                    </Text>
                  )}

                  {hasPastDays ? (
                    <View style={styles.detailSplitBox}>
                      <Text style={[styles.detailSubLine, { color: theme.textSecondary }]}>
                        Días anteriores conservados en historial: {modalStart} al {yesterdayStr}
                      </Text>
                      <Text style={[styles.detailSubLine, { color: theme.success, fontWeight: typography.fontWeight.bold }]}>
                        Período afectado (disponibilidad desde hoy): {todayStr} al {modalEnd}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.detailSubLine, { color: theme.success, fontWeight: typography.fontWeight.bold }]}>
                      Período afectado que quedará disponible: {isInProgress ? todayStr : modalStart} al {modalEnd}
                    </Text>
                  )}

                  <Text style={[styles.detailReminderText, { color: theme.textMuted }]}>
                    Nota: Los turnos que ya fueron cancelados al registrar estas vacaciones permanecerán cancelados y no se reactivarán automáticamente.
                  </Text>
                </View>
              </>
            );
          })()}

          <Input
            label="Motivo de la cancelación (opcional)"
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Ej. Reincorporación anticipada, reprogramación de viaje..."
          />
        </View>
      </ModalWrapper>

      {/* =========================================================================
          MODAL: DETALLE DE TURNOS CANCELADOS POR VACACIONES (Recepción / Admin)
          ========================================================================= */}
      <ModalWrapper
        visible={affectedModalVisible}
        onClose={() => setAffectedModalVisible(false)}
        title="Turnos Cancelados por Vacaciones"
        footer={
          <Button
            title="Cerrar"
            variant="secondary"
            size="md"
            onPress={() => setAffectedModalVisible(false)}
          />
        }
      >
        <View style={styles.modalBody}>
          {selectedVacationAlert && (
            <View style={[styles.alertSummaryBox, { backgroundColor: (theme.warning || '#F59E0B') + '15', borderColor: theme.warning }]}>
              <MaterialIcons name="info-outline" size={20} color={theme.warning || '#F59E0B'} />
              <Text style={[styles.alertSummaryText, { color: theme.text }]}>
                Kinesiólogo en vacaciones: <Text style={{ fontWeight: typography.fontWeight.bold }}>Lic. {selectedVacationAlert.kinesiologist_last_name}, {selectedVacationAlert.kinesiologist_name}</Text>{'\n'}
                Período: {selectedVacationAlert.start_date} al {selectedVacationAlert.end_date}
              </Text>
            </View>
          )}

          {loadingAffected ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: spacing.xl }} />
          ) : affectedAppointments.length === 0 ? (
            <View style={styles.allDoneBox}>
              <MaterialIcons name="check-circle" size={40} color={theme.success || '#10B981'} />
              <Text style={[styles.allDoneTitle, { color: theme.text }]}>Sin turnos cancelados registrados</Text>
              <Text style={[styles.allDoneDesc, { color: theme.textSecondary }]}>
                No se registraron turnos cancelados asociados a este período de vacaciones.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {affectedAppointments.map((app) => {
                const isNotified = app.tracking_status === 'notified';
                const whatsappMsg = app.whatsapp_message || '';
                const whatsappUrl = buildWhatsAppUrl(app.patient_phone, whatsappMsg);
                const msgKey = `modal-msg-${app.id}`;
                const phoneKey = `modal-phone-${app.id}`;
                const modalFeedback =
                  copiedFeedback?.key === msgKey || copiedFeedback?.key === phoneKey ? copiedFeedback : null;

                return (
                  <View
                    key={app.id}
                    style={[
                      styles.affectedItemCard,
                      { backgroundColor: theme.surface, borderColor: theme.border }
                    ]}
                  >
                    <View style={styles.affectedItemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.patientNameText, { color: theme.text }]}>
                          {app.patient_first_name} {app.patient_last_name}
                        </Text>
                        <Text style={[styles.patientSubText, { color: theme.textSecondary }]}>
                          DNI: {app.patient_dni} | Tel: {app.patient_phone || 'Sin teléfono registrado'}
                        </Text>
                      </View>
                      <Badge
                        variant={isNotified ? 'success' : 'error'}
                        label={isNotified ? 'Notificado' : 'Cancelado'}
                      />
                    </View>

                    <View style={styles.affectedItemDetails}>
                      <Text style={[styles.itemDetailLine, { color: theme.text }]}>
                        <MaterialIcons name="event" size={16} color={theme.primary} />{' '}
                        {app.date_display && app.time_display
                          ? `${app.date_display} a las ${app.time_display}`
                          : app.start_time?.slice(0, 16)}{' '}
                        hs — {app.service_name}
                      </Text>
                      <Text style={[styles.itemDetailLine, { color: theme.error }]}>
                        Motivo: {app.cancellation_reason || 'Vacaciones del kinesiólogo'}
                      </Text>
                      {app.notes ? (
                        <Text style={[styles.itemDetailNotes, { color: theme.textMuted }]}>
                          Notas: {app.notes}
                        </Text>
                      ) : null}
                    </View>

                    {Boolean(whatsappMsg) && (
                      <View style={[styles.whatsappMsgBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, marginTop: spacing.xs }]}>
                        <Text style={[styles.whatsappMsgTitle, { color: theme.textSecondary }]}>
                          Mensaje predeterminado para el paciente:
                        </Text>
                        <Text selectable style={[styles.whatsappMsgText, { color: theme.text }]}>
                          {whatsappMsg}
                        </Text>
                      </View>
                    )}

                    {modalFeedback && (
                      <Text
                        style={{
                          fontSize: typography.fontSize.xs,
                          fontWeight: typography.fontWeight.semibold,
                          color: modalFeedback.isError ? theme.error : (theme.success || '#10B981'),
                          marginTop: spacing.xs
                        }}
                      >
                        {modalFeedback.message}
                      </Text>
                    )}

                    <View style={[styles.notifActionsRow, { borderTopColor: theme.border, marginTop: spacing.sm }]}>
                      {Boolean(whatsappMsg) && (
                        <Button
                          title="Copiar mensaje"
                          variant="secondary"
                          size="sm"
                          onPress={() => handleCopyValue(msgKey, whatsappMsg, '¡Mensaje copiado al portapapeles!')}
                          icon={<MaterialIcons name="content-copy" size={15} color={theme.primary} />}
                        />
                      )}
                      <Button
                        title="Copiar teléfono"
                        variant="outline"
                        size="sm"
                        disabled={!app.patient_phone}
                        onPress={() => handleCopyValue(phoneKey, app.patient_phone || '', '¡Teléfono copiado!')}
                        icon={<MaterialIcons name="phone" size={15} color={app.patient_phone ? theme.primary : theme.textMuted} />}
                      />
                      {Boolean(whatsappMsg) && (
                        <Button
                          title="Abrir WhatsApp"
                          variant="secondary"
                          size="sm"
                          disabled={!whatsappUrl}
                          onPress={() => handleOpenWhatsApp(phoneKey, app.patient_phone, whatsappMsg)}
                          icon={<MaterialIcons name="chat" size={15} color={whatsappUrl ? (theme.success || '#10B981') : theme.textMuted} />}
                        />
                      )}
                      {Boolean(app.notification_id && !isNotified) && (
                        <Button
                          title="Marcar como notificado"
                          variant="primary"
                          size="sm"
                          loading={markingNotifId === app.notification_id}
                          disabled={markingNotifId !== null}
                          onPress={() => handleMarkNotificationSent(app.notification_id!)}
                          icon={<MaterialIcons name="check" size={15} color={theme.primaryContrast} />}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  sectionWrap: {
    marginBottom: spacing.xl
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  // Tarjetas de Alerta de Vacaciones (Recepción / Admin)
  alertCard: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }
    })
  },
  alertCardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start'
  },
  alertIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  alertCardMessage: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  alertCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1
  },
  pendingCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  pendingCountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  // Filtros
  filtersCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg
  },
  filterGroupTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    marginBottom: spacing.xs
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 4
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  // Tarjeta de Vacación individual
  vacationCard: {
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  vacationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  vacationKineName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  dateRangeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  vacationNotes: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 18
  },
  statusSubText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  cancellationAuditBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 3
  },
  cancellationAuditTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  cancellationAuditLine: {
    fontSize: typography.fontSize.xs,
    lineHeight: 17
  },
  modalDetailTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  detailSubLine: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    marginTop: 3
  },
  detailSplitBox: {
    marginTop: 4,
    gap: 2
  },
  detailReminderText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    marginTop: spacing.xs,
    fontStyle: 'italic'
  },
  vacationCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1
  },
  affectedStatsText: {
    fontSize: typography.fontSize.xs
  },
  // Modales
  modalBody: {
    paddingVertical: spacing.sm
  },
  modalHelper: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md
  },
  previewBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginTop: spacing.md
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  previewTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    flex: 1
  },
  previewDesc: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  previewList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)'
  },
  previewListTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4
  },
  previewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1
  },
  previewItemText: {
    fontSize: typography.fontSize.xs,
    flex: 1
  },
  previewMore: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: 4
  },
  detailCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  detailDates: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  // Modal de turnos afectados
  alertSummaryBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  alertSummaryText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18,
    flex: 1
  },
  allDoneBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  allDoneTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold
  },
  allDoneDesc: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center'
  },
  affectedItemCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  affectedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  patientNameText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  patientSubText: {
    fontSize: typography.fontSize.xs
  },
  affectedItemDetails: {
    marginVertical: spacing.xs,
    gap: 2
  },
  itemDetailLine: {
    fontSize: typography.fontSize.xs
  },
  itemDetailNotes: {
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic'
  },
  affectedItemAction: {
    marginTop: spacing.xs,
    alignItems: 'flex-end'
  },
  // Modal individual de reasignación
  patientSummaryCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  summaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  summaryDesc: {
    fontSize: typography.fontSize.xs
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs
  },
  profSelectorWrap: {
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  profOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  profOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.xs
  },
  notifyText: {
    fontSize: typography.fontSize.xs,
    flex: 1
  },
  // Adaptaciones Admin: selector desplegable y resumen
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 4
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 6
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  selectorSection: {
    marginBottom: spacing.md
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: controlHeights.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  dropdownTriggerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  dropdownMenu: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1
  },
  dropdownOptionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  dropdownOptionSub: {
    fontSize: typography.fontSize.xs
  },
  dropdownEmptyText: {
    fontSize: typography.fontSize.xs,
    padding: spacing.md,
    textAlign: 'center'
  },
  registerSummaryCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4
  },
  registerSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  registerSummaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  registerSummaryLine: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  // Centro de notificaciones de cancelación para recepción
  notifFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  notifEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  notifEmptyText: {
    fontSize: typography.fontSize.xs,
    flex: 1
  },
  notifCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  notifMetaGrid: {
    gap: 4,
    marginBottom: spacing.sm
  },
  notifMetaLine: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  notifMetaLabel: {
    fontWeight: typography.fontWeight.semibold
  },
  whatsappMsgBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4
  },
  whatsappMsgTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  whatsappMsgText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 18
  },
  inlineToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs
  },
  notifActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.sm
  }
});
