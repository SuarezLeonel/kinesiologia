import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView
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

const appointmentSchema = z.object({
  patient_id: z.coerce.number().positive('Debe seleccionar un paciente'),
  kinesiologist_id: z.coerce.number().positive('Debe seleccionar un profesional'),
  service_id: z.coerce.number().positive().default(1),
  scheduled_at: z.string().min(10, 'Ingrese fecha y hora (AAAA-MM-DD HH:MM:SS)'),
  duration_minutes: z.coerce.number().min(15, 'Mínimo 15 minutos').max(180, 'Máximo 180 minutos'),
  reason: z.string().optional()
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

export const AppointmentsScreen = () => {
  const { theme } = useAppTheme();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Estado para el selector desplegable de pacientes
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);

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

  const fetchAppointments = async () => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const response = await apiClient.post('/appointments/search', {
        page: 1,
        limit: 50
      });
      if (response.data?.success) {
        setAppointments(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener la agenda de turnos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPatientsList = async () => {
    try {
      const res = await apiClient.post('/patients/search', { page: 1, limit: 100 });
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
    fetchAppointments();
    fetchPatientsList();
  }, []);

  const onCreateAppointment = async (data: AppointmentFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/appointments', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        fetchAppointments();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al agendar el turno');
    }
  };

  const onUpdateStatus = async (appointmentId: number, nextStatus: string) => {
    try {
      setUpdatingId(appointmentId);
      const res = await apiClient.patch(`/appointments/${appointmentId}`, {
        status: nextStatus
      });
      if (res.data?.success) {
        await fetchAppointments();
      }
    } catch (err: any) {
      console.error('Error al actualizar estado:', err?.response?.data || err);
    } finally {
      setUpdatingId(null);
    }
  };

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

  if (loading && !refreshing) return <LoadingState message="Cargando agenda de turnos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAppointments} />;

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Programados' },
    { key: 'confirmed', label: 'Confirmados' },
    { key: 'attended', label: 'Atendidos' },
    { key: 'cancelled', label: 'Cancelados' }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Agenda de Turnos"
        subtitle="Programación de sesiones y disponibilidad horaria"
        action={
          <Button
            title="+ Agendar Turno"
            onPress={() => {
              setFormError(null);
              fetchPatientsList();
              const defaultPid = patients.length > 0 ? patients[0].id : 0;
              reset({
                patient_id: defaultPid,
                kinesiologist_id: 2,
                service_id: 1,
                scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + ' 10:00:00',
                duration_minutes: 45,
                reason: 'Sesión de kinesiología y rehabilitación'
              });
              setShowPatientPicker(false);
              setPatientSearch('');
              setModalVisible(true);
            }}
            size="sm"
          />
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
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id.toString()}
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
        ListEmptyComponent={
          <EmptyState
            title="Sin turnos encontrados"
            subtitle="No se registran turnos para el filtro seleccionado o el calendario está vacío."
          />
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const patientName = item.patient_name
            ? `${item.patient_last_name || ''}, ${item.patient_name}`
            : (item.patient_last_name && item.patient_first_name)
              ? `${item.patient_last_name}, ${item.patient_first_name}`
              : `Paciente #${item.patient_id}`;
          const statusRaw = String(item.status || '').toLowerCase();
          const isUpdating = updatingId === item.id;

          return (
            <Card elevated style={styles.appointmentCard} padding="lg">
              <View style={styles.cardHeader}>
                <View style={styles.timeBadgeContainer}>
                  <Text style={[styles.timeText, { color: theme.text }]}>
                    {item.start_time?.slice(11, 16) || item.scheduled_at?.slice(11, 16) || '10:00'} hs
                  </Text>
                  <Text style={[styles.durationText, { color: theme.textSecondary }]}>
                    {item.duration_minutes || 45} min
                  </Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.cardBody}>
                <Text style={[styles.patientName, { color: theme.text }]}>
                  {patientName}
                </Text>
                <Text style={[styles.serviceText, { color: theme.primary }]}>
                  {item.service_name || 'Sesión de Kinesiología y Fisioterapia'}
                </Text>
                {item.reason || item.notes ? (
                  <Text style={[styles.reasonText, { color: theme.textSecondary }]}>
                    Motivo: {item.reason || item.notes}
                  </Text>
                ) : null}
                <Text style={[styles.kineText, { color: theme.textMuted }]}>
                  Atiende: {item.kinesiologist_last_name ? `Lic. ${item.kinesiologist_last_name}, ${item.kinesiologist_name || ''}` : (item.kinesiologist_name || 'Lic. Carlos Gómez')}
                </Text>
              </View>

              {/* Botones de acción según el estado */}
              <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                {statusRaw === 'pending' || statusRaw === 'scheduled' ? (
                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                      onPress={() => onUpdateStatus(item.id, 'confirmed')}
                      disabled={isUpdating}
                    >
                      <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>{isUpdating ? 'Actualizando...' : 'Confirmar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: theme.border }]}
                      onPress={() => onUpdateStatus(item.id, 'cancelled')}
                      disabled={isUpdating}
                    >
                      <MaterialIcons name="cancel" size={16} color={theme.textMuted} />
                      <Text style={[styles.actionBtnSecondaryText, { color: theme.textSecondary }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : statusRaw === 'confirmed' ? (
                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => onUpdateStatus(item.id, 'attended')}
                      disabled={isUpdating}
                    >
                      <MaterialIcons name="done-all" size={16} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>{isUpdating ? 'Actualizando...' : 'Atendido'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: theme.border }]}
                      onPress={() => onUpdateStatus(item.id, 'cancelled')}
                      disabled={isUpdating}
                    >
                      <MaterialIcons name="cancel" size={16} color={theme.textMuted} />
                      <Text style={[styles.actionBtnSecondaryText, { color: theme.textSecondary }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : statusRaw === 'cancelled' || statusRaw === 'absent' ? (
                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: theme.primary }]}
                      onPress={() => onUpdateStatus(item.id, 'pending')}
                      disabled={isUpdating}
                    >
                      <MaterialIcons name="restore" size={16} color={theme.primary} />
                      <Text style={[styles.actionBtnSecondaryText, { color: theme.primary }]}>
                        {isUpdating ? 'Reactivando...' : 'Reactivar Turno'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.completedRow}>
                    <MaterialIcons name="check-circle" size={16} color="#10B981" />
                    <Text style={[styles.completedText, { color: '#10B981' }]}>Sesión completada y atendida</Text>
                  </View>
                )}
              </View>
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />

      {/* Modal para Agendar Turno */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Agendar Nuevo Turno"
        subtitle="Seleccione el paciente y horario de la sesión"
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
          <View style={[styles.modalError, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        {/* SELECTOR INTERACTIVO DE PACIENTES */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Paciente <Text style={{ color: theme.error }}>*</Text>
          </Text>

          <TouchableOpacity
            style={[
              styles.pickerTrigger,
              {
                backgroundColor: theme.surface,
                borderColor: formErrors.patient_id ? theme.error : theme.border
              }
            ]}
            onPress={() => setShowPatientPicker(!showPatientPicker)}
            accessibilityRole="button"
          >
            <View style={styles.pickerTriggerContent}>
              <MaterialIcons name="person" size={20} color={theme.primary} style={{ marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                {selectedPatient ? (
                  <View>
                    <Text style={[styles.pickerSelectedText, { color: theme.text }]}>
                      {selectedPatient.last_name}, {selectedPatient.first_name}
                    </Text>
                    <Text style={[styles.pickerSelectedSub, { color: theme.textSecondary }]}>
                      DNI: {selectedPatient.dni} {selectedPatient.phone ? `• Tel: ${selectedPatient.phone}` : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.pickerPlaceholder, { color: theme.textMuted }]}>
                    {patients.length === 0 ? 'Cargando pacientes...' : 'Seleccione un paciente de la lista...'}
                  </Text>
                )}
              </View>
              <MaterialIcons
                name={showPatientPicker ? 'expand-less' : 'expand-more'}
                size={22}
                color={theme.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {formErrors.patient_id && (
            <Text style={[styles.fieldError, { color: theme.error }]}>
              {formErrors.patient_id.message}
            </Text>
          )}

          {/* Menú desplegable con búsqueda */}
          {showPatientPicker && (
            <View style={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.searchBox, { borderBottomColor: theme.border }]}>
                <MaterialIcons name="search" size={18} color={theme.textSecondary} style={{ marginRight: spacing.xs }} />
                <TextInput
                  placeholder="Buscar por nombre, apellido o DNI..."
                  placeholderTextColor={theme.textMuted}
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                  style={[styles.searchInput, { color: theme.text }]}
                  autoFocus
                />
                {patientSearch ? (
                  <TouchableOpacity onPress={() => setPatientSearch('')}>
                    <MaterialIcons name="close" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filteredPatients.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={[styles.dropdownEmptyText, { color: theme.textMuted }]}>
                      No se encontraron pacientes que coincidan
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

        <Controller
          control={control}
          name="scheduled_at"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Fecha y Hora (AAAA-MM-DD HH:MM:SS)"
              value={value}
              onChangeText={onChange}
              placeholder="2026-10-29 10:00:00"
              error={formErrors.scheduled_at?.message}
              required
            />
          )}
        />

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.lg
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    borderWidth: 1
  },
  filterText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  appointmentCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm
  },
  timeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold
  },
  durationText: {
    fontSize: typography.fontSize.xs
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm
  },
  cardBody: {
    gap: 3
  },
  patientName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  serviceText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  reasonText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  kineText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 4
  },
  cardActions: {
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
    borderWidth: 1
  },
  actionBtnSecondaryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  completedText: {
    fontSize: typography.fontSize.xs,
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
  fieldError: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium
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
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    paddingVertical: 4
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
