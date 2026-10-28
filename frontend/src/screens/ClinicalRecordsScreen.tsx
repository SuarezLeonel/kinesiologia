import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
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
    watch,
    setValue,
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

  const selectedPain = watch('pain_scale_initial');

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
          />
        }
      />

      {/* Buscador de paciente por ID */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Input
            placeholder="Ingrese ID del Paciente (ej: 1)..."
            value={patientId}
            onChangeText={setPatientId}
            keyboardType="numeric"
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Ver Ficha"
          variant="secondary"
          size="md"
          onPress={fetchRecords}
          style={{ marginLeft: spacing.sm }}
        />
      </View>

      {loading ? (
        <LoadingState message="Consultando registros clínicos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRecords} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <EmptyState
              title="Sin registros clínicos"
              subtitle={`No hay evoluciones registradas para el paciente #${patientId}.`}
              action={{
                label: 'Agregar nota de evolución',
                onPress: () => setModalVisible(true)
              }}
            />
          }
          renderItem={({ item }) => {
            const pain = item.pain_scale_initial ?? item.reported_pain_level;
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })
              : '';

            return (
              <Card elevated style={styles.recordCard} padding="lg">
                <View style={styles.recordHeader}>
                  <View style={styles.titleCol}>
                    <Text style={[styles.diagnosisText, { color: theme.text }]}>
                      {item.diagnosis || 'Consulta Kinésica'}
                    </Text>
                    <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                      {dateStr} • Por {item.kinesiologist_first_name || item.author_name || 'Lic.'} {item.kinesiologist_last_name || item.author_last_name || ''}
                    </Text>
                  </View>

                  {pain !== null && pain !== undefined && (
                    <Badge
                      label={`EVA ${pain}/10`}
                      variant={getPainBadgeVariant(pain)}
                      size="sm"
                    />
                  )}
                </View>

                <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

                {item.reason_for_consultation && (
                  <View style={styles.sectionRow}>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Motivo:</Text>
                    <Text style={[styles.sectionValue, { color: theme.text }]}>
                      {item.reason_for_consultation}
                    </Text>
                  </View>
                )}

                {item.subjective_assessment && (
                  <View style={styles.sectionRow}>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Subjetivo:</Text>
                    <Text style={[styles.sectionValue, { color: theme.text }]}>
                      {item.subjective_assessment}
                    </Text>
                  </View>
                )}

                {item.objective_assessment && (
                  <View style={styles.sectionRow}>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Objetivo:</Text>
                    <Text style={[styles.sectionValue, { color: theme.text }]}>
                      {item.objective_assessment}
                    </Text>
                  </View>
                )}

                {item.treatment_plan && (
                  <View style={[styles.planBox, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={[styles.planTitle, { color: theme.primary }]}>Plan y Tratamiento:</Text>
                    <Text style={[styles.planValue, { color: theme.text }]}>
                      {item.treatment_plan}
                    </Text>
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* Modal de Creación de Nota Clínica */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Nueva Nota de Evolución"
        subtitle="Complete la anamnesis, examen físico y prescripción de tratamiento"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar Nota"
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
              placeholder="Movilidad articular, fuerza muscular, palpación y pruebas ortopédicas"
              multiline
              numberOfLines={3}
              error={formErrors.objective_assessment?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="treatment_plan"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Plan Terapéutico y Ejercicios"
              value={value}
              onChangeText={onChange}
              placeholder="Terapia manual, electroanalgesia, protocolo excéntrico"
              multiline
              numberOfLines={3}
              error={formErrors.treatment_plan?.message}
              required
            />
          )}
        />

        {/* Selector Visual de Escala EVA (0 a 10) */}
        <View style={styles.painSelectorContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Escala Analógica Visual del Dolor (EVA: {selectedPain ?? 5}/10)
          </Text>
          <View style={styles.painChipsRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = selectedPain === num;
              return (
                <TouchableOpacity
                  key={num}
                  onPress={() => setValue('pain_scale_initial', num)}
                  style={[
                    styles.painChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.painChipText,
                      { color: isSelected ? theme.primaryContrast : theme.text }
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  searchInputContainer: {
    flex: 1
  },
  recordCard: {
    marginBottom: spacing.md
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  titleCol: {
    flex: 1,
    paddingRight: spacing.sm
  },
  diagnosisText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  },
  sectionRow: {
    marginBottom: spacing.sm
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 1
  },
  sectionValue: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal
  },
  planBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs
  },
  planTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  planValue: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal
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
  painSelectorContainer: {
    marginBottom: spacing.md
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs + 2
  },
  painChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  painChip: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  painChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  }
});
