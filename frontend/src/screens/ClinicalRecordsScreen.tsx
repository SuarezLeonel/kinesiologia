import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';
import { PatientRoutinesModal } from '../components/treatments/PatientRoutinesModal';

const clinicalRecordSchema = z.object({
  patient_id: z.coerce.number().positive('Debe seleccionar un paciente'),
  reason_for_consultation: z.string().min(3, 'Ingrese el motivo de consulta'),
  subjective_assessment: z.string().min(3, 'Ingrese la evaluación subjetiva'),
  objective_assessment: z.string().min(3, 'Ingrese la evaluación objetiva'),
  diagnosis: z.string().min(3, 'Ingrese el diagnóstico kinésico'),
  treatment_plan: z.string().optional(),
  pain_scale_initial: z.coerce.number().min(0).max(10).default(5)
});

type ClinicalRecordFormData = z.infer<typeof clinicalRecordSchema>;

export const ClinicalRecordsScreen = () => {
  const { isReceptionist } = useAuth();
  const { theme } = useAppTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  // Modal Plan Terapéutico y Rutinas Clínicas
  const [routinesModalVisible, setRoutinesModalVisible] = useState(false);
  const [targetPatientForRoutines, setTargetPatientForRoutines] = useState<any | null>(null);

  const handleOpenRoutinesModal = (patientItem: any) => {
    setTargetPatientForRoutines(patientItem);
    setRoutinesModalVisible(true);
  };

  // Selector de pacientes en el modal
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<ClinicalRecordFormData>({
    resolver: zodResolver(clinicalRecordSchema) as any,
    defaultValues: {
      patient_id: 0,
      reason_for_consultation: '',
      subjective_assessment: '',
      objective_assessment: '',
      diagnosis: '',
      treatment_plan: '',
      pain_scale_initial: 5
    }
  });

  const selectedPain = watch('pain_scale_initial');
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

  const fetchRecords = async (query = '') => {
    if (isReceptionist) return;
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const response = await apiClient.post('/clinical-records/search', {
        search: query || undefined,
        limit: 50
      });
      if (response.data?.success) {
        setRecords(response.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener historias clínicas');
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

  // Búsqueda en tiempo real mientras escribe con debounce de 250ms
  useEffect(() => {
    if (isReceptionist) return;
    const timeout = setTimeout(() => {
      fetchRecords(searchTerm);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm, isReceptionist]);

  useEffect(() => {
    if (!isReceptionist) {
      fetchPatientsList();
    }
  }, [isReceptionist]);

  const onCreateRecord = async (data: ClinicalRecordFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/clinical-records', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        fetchRecords(searchTerm);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al guardar nota clínica');
    }
  };

  const onDownloadPdf = async (item: any) => {
    try {
      setDownloadingId(item.id);
      setDownloadFeedback(null);

      // REGLA HTTP ESTRICTA: POST para consultas y exportación
      const res = await apiClient.post(
        '/clinical-records/export-pdf',
        { id: item.id, format: 'base64' }
      );

      if (res.data?.success && res.data.data?.pdfBase64) {
        const { pdfBase64, filename } = res.data.data;
        const actualFilename = filename || `Historia_Clinica_HC-${item.id}.pdf`;

        if (Platform.OS === 'web') {
          const binaryString = window.atob(pdfBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = actualFilename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          setDownloadFeedback(`PDF descargado: ${actualFilename}`);
          setTimeout(() => setDownloadFeedback(null), 5000);
        } else {
          setDownloadFeedback(`PDF médico generado: ${actualFilename}`);
          setTimeout(() => setDownloadFeedback(null), 5000);
        }
      } else {
        throw new Error('No se recibieron los datos del archivo PDF');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Error al exportar la historia clínica';
      setDownloadFeedback(msg);
      setTimeout(() => setDownloadFeedback(null), 6000);
    } finally {
      setDownloadingId(null);
    }
  };

  // Protección de acceso clínico evaluada en render tras declarar hooks
  if (isReceptionist) {
    return <AccessDeniedState />;
  }

  const getPainBadgeVariant = (pain?: number) => {
    if (pain === undefined || pain === null) return 'neutral';
    if (pain <= 3) return 'success';
    if (pain <= 6) return 'warning';
    return 'error';
  };

  if (loading && !refreshing) return <LoadingState message="Cargando historias clínicas..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchRecords(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Historias Clínicas"
        subtitle="Evolución clínica, evaluaciones funcionales y escala de dolor"
        action={
          <Button
            title="+ Nueva Nota"
            size="sm"
            onPress={() => {
              setFormError(null);
              fetchPatientsList();
              const defaultPid = patients.length > 0 ? patients[0].id : 0;
              reset({
                patient_id: defaultPid,
                reason_for_consultation: '',
                subjective_assessment: '',
                objective_assessment: '',
                diagnosis: '',
                treatment_plan: '',
                pain_scale_initial: 5
              });
              setShowPatientPicker(false);
              setPatientSearch('');
              setModalVisible(true);
            }}
          />
        }
      />

      {/* Buscador en tiempo real */}
      <View style={styles.searchRow}>
        <Input
          placeholder="Buscar por paciente, DNI o diagnóstico kinésico..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          containerStyle={{ marginBottom: 0, flex: 1 }}
          rightAction={
            searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            ) : (
              <MaterialIcons name="search" size={20} color={theme.textMuted} />
            )
          }
        />
      </View>

      {/* Banner de descarga de PDF */}
      {downloadFeedback && (
        <View style={[styles.downloadFeedbackBanner, { backgroundColor: theme.primaryLight + '35', borderColor: theme.primary + '60' }]}>
          <MaterialIcons name="picture-as-pdf" size={18} color={theme.primary} style={{ marginRight: spacing.xs }} />
          <Text style={[styles.downloadFeedbackText, { color: theme.text }]}>
            {downloadFeedback}
          </Text>
        </View>
      )}

      <FlatList
        data={records}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRecords(searchTerm);
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin historias clínicas registradas"
            subtitle="No se encontraron notas clínicas que coincidan con la búsqueda."
          />
        }
        renderItem={({ item }) => {
          const dateStr = item.created_at
            ? new Date(item.created_at).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            : '';

          const patientLabel = item.patient_last_name
            ? `${item.patient_last_name}, ${item.patient_first_name} (DNI ${item.patient_dni})`
            : `Paciente #${item.patient_id}`;

          return (
            <Card elevated style={styles.recordCard} padding="lg">
              <View style={styles.cardHeader}>
                <View style={styles.headerInfo}>
                  <Text style={[styles.diagnosisTitle, { color: theme.text }]}>
                    {item.diagnosis || 'Evaluación General'}
                  </Text>
                  <Text style={[styles.patientLabel, { color: theme.primary }]}>
                    {patientLabel}
                  </Text>
                </View>
                <Badge
                  label={`Dolor: ${item.reported_pain_level ?? 0}/10`}
                  variant={getPainBadgeVariant(item.reported_pain_level)}
                  size="sm"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  Motivo de Consulta:
                </Text>
                <Text style={[styles.sectionContent, { color: theme.text }]}>
                  {item.consultation_reason || 'Sin motivo especificado'}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.authorInfoCol}>
                  <Text style={[styles.authorText, { color: theme.textMuted }]}>
                    Profesional: Lic. {item.author_name} {item.author_last_name}
                  </Text>
                  <Text style={[styles.dateText, { color: theme.textMuted }]}>
                    {dateStr}
                  </Text>
                </View>

                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.routinesButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => handleOpenRoutinesModal({
                      id: item.patient_id,
                      first_name: item.patient_first_name,
                      last_name: item.patient_last_name,
                      dni: item.patient_dni
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver plan y rutinas de paciente ${item.patient_id}`}
                  >
                    <MaterialIcons
                      name="fitness-center"
                      size={16}
                      color={theme.primary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.downloadPdfText, { color: theme.primary }]}>
                      Plan y Rutinas
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.downloadPdfButton,
                      {
                        backgroundColor: theme.primaryLight + '35',
                        borderColor: theme.primary + '60'
                      }
                    ]}
                    onPress={() => onDownloadPdf(item)}
                    disabled={downloadingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Descargar PDF médico de historia clínica ${item.id}`}
                  >
                    <MaterialIcons
                      name={downloadingId === item.id ? 'hourglass-top' : 'picture-as-pdf'}
                      size={16}
                      color={theme.primary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.downloadPdfText, { color: theme.primary }]}>
                      {downloadingId === item.id ? 'Generando...' : 'Descargar PDF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />

      {/* Modal de Nueva Nota Clínica */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Nueva Historia Clínica"
        subtitle="Registro de evaluación kinésica y diagnóstico"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar Nota Clínica"
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onCreateRecord)()}
            />
          </>
        }
      >
        {formError && (
          <View style={[styles.modalError, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        {/* SELECTOR DE PACIENTE */}
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
                      DNI: {selectedPatient.dni}
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

        <Controller
          control={control}
          name="diagnosis"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Diagnóstico Kinésico"
              value={value}
              onChangeText={onChange}
              placeholder="Ej. Tendinopatía supraespinoso / Lumbalgia mecánica"
              error={formErrors.diagnosis?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="reason_for_consultation"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Motivo de consulta"
              value={value}
              onChangeText={onChange}
              placeholder="Ej. Dolor agudo al realizar abducción de hombro"
              error={formErrors.reason_for_consultation?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="subjective_assessment"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Evaluación Subjetiva (Anamnesis)"
              value={value}
              onChangeText={onChange}
              placeholder="Sensaciones del paciente, cronología y actividades agravantes"
              multiline
              numberOfLines={3}
              error={formErrors.subjective_assessment?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="objective_assessment"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Evaluación Objetiva (Examen Físico)"
              value={value}
              onChangeText={onChange}
              placeholder="Palpación, rango articular (ROM), fuerza muscular"
              multiline
              numberOfLines={3}
              error={formErrors.objective_assessment?.message}
              required
            />
          )}
        />

        <View style={styles.painContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Escala Analógica Visual de Dolor (EVA): {selectedPain}/10
          </Text>
          <View style={styles.painButtonsRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = selectedPain === num;
              return (
                <TouchableOpacity
                  key={num}
                  onPress={() => setValue('pain_scale_initial', num)}
                  style={[
                    styles.painCircle,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.painCircleText,
                      { color: isSelected ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Controller
          control={control}
          name="treatment_plan"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Plan de Tratamiento y Objetivos (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="Frecuencia semanal, técnicas de fisioterapia, protocolo de ejercicios"
              multiline
              numberOfLines={2}
            />
          )}
        />
      </ModalWrapper>

      {/* MODAL: PLAN TERAPÉUTICO Y RUTINAS CLÍNICAS */}
      <PatientRoutinesModal
        visible={routinesModalVisible}
        onClose={() => setRoutinesModalVisible(false)}
        patient={targetPatientForRoutines}
        onSuccess={() => {
          fetchRecords(searchTerm);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'center'
  },
  downloadFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  downloadFeedbackText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    flex: 1
  },
  searchInputContainer: {
    flex: 1
  },
  recordCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  headerInfo: {
    flex: 1
  },
  diagnosisTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  patientLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm
  },
  sectionBlock: {
    marginBottom: spacing.xs
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2
  },
  sectionContent: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  authorInfoCol: {
    flex: 1,
    minWidth: 160
  },
  authorText: {
    fontSize: typography.fontSize.xs
  },
  dateText: {
    fontSize: typography.fontSize.xs
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  routinesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1
  },
  downloadPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1
  },
  downloadPdfText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
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
  painContainer: {
    marginBottom: spacing.md
  },
  painButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  painCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  painCircleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  }
});
