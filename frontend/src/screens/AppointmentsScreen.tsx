import React, { useEffect, useState, useMemo } from 'react';
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
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, BadgeVariant } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

const appointmentSchema = z.object({
  patient_id: z.coerce.number().positive('El ID de paciente debe ser mayor a 0'),
  kinesiologist_id: z.coerce.number().positive('El ID de profesional debe ser mayor a 0'),
  service_id: z.coerce.number().positive('El ID de prestación debe ser mayor a 0').optional(),
  scheduled_at: z.string().min(10, 'Ingrese fecha y hora (AAAA-MM-DD HH:MM:SS)'),
  duration_minutes: z.coerce.number().min(15, 'Mínimo 15 minutos').max(180, 'Máximo 180 minutos'),
  reason: z.string().optional()
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

type StatusFilter = 'all' | 'scheduled' | 'confirmed' | 'attended' | 'cancelled';

export const AppointmentsScreen = () => {
  const { theme } = useAppTheme();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema) as any,
    defaultValues: {
      patient_id: 1,
      kinesiologist_id: 2,
      service_id: 1,
      scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + ' 10:00:00',
      duration_minutes: 45,
      reason: 'Sesión de kinesiología y rehabilitación'
    }
  });

  const fetchAppointments = async () => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST /appointments/search
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

  useEffect(() => {
    fetchAppointments();
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

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    return appointments.filter((item) => {
      const s = String(item.status || '').toLowerCase();
      if (statusFilter === 'attended') return s === 'attended' || s === 'completed';
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
    { key: 'scheduled', label: 'Programados' },
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
              reset({
                patient_id: 1,
                kinesiologist_id: 2,
                service_id: 1,
                scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) + ' 10:00:00',
                duration_minutes: 45,
                reason: 'Sesión de kinesiología y rehabilitación'
              });
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
                  backgroundColor: isActive ? theme.primary : theme.surfaceSubtle,
                  borderColor: isActive ? theme.primary : theme.border
                }
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? theme.primaryContrast : theme.textSecondary }
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
            title="No hay turnos en esta vista"
            subtitle="No se encontraron turnos programados con el filtro seleccionado."
            action={{
              label: 'Agendar nuevo turno',
              onPress: () => setModalVisible(true)
            }}
          />
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const timeFormatted = item.scheduled_at || item.start_time
            ? new Date(item.scheduled_at || item.start_time).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'A confirmar';

          return (
            <Card elevated style={styles.appointmentCard} padding="md">
              <View style={styles.cardHeader}>
                <View style={styles.timeBox}>
                  <Text style={[styles.timeText, { color: theme.text }]}>{timeFormatted}</Text>
                  {item.duration_minutes && (
                    <Text style={[styles.durationText, { color: theme.textMuted }]}>
                      {item.duration_minutes} min
                    </Text>
                  )}
                </View>

                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              <View style={styles.cardBody}>
                <Text style={[styles.patientName, { color: theme.text }]}>
                  {item.patient_last_name ? `${item.patient_last_name}, ${item.patient_first_name}` : `Paciente #${item.patient_id}`}
                </Text>

                {item.service_name && (
                  <Text style={[styles.serviceText, { color: theme.primary }]}>
                    {item.service_name}
                  </Text>
                )}

                {item.reason && (
                  <Text style={[styles.reasonText, { color: theme.textSecondary }]} numberOfLines={2}>
                    Motivo: {item.reason}
                  </Text>
                )}

                {item.kinesiologist_name && (
                  <Text style={[styles.kineText, { color: theme.textMuted }]}>
                    Profesional: {item.kinesiologist_name} {item.kinesiologist_last_name || ''}
                  </Text>
                )}
              </View>
            </Card>
          );
        }}
      />

      {/* Modal de Agendar Turno */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Agendar Nuevo Turno"
        subtitle="Reserva atómica sin superposición horaria (FOR UPDATE)"
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

        <Controller
          control={control}
          name="patient_id"
          render={({ field: { onChange, value } }) => (
            <Input
              label="ID Paciente"
              value={String(value || '')}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="1"
              error={formErrors.patient_id?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="kinesiologist_id"
          render={({ field: { onChange, value } }) => (
            <Input
              label="ID Profesional Kinesiólogo"
              value={String(value || '')}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="2"
              error={formErrors.kinesiologist_id?.message}
              required
            />
          )}
        />

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
  timeBox: {
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
  modalError: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  modalErrorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  }
});
