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
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

const paymentSchema = z.object({
  patient_id: z.coerce.number().positive('Debe seleccionar un paciente'),
  amount: z.coerce.number().positive('El monto debe ser un valor positivo'),
  payment_method: z.enum(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'insurance', 'qr_mercadopago']),
  receipt_number: z.string().min(3, 'El número de comprobante debe tener al menos 3 caracteres'),
  notes: z.string().optional()
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export const PaymentsScreen = () => {
  const { theme } = useAppTheme();
  const { isKinesiologist } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selector desplegable de pacientes
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      patient_id: 0,
      amount: 15000,
      payment_method: 'cash',
      receipt_number: '',
      notes: ''
    }
  });

  const selectedMethod = watch('payment_method');
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

  const fetchPayments = async () => {
    if (isKinesiologist) return;
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas
      const res = await apiClient.post('/payments/search', {
        page: 1,
        limit: 50
      });
      if (res.data?.success) {
        setPayments(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener transacciones de cobros');
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
    if (!isKinesiologist) {
      fetchPayments();
      fetchPatientsList();
    }
  }, [isKinesiologist]);

  const onCreatePayment = async (data: PaymentFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/payments', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        fetchPayments();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar el cobro');
    }
  };

  // Kinesiólogo no tiene acceso a caja y cobros administrativos
  if (isKinesiologist) {
    return <AccessDeniedState />;
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Efectivo';
      case 'debit_card':
        return 'Tarjeta Débito';
      case 'credit_card':
        return 'Tarjeta Crédito';
      case 'bank_transfer':
      case 'transfer':
        return 'Transferencia';
      case 'qr_mercadopago':
        return 'Mercado Pago QR';
      case 'insurance':
        return 'Obra Social';
      default:
        return method?.toUpperCase() || 'Cobro';
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando cobros y pagos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPayments} />;

  const paymentMethods: { key: PaymentFormData['payment_method']; label: string }[] = [
    { key: 'cash', label: 'Efectivo' },
    { key: 'debit_card', label: 'Débito' },
    { key: 'credit_card', label: 'Crédito' },
    { key: 'bank_transfer', label: 'Transferencia' },
    { key: 'qr_mercadopago', label: 'QR / MP' }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Cobros y Caja"
        subtitle="Registro de transacciones de aranceles y facturación"
        action={
          <Button
            title="+ Registrar Cobro"
            onPress={() => {
              setFormError(null);
              fetchPatientsList();
              const defaultPid = patients.length > 0 ? patients[0].id : 0;
              reset({
                patient_id: defaultPid,
                amount: 15000,
                payment_method: 'cash',
                receipt_number: `REC-${Date.now().toString().slice(-5)}`,
                notes: ''
              });
              setShowPatientPicker(false);
              setPatientSearch('');
              setModalVisible(true);
            }}
            size="sm"
          />
        }
      />

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPayments();
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin cobros registrados"
            subtitle="Aún no se han asentado pagos o recibos en la caja."
          />
        }
        renderItem={({ item }) => {
          const dateStr = item.payment_date || item.created_at
            ? new Date(item.payment_date || item.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '';

          return (
            <Card elevated style={styles.paymentCard} padding="lg">
              <View style={styles.cardHeader}>
                <View style={styles.infoCol}>
                  <Text style={[styles.patientName, { color: theme.text }]}>
                    {item.patient_last_name}, {item.patient_first_name}
                  </Text>
                  <Text style={[styles.receiptText, { color: theme.textSecondary }]}>
                    Comprobante: {item.receipt_number || 'S/N'} • {dateStr}
                  </Text>
                </View>

                <View style={styles.amountCol}>
                  <Text style={[styles.amountValue, { color: theme.text }]}>
                    ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                  <Badge
                    label={getMethodLabel(item.payment_method)}
                    variant="neutral"
                    size="sm"
                    style={{ alignSelf: 'flex-end', marginTop: 4 }}
                  />
                </View>
              </View>

              {item.notes ? (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.notesText, { color: theme.textMuted }]}>
                    Nota: {item.notes}
                  </Text>
                </>
              ) : null}
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />

      {/* Modal de Alta de Pago */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Registrar Cobro"
        subtitle="Seleccione el paciente y asiente el pago de aranceles"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Asentar Pago"
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onCreatePayment)()}
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
          name="amount"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Monto a Cobrar ($)"
              value={String(value || '')}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="15000"
              error={formErrors.amount?.message}
              required
            />
          )}
        />

        <View style={styles.methodContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Medio de Pago</Text>
          <View style={styles.methodRow}>
            {paymentMethods.map((m) => {
              const isSelected = selectedMethod === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setValue('payment_method', m.key)}
                  style={[
                    styles.methodChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      { color: isSelected ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Controller
          control={control}
          name="receipt_number"
          render={({ field: { onChange, value } }) => (
            <Input
              label="N° de Recibo / Comprobante"
              value={value}
              onChangeText={onChange}
              placeholder="REC-00123"
              error={formErrors.receipt_number?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Observaciones (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="Detalle o concepto del cobro..."
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
  paymentCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  infoCol: {
    flex: 1
  },
  patientName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  receiptText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  amountCol: {
    alignItems: 'flex-end'
  },
  amountValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm
  },
  notesText: {
    fontSize: typography.fontSize.xs
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
  methodContainer: {
    marginBottom: spacing.md
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
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2
  },
  methodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1
  },
  methodChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  }
});
