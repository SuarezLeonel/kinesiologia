import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
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

export const AppointmentsScreen = () => {
  const { theme } = useAppTheme();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      const response = await apiClient.post('/appointments/create', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        fetchAppointments();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al agendar el turno');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'attended':
        return theme.success;
      case 'confirmed':
      case 'scheduled':
        return theme.primary;
      case 'cancelled':
        return theme.error;
      case 'no_show':
      case 'absent':
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando agenda de turnos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAppointments} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: theme.primary }]}
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
      >
        <Text style={styles.createBtnText}>+ Agendar Turno</Text>
      </TouchableOpacity>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} />}
        ListEmptyComponent={<EmptyState title="No hay turnos programados" subtitle="Todos los horarios se encuentran disponibles" />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.patient, { color: theme.text }]}>
                {item.patient_last_name ? `${item.patient_last_name}, ${item.patient_first_name}` : `Paciente #${item.patient_id}`}
              </Text>
              <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
                {String(item.status || 'scheduled').toUpperCase()}
              </Text>
            </View>
            {item.service_name && (
              <Text style={[styles.service, { color: theme.primary }]}>{item.service_name}</Text>
            )}
            <Text style={[styles.time, { color: theme.textSecondary }]}>
              {item.scheduled_at || item.start_time ? new Date(item.scheduled_at || item.start_time).toLocaleString('es-AR') : 'Horario a confirmar'}
              {item.duration_minutes ? ` (${item.duration_minutes} min)` : ''}
            </Text>
            {item.kinesiologist_name && (
              <Text style={[styles.kine, { color: theme.textSecondary }]}>
                Kinesiólogo: {item.kinesiologist_name} {item.kinesiologist_last_name || ''}
              </Text>
            )}
            {item.reason && (
              <Text style={[styles.reason, { color: theme.text }]}>Motivo: {item.reason}</Text>
            )}
          </View>
        )}
      />

      {/* Modal de Agendar Turno */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Agendar Nuevo Turno</Text>

            {formError && (
              <View style={[styles.errorBanner, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
                <Text style={[styles.errorBannerText, { color: theme.error }]}>{formError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>ID Paciente</Text>
              <Controller
                control={control}
                name="patient_id"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.patient_id ? theme.error : theme.border, color: theme.text }]}
                    value={String(value || '')}
                    onChangeText={onChange}
                    keyboardType="numeric"
                  />
                )}
              />
              {formErrors.patient_id && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.patient_id.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>ID Kinesiólogo</Text>
              <Controller
                control={control}
                name="kinesiologist_id"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.kinesiologist_id ? theme.error : theme.border, color: theme.text }]}
                    value={String(value || '')}
                    onChangeText={onChange}
                    keyboardType="numeric"
                  />
                )}
              />
              {formErrors.kinesiologist_id && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.kinesiologist_id.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Fecha y Hora (AAAA-MM-DD HH:MM:SS)</Text>
              <Controller
                control={control}
                name="scheduled_at"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.scheduled_at ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="2026-10-29 10:00:00"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.scheduled_at && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.scheduled_at.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Duración (minutos)</Text>
              <Controller
                control={control}
                name="duration_minutes"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.duration_minutes ? theme.error : theme.border, color: theme.text }]}
                    value={String(value || '')}
                    onChangeText={onChange}
                    keyboardType="numeric"
                  />
                )}
              />
              {formErrors.duration_minutes && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.duration_minutes.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Motivo de Consulta</Text>
              <Controller
                control={control}
                name="reason"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Ej. Rehabilitación lumbar"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleSubmit(onCreateAppointment)()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createBtnText}>Confirmar Turno</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  createBtn: { height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  createBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patient: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { fontSize: 12, fontWeight: 'bold' },
  service: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  time: { fontSize: 13, marginTop: 4 },
  kine: { fontSize: 12, marginTop: 2 },
  reason: { fontSize: 13, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { maxHeight: '90%', borderRadius: 14, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  fieldError: { fontSize: 11, marginTop: 2 },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  errorBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  errorBannerText: { fontSize: 12, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
