import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

const clinicalRecordSchema = z.object({
  patient_id: z.coerce.number().positive('El ID de paciente debe ser mayor a 0'),
  reason_for_consultation: z.string().min(3, 'El motivo debe tener al menos 3 caracteres'),
  subjective_assessment: z.string().min(3, 'La evaluación subjetiva es obligatoria'),
  objective_assessment: z.string().min(3, 'La evaluación objetiva es obligatoria'),
  diagnosis: z.string().min(3, 'El diagnóstico es obligatorio'),
  treatment_plan: z.string().min(3, 'El plan terapéutico es obligatorio'),
  pain_scale_initial: z.coerce.number().min(0, 'Mínimo 0').max(10, 'Máximo 10').optional()
});

type ClinicalRecordFormData = z.infer<typeof clinicalRecordSchema>;

export const ClinicalRecordsScreen = () => {
  const { isReceptionist } = useAuth();
  const { theme } = useAppTheme();
  const [patientId, setPatientId] = useState('1');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ClinicalRecordFormData>({
    resolver: zodResolver(clinicalRecordSchema) as any,
    defaultValues: {
      patient_id: 1,
      reason_for_consultation: '',
      subjective_assessment: '',
      objective_assessment: '',
      diagnosis: '',
      treatment_plan: '',
      pain_scale_initial: 5
    }
  });

  const fetchRecords = async () => {
    if (isReceptionist || !patientId) return;
    try {
      setLoading(true);
      setError(null);
      // REGLA HTTP ESTRICTA: POST /clinical-records/search
      const response = await apiClient.post('/clinical-records/search', {
        patientId: Number(patientId)
      });
      if (response.data?.success) {
        setRecords(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReceptionist) {
      fetchRecords();
    }
  }, [isReceptionist]);

  const onCreateRecord = async (data: ClinicalRecordFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/clinical-records/create', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        setPatientId(String(data.patient_id));
        fetchRecords();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al guardar nota clínica');
    }
  };

  // Protección de acceso clínico evaluada en render después de invocar todos los hooks
  if (isReceptionist) {
    return <AccessDeniedState />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.topActions}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="ID de Paciente (ej: 1)"
            placeholderTextColor={theme.textSecondary}
            value={patientId}
            onChangeText={setPatientId}
            keyboardType="numeric"
          />
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={fetchRecords}>
            <Text style={styles.btnText}>Ver Ficha</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: theme.success }]}
          onPress={() => {
            setFormError(null);
            reset({
              patient_id: Number(patientId) || 1,
              reason_for_consultation: '',
              subjective_assessment: '',
              objective_assessment: '',
              diagnosis: '',
              treatment_plan: '',
              pain_scale_initial: 5
            });
            setModalVisible(true);
          }}
        >
          <Text style={styles.btnText}>+ Nueva Nota Clínica</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Consultando historias clínicas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRecords} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <EmptyState
              title="Sin registros clínicos"
              subtitle="Este paciente no posee notas clínicas aún o el ID no coincide"
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.diagnosis, { color: theme.text }]}>
                  Diagnóstico: {item.diagnosis || 'No especificado'}
                </Text>
                {item.pain_scale_initial !== null && item.pain_scale_initial !== undefined && (
                  <Text style={[styles.painBadge, { color: theme.warning }]}>
                    Dolor: {item.pain_scale_initial}/10
                  </Text>
                )}
              </View>
              <Text style={[styles.reason, { color: theme.textSecondary }]}>
                Motivo: {item.reason_for_consultation || item.consultation_reason || 'Sin motivo registrado'}
              </Text>
              {item.treatment_plan && (
                <Text style={[styles.plan, { color: theme.text }]}>
                  Plan: {item.treatment_plan}
                </Text>
              )}
              <Text style={[styles.author, { color: theme.primary }]}>
                Profesional: {item.kinesiologist_first_name || item.author_name || 'Kinesiólogo'}{' '}
                {item.kinesiologist_last_name || item.author_last_name || ''}
              </Text>
              <Text style={[styles.date, { color: theme.textSecondary }]}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString('es-AR') : ''}
              </Text>
            </View>
          )}
        />
      )}

      {/* Modal de Creación de Nota Clínica con React Hook Form y Zod */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nueva Nota de Evolución</Text>

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

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Diagnóstico Kinésico</Text>
              <Controller
                control={control}
                name="diagnosis"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.diagnosis ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ej. Cervicobraquialgia derecha"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.diagnosis && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.diagnosis.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Motivo de Consulta</Text>
              <Controller
                control={control}
                name="reason_for_consultation"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.reason_for_consultation ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ej. Dolor irradiado a miembro superior"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.reason_for_consultation && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.reason_for_consultation.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Evaluación Subjetiva (Anamnesis)</Text>
              <Controller
                control={control}
                name="subjective_assessment"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.inputArea, { borderColor: formErrors.subjective_assessment ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    multiline
                    numberOfLines={3}
                    placeholder="Sensaciones del paciente, cronología y agravantes"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.subjective_assessment && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.subjective_assessment.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Evaluación Objetiva (Física)</Text>
              <Controller
                control={control}
                name="objective_assessment"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.inputArea, { borderColor: formErrors.objective_assessment ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    multiline
                    numberOfLines={3}
                    placeholder="Palpación, arcos de movilidad, fuerza y pruebas ortopédicas"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.objective_assessment && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.objective_assessment.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Plan Terapéutico y Ejercicios</Text>
              <Controller
                control={control}
                name="treatment_plan"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.inputArea, { borderColor: formErrors.treatment_plan ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    multiline
                    numberOfLines={3}
                    placeholder="Terapia manual, agentes físicos y ejercicios prescriptos"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.treatment_plan && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.treatment_plan.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Escala EVA de Dolor Inicial (0 - 10)</Text>
              <Controller
                control={control}
                name="pain_scale_initial"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.pain_scale_initial ? theme.error : theme.border, color: theme.text }]}
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.pain_scale_initial && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.pain_scale_initial.message}</Text>}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleSubmit(onCreateRecord)()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>Guardar Nota</Text>
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
  topActions: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', marginBottom: 8 },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  inputArea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: 'top', minHeight: 70 },
  btn: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  createBtn: { height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 4 },
  btnText: { color: '#FFFFFF', fontWeight: 'bold' },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diagnosis: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  painBadge: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  reason: { fontSize: 14, marginTop: 6 },
  plan: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  author: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  date: { fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { maxHeight: '90%', borderRadius: 14, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  fieldError: { fontSize: 11, marginTop: 2 },
  errorBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  errorBannerText: { fontSize: 12, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
