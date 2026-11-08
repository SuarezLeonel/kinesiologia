/**
 * @file VacationsScreen.tsx
 * @description Pantalla de gestión de vacaciones y licencias para kinesiólogos,
 * y módulo de supervisión y reorganización de turnos afectados para recepción y administración.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import { spacing, radii, typography, controlHeights } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';
import { apiClient } from '../api/client';

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
}

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
  status: string;
  notes?: string;
  kinesiologist_name?: string;
  kinesiologist_last_name?: string;
}

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
  const canManageAll = isAdmin || isReceptionist;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos
  const [vacations, setVacations] = useState<VacationItem[]>([]);
  const [alerts, setAlerts] = useState<VacationItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  // Filtros (para recepcionista / admin)
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'active' | 'completed' | 'cancelled'>('all');
  const [selectedKineFilter, setSelectedKineFilter] = useState<number | 'all'>('all');

  // Modal de registro de vacaciones (Kinesiólogo / Admin)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
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

  // Modal de Turnos Afectados y Reasignación (Recepción / Admin)
  const [affectedModalVisible, setAffectedModalVisible] = useState(false);
  const [selectedVacationAlert, setSelectedVacationAlert] = useState<VacationItem | null>(null);
  const [affectedAppointments, setAffectedAppointments] = useState<AffectedAppointment[]>([]);
  const [loadingAffected, setLoadingAffected] = useState(false);

  // Modal individual de reasignación
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [appointmentToReassign, setAppointmentToReassign] = useState<AffectedAppointment | null>(null);
  const [targetKineId, setTargetKineId] = useState<number | null>(null);
  const [newTime, setNewTime] = useState<string>(''); // formato HH:mm
  const [newDate, setNewDate] = useState<string>(''); // formato YYYY-MM-DD
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // Carga inicial y obtención de datos
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const promises: Promise<any>[] = [
        apiClient.post('/vacations/search', {
          status: statusFilter === 'all' ? undefined : statusFilter,
          kinesiologistId: selectedKineFilter === 'all' ? undefined : selectedKineFilter
        })
      ];

      if (canManageAll) {
        promises.push(apiClient.post('/vacations/alerts', {}));
        promises.push(apiClient.post('/appointments/professionals', {}));
      }

      const results = await Promise.all(promises);

      const searchRes = results[0];
      setVacations(Array.isArray(searchRes.data?.data) ? searchRes.data.data : (searchRes.data || []));

      if (canManageAll) {
        const alertsRes = results[1];
        setAlerts(Array.isArray(alertsRes.data?.data) ? alertsRes.data.data : (alertsRes.data || []));

        const profRes = results[2];
        setProfessionals(Array.isArray(profRes.data?.data) ? profRes.data.data : (profRes.data || []));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error al sincronizar datos de vacaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, selectedKineFilter, canManageAll]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Previsualizar vacaciones antes de confirmar
  const handlePreview = async () => {
    if (!startDate || !endDate) {
      setFormFeedback({ type: 'error', message: 'Seleccioná la fecha de inicio y la fecha de finalización.' });
      return;
    }
    if (endDate < startDate) {
      setFormFeedback({ type: 'error', message: 'La fecha de finalización no puede ser anterior a la de inicio.' });
      return;
    }
    if (startDate < todayStr) {
      setFormFeedback({ type: 'error', message: 'No podés registrar vacaciones en fechas pasadas.' });
      return;
    }

    try {
      setPreviewLoading(true);
      setFormFeedback(null);
      const res = await apiClient.post('/vacations/preview', {
        startDate,
        endDate
      });

      const data = res.data?.data || res.data;
      setPreviewResult({
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
    if (!startDate || !endDate) {
      setFormFeedback({ type: 'error', message: 'Completá las fechas de inicio y finalización.' });
      return;
    }

    try {
      setCreateSubmitting(true);
      setFormFeedback(null);

      await apiClient.post('/vacations/create', {
        startDate,
        endDate,
        notes: notes.trim() || undefined
      });

      setFormFeedback({ type: 'success', message: '¡Período de vacaciones registrado exitosamente!' });
      setTimeout(() => {
        setCreateModalVisible(false);
        setStartDate('');
        setEndDate('');
        setNotes('');
        setPreviewResult(null);
        setFormFeedback(null);
        loadData();
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

  // Cancelar vacaciones
  const handleConfirmCancelVacation = async () => {
    if (!vacationToCancel) return;
    try {
      setCancelSubmitting(true);
      await apiClient.post('/vacations/cancel', {
        vacationId: vacationToCancel.id,
        reason: cancelReason.trim() || undefined
      });

      setCancelModalVisible(false);
      setVacationToCancel(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error al cancelar el período de vacaciones.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Cargar turnos afectados de una vacación
  const handleOpenAffected = async (vacation: VacationItem) => {
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
  };

  // Abrir modal de reasignación para un turno puntual
  const handleOpenReassignModal = (appointment: AffectedAppointment) => {
    setAppointmentToReassign(appointment);
    setTargetKineId(null);
    setReassignError(null);

    // Parsear fecha y hora actual del turno
    const raw = appointment.start_time;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        setNewDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setNewTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      }
    }
    setReassignModalVisible(true);
  };

  // Guardar reasignación
  const handleConfirmReassign = async () => {
    if (!appointmentToReassign || !selectedVacationAlert) return;
    try {
      setReassignSubmitting(true);
      setReassignError(null);

      const newStartTime = (newDate && newTime) ? `${newDate} ${newTime}:00` : undefined;

      await apiClient.post('/vacations/reassign-appointment', {
        vacationId: selectedVacationAlert.id,
        appointmentId: appointmentToReassign.id,
        newKinesiologistId: targetKineId,
        newStartTime,
        notifyPatient
      });

      // Refrescar lista de turnos afectados en el modal
      const updatedList = affectedAppointments.filter((a) => a.id !== appointmentToReassign.id);
      setAffectedAppointments(updatedList);
      setReassignModalVisible(false);
      setAppointmentToReassign(null);

      // Si ya no quedan turnos pendientes en esta alerta, cerrar modal y refrescar
      if (updatedList.length === 0) {
        setAffectedModalVisible(false);
      }
      loadData();
    } catch (err: any) {
      setReassignError(err?.response?.data?.message || err?.message || 'Error al reasignar el turno.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="info" label="Programado" />;
      case 'active':
        return <Badge variant="success" label="En curso" />;
      case 'completed':
        return <Badge variant="neutral" label="Finalizado" />;
      case 'cancelled':
        return <Badge variant="error" label="Cancelado" />;
      default:
        return <Badge variant="neutral" label={status} />;
    }
  };

  if (loading && !refreshing) {
    return <LoadingState message="Cargando sistema de vacaciones..." />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <ScreenHeader
          title="Vacaciones y Licencias"
          subtitle={
            isKinesiologist
              ? 'Registrá tus períodos de descanso y consultá turnos asignados.'
              : 'Supervisión de vacaciones de profesionales y reorganización de turnos afectados.'
          }
          action={
            (isKinesiologist || isAdmin) ? (
              <Button
                title="+ Registrar Vacaciones"
                variant="primary"
                size="md"
                onPress={() => {
                  setCreateModalVisible(true);
                  setPreviewResult(null);
                  setFormFeedback(null);
                }}
                icon={<MaterialIcons name="add" size={20} color="#FFFFFF" />}
              />
            ) : undefined
          }
        />

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: (theme.error || '#EF4444') + '15', borderColor: theme.error }]}>
            <MaterialIcons name="error-outline" size={20} color={theme.error} />
            <Text style={[styles.errorBannerText, { color: theme.error }]}>{error}</Text>
          </View>
        )}

        {/* =========================================================================
            SECCIÓN DE ALERTAS VISIBLES PARA RECEPCIÓN Y ADMINISTRADOR
            Mensaje oficial requerido:
            «El kinesiólogo [Nombre y apellido] estará de vacaciones desde el [fecha]
            hasta el [fecha]. Tiene turnos asignados durante este período que necesitan
            ser reorganizados. Por favor, seleccioná nuevamente el horario y profesional correspondiente»
            ========================================================================= */}
        {canManageAll && alerts.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="notifications-active" size={22} color={theme.warning || '#F59E0B'} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Turnos pendientes de reorganización ({alerts.length})
              </Text>
            </View>

            {alerts.map((alertItem) => {
              const kineFullName = `Lic. ${alertItem.kinesiologist_last_name || ''}, ${alertItem.kinesiologist_name || ''}`.trim();
              const startFmt = alertItem.start_date || alertItem.startDate;
              const endFmt = alertItem.end_date || alertItem.endDate;
              const pendingCount = alertItem.pending_affected_count || alertItem.pendingAffectedCount || 0;

              return (
                <View
                  key={alertItem.id}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.warning || '#F59E0B'
                    }
                  ]}
                >
                  <View style={styles.alertCardHeader}>
                    <View style={[styles.alertIconBadge, { backgroundColor: (theme.warning || '#F59E0B') + '20' }]}>
                      <MaterialIcons name="warning-amber" size={24} color={theme.warning || '#F59E0B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertCardTitle, { color: theme.text }]}>
                        Atención requerida en agenda
                      </Text>
                      <Text style={[styles.alertCardMessage, { color: theme.textSecondary }]}>
                        El kinesiólogo <Text style={{ fontWeight: typography.fontWeight.bold, color: theme.text }}>{kineFullName}</Text> estará de vacaciones desde el <Text style={{ fontWeight: typography.fontWeight.semibold }}>{startFmt}</Text> hasta el <Text style={{ fontWeight: typography.fontWeight.semibold }}>{endFmt}</Text>. Tiene turnos asignados durante este período que necesitan ser reorganizados. Por favor, seleccioná nuevamente el horario y profesional correspondiente.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.alertCardFooter, { borderTopColor: theme.border }]}>
                    <View style={styles.pendingCountBadge}>
                      <MaterialIcons name="event-busy" size={18} color={theme.warning || '#F59E0B'} />
                      <Text style={[styles.pendingCountText, { color: theme.text }]}>
                        {pendingCount} {pendingCount === 1 ? 'turno afectado pendiente' : 'turnos afectados pendientes'}
                      </Text>
                    </View>

                    <Button
                      title="Reorganizar turnos"
                      variant="primary"
                      size="sm"
                      onPress={() => handleOpenAffected(alertItem)}
                      icon={<MaterialIcons name="shuffle" size={18} color="#FFFFFF" />}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* =========================================================================
            FILTROS PARA ADMINISTRACIÓN Y RECEPCIÓN
            ========================================================================= */}
        {canManageAll && (
          <View style={[styles.filtersCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.filterGroupTitle, { color: theme.textSecondary }]}>Filtrar por profesional:</Text>
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
                      Lic. {p.last_name}, {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* =========================================================================
            LISTADO DE PERÍODOS DE VACACIONES
            ========================================================================= */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="beach-access" size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {isKinesiologist ? 'Mis períodos de vacaciones' : 'Registro de vacaciones del consultorio'}
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
              const startFmt = item.start_date || item.startDate;
              const endFmt = item.end_date || item.endDate;
              const kineFullName = `Lic. ${item.kinesiologist_last_name || ''}, ${item.kinesiologist_name || ''}`.trim();
              const canCancel = (isKinesiologist || isAdmin) && item.status === 'scheduled' && startFmt && startFmt >= todayStr;

              return (
                <Card key={item.id} style={styles.vacationCard}>
                  <View style={styles.vacationCardHeader}>
                    <View style={{ flex: 1 }}>
                      {canManageAll && (
                        <Text style={[styles.vacationKineName, { color: theme.primary }]}>
                          {kineFullName}
                        </Text>
                      )}
                      <View style={styles.dateRangeRow}>
                        <MaterialIcons name="date-range" size={18} color={theme.textSecondary} />
                        <Text style={[styles.dateRangeText, { color: theme.text }]}>
                          {startFmt} al {endFmt}
                        </Text>
                      </View>
                    </View>
                    {getStatusBadge(item.status)}
                  </View>

                  {item.notes ? (
                    <Text style={[styles.vacationNotes, { color: theme.textSecondary }]}>
                      <Text style={{ fontWeight: typography.fontWeight.semibold }}>Motivo / Observación: </Text>
                      {item.notes}
                    </Text>
                  ) : null}

                  <View style={[styles.vacationCardFooter, { borderTopColor: theme.border }]}>
                    <Text style={[styles.affectedStatsText, { color: theme.textMuted }]}>
                      Turnos originalmente en el período: {item.affected_appointments_count || item.affectedAppointmentsCount || 0}
                    </Text>

                    {canCancel && (
                      <Button
                        title="Cancelar período"
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          setVacationToCancel(item);
                          setCancelReason('');
                          setCancelModalVisible(true);
                        }}
                        icon={<MaterialIcons name="cancel" size={16} color={theme.error || '#EF4444'} />}
                      />
                    )}
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
        onClose={() => setCreateModalVisible(false)}
        title="Registrar Nuevo Período de Vacaciones"
      >
        <ScrollView style={styles.modalBody}>
          <Text style={[styles.modalHelper, { color: theme.textSecondary }]}>
            Seleccioná las fechas de tu licencia. Antes de confirmar, revisá el resumen interactivo para advertir si existen turnos asignados durante ese lapso.
          </Text>

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

          {/* Feedback de error o éxito */}
          {formFeedback && (
            <View
              style={[
                styles.feedbackBox,
                {
                  backgroundColor: formFeedback.type === 'error' ? (theme.error || '#EF4444') + '15' : (theme.success || '#10B981') + '15',
                  borderColor: formFeedback.type === 'error' ? theme.error : theme.success
                }
              ]}
            >
              <MaterialIcons
                name={formFeedback.type === 'error' ? 'error-outline' : 'check-circle-outline'}
                size={20}
                color={formFeedback.type === 'error' ? theme.error : theme.success}
              />
              <Text
                style={[
                  styles.feedbackText,
                  { color: formFeedback.type === 'error' ? theme.error : theme.success }
                ]}
              >
                {formFeedback.message}
              </Text>
            </View>
          )}

          {/* Botón de Previsualización */}
          <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            <Button
              title="Comprobar turnos asignados"
              variant="secondary"
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
                  ? 'Al confirmar tus vacaciones, estos turnos NO serán cancelados ni eliminados. Se emitirá una notificación visible para el equipo de recepción para que los reorganice adecuadamente.'
                  : 'No tenés ningún turno agendado en las fechas seleccionadas. Podés confirmar tu período de vacaciones con total tranquilidad.'}
              </Text>

              {previewResult.hasConflicts && previewResult.affectedAppointments.length > 0 && (
                <View style={styles.previewList}>
                  <Text style={[styles.previewListTitle, { color: theme.text }]}>Turnos que requerirán reorganización:</Text>
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

          {/* Botones de acción */}
          <View style={styles.modalActionsRow}>
            <Button
              title="Cancelar"
              variant="ghost"
              size="md"
              onPress={() => setCreateModalVisible(false)}
              disabled={createSubmitting}
            />
            <Button
              title="Confirmar Vacaciones"
              variant="primary"
              size="md"
              onPress={handleCreateVacation}
              loading={createSubmitting}
              disabled={!startDate || !endDate}
            />
          </View>
        </ScrollView>
      </ModalWrapper>

      {/* =========================================================================
          MODAL: CANCELAR VACACIONES FUTURAS
          ========================================================================= */}
      <ModalWrapper
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        title="Cancelar Período de Vacaciones"
      >
        <View style={styles.modalBody}>
          <Text style={[styles.modalHelper, { color: theme.textSecondary }]}>
            ¿Estás seguro de que deseás cancelar este período de vacaciones? Tu disponibilidad para reservas y turnos en esas fechas quedará restablecida en el sistema.
          </Text>

          {vacationToCancel && (
            <View style={[styles.detailCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={[styles.detailDates, { color: theme.text }]}>
                Período: {vacationToCancel.start_date || vacationToCancel.startDate} al {vacationToCancel.end_date || vacationToCancel.endDate}
              </Text>
            </View>
          )}

          <Input
            label="Motivo de la cancelación (opcional)"
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Ej. Cambio de planes personales, reprogramación de viaje..."
          />

          <View style={styles.modalActionsRow}>
            <Button
              title="Volver"
              variant="ghost"
              size="md"
              onPress={() => setCancelModalVisible(false)}
              disabled={cancelSubmitting}
            />
            <Button
              title="Sí, cancelar vacaciones"
              variant="danger"
              size="md"
              onPress={handleConfirmCancelVacation}
              loading={cancelSubmitting}
            />
          </View>
        </View>
      </ModalWrapper>

      {/* =========================================================================
          MODAL: GESTIÓN DE TURNOS AFECTADOS (Recepción / Admin)
          ========================================================================= */}
      <ModalWrapper
        visible={affectedModalVisible}
        onClose={() => setAffectedModalVisible(false)}
        title="Reorganización de Turnos Afectados"
      >
        <View style={[styles.modalBody, { maxHeight: 520 }]}>
          {selectedVacationAlert && (
            <View style={[styles.alertSummaryBox, { backgroundColor: (theme.warning || '#F59E0B') + '15', borderColor: theme.warning }]}>
              <MaterialIcons name="info-outline" size={20} color={theme.warning || '#F59E0B'} />
              <Text style={[styles.alertSummaryText, { color: theme.text }]}>
                Kinesiólogo en vacaciones: <Text style={{ fontWeight: typography.fontWeight.bold }}>Lic. {selectedVacationAlert.kinesiologist_last_name}, {selectedVacationAlert.kinesiologist_name}</Text>{'\n'}
                Fechas: {selectedVacationAlert.start_date} al {selectedVacationAlert.end_date}
              </Text>
            </View>
          )}

          {loadingAffected ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: spacing.xl }} />
          ) : affectedAppointments.length === 0 ? (
            <View style={styles.allDoneBox}>
              <MaterialIcons name="check-circle" size={40} color={theme.success || '#10B981'} />
              <Text style={[styles.allDoneTitle, { color: theme.text }]}>¡Todos los turnos fueron reorganizados!</Text>
              <Text style={[styles.allDoneDesc, { color: theme.textSecondary }]}>
                No quedan turnos pendientes de asignación para este período.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {affectedAppointments.map((app) => (
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
                        {app.patient_last_name}, {app.patient_first_name}
                      </Text>
                      <Text style={[styles.patientSubText, { color: theme.textSecondary }]}>
                        DNI: {app.patient_dni} | Tel: {app.patient_phone || 'Sin registrar'}
                      </Text>
                    </View>
                    <Badge variant="warning" label="Requiere cambio" />
                  </View>

                  <View style={styles.affectedItemDetails}>
                    <Text style={[styles.itemDetailLine, { color: theme.text }]}>
                      <MaterialIcons name="event" size={16} color={theme.primary} /> {app.start_time?.slice(0, 16)} hs
                    </Text>
                    <Text style={[styles.itemDetailLine, { color: theme.text }]}>
                      <MaterialIcons name="medical-services" size={16} color={theme.textSecondary} /> {app.service_name}
                    </Text>
                    {app.notes ? (
                      <Text style={[styles.itemDetailNotes, { color: theme.textMuted }]}>
                        Notas: {app.notes}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.affectedItemAction}>
                    <Button
                      title="Reasignar profesional / horario"
                      variant="primary"
                      size="sm"
                      onPress={() => handleOpenReassignModal(app)}
                      icon={<MaterialIcons name="swap-horiz" size={18} color="#FFFFFF" />}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Cerrar"
              variant="outline"
              size="md"
              onPress={() => setAffectedModalVisible(false)}
            />
          </View>
        </View>
      </ModalWrapper>

      {/* =========================================================================
          MODAL INDIVIDUAL: REASIGNAR TURNO ESPECÍFICO
          ========================================================================= */}
      <ModalWrapper
        visible={reassignModalVisible}
        onClose={() => setReassignModalVisible(false)}
        title="Reasignar Turno Afectado"
      >
        <ScrollView style={styles.modalBody}>
          {appointmentToReassign && (
            <View style={[styles.patientSummaryCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                {appointmentToReassign.patient_last_name}, {appointmentToReassign.patient_first_name}
              </Text>
              <Text style={[styles.summaryDesc, { color: theme.textSecondary }]}>
                Prestación: {appointmentToReassign.service_name}
              </Text>
              <Text style={[styles.summaryDesc, { color: theme.textSecondary }]}>
                Horario actual: {appointmentToReassign.start_time?.slice(0, 16)} hs
              </Text>
            </View>
          )}

          {reassignError && (
            <View style={[styles.errorBanner, { backgroundColor: (theme.error || '#EF4444') + '15', borderColor: theme.error }]}>
              <MaterialIcons name="error-outline" size={18} color={theme.error} />
              <Text style={[styles.errorBannerText, { color: theme.error }]}>{reassignError}</Text>
            </View>
          )}

          {/* Selector de Nuevo Profesional */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Nuevo Profesional Asignado:</Text>
          <View style={styles.profSelectorWrap}>
            <TouchableOpacity
              onPress={() => setTargetKineId(null)}
              style={[
                styles.profOptionBtn,
                {
                  backgroundColor: targetKineId === null ? theme.primaryLight : theme.surface,
                  borderColor: targetKineId === null ? theme.primary : theme.border
                }
              ]}
            >
              <MaterialIcons
                name="person-outline"
                size={20}
                color={targetKineId === null ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.profOptionText,
                  { color: targetKineId === null ? theme.primary : theme.text }
                ]}
              >
                Sin asignar (Pendiente en agenda)
              </Text>
            </TouchableOpacity>

            {professionals
              .filter((p) => p.id !== selectedVacationAlert?.kinesiologist_id && p.id !== selectedVacationAlert?.kinesiologistId)
              .map((prof) => {
                const isSelected = targetKineId === prof.id;
                return (
                  <TouchableOpacity
                    key={prof.id}
                    onPress={() => setTargetKineId(prof.id)}
                    style={[
                      styles.profOptionBtn,
                      {
                        backgroundColor: isSelected ? theme.primaryLight : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.border
                      }
                    ]}
                  >
                    <MaterialIcons
                      name="person"
                      size={20}
                      color={isSelected ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.profOptionText,
                        { color: isSelected ? theme.primary : theme.text }
                      ]}
                    >
                      Lic. {prof.last_name}, {prof.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>

          {/* Ajuste de Fecha y Horario */}
          <View style={{ marginTop: spacing.md }}>
            <DateInput
              label="Fecha del turno"
              value={newDate}
              onChangeDate={setNewDate}
              required
            />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Input
              label="Hora de inicio (HH:mm)"
              value={newTime}
              onChangeText={setNewTime}
              placeholder="Ej. 10:00"
            />
          </View>

          {/* Notificación al paciente */}
          <TouchableOpacity
            onPress={() => setNotifyPatient(!notifyPatient)}
            style={styles.notifyRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: notifyPatient }}
          >
            <MaterialIcons
              name={notifyPatient ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={notifyPatient ? theme.primary : theme.textMuted}
            />
            <Text style={[styles.notifyText, { color: theme.text }]}>
              Notificar al paciente automáticamente sobre el cambio
            </Text>
          </TouchableOpacity>

          <View style={styles.modalActionsRow}>
            <Button
              title="Cancelar"
              variant="ghost"
              size="md"
              onPress={() => setReassignModalVisible(false)}
              disabled={reassignSubmitting}
            />
            <Button
              title="Confirmar Reasignación"
              variant="primary"
              size="md"
              onPress={handleConfirmReassign}
              loading={reassignSubmitting}
            />
          </View>
        </ScrollView>
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
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
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
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xl
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
  }
});
