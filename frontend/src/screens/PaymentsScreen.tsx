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
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

const paymentSchema = z.object({
  patient_id: z.coerce.number().positive('El ID de paciente debe ser mayor a 0'),
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
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      patient_id: 1,
      amount: 15000,
      payment_method: 'cash',
      receipt_number: '',
      notes: ''
    }
  });

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

  useEffect(() => {
    if (!isKinesiologist) {
      fetchPayments();
    }
  }, [isKinesiologist]);

  const onCreatePayment = async (data: PaymentFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/payments/create', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        fetchPayments();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar el cobro');
    }
  };

  // Kinesiólogo no tiene acceso a caja y cobros administrativos (evaluado tras registrar hooks)
  if (isKinesiologist) {
    return <AccessDeniedState />;
  }

  if (loading && !refreshing) return <LoadingState message="Cargando cobros y pagos..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPayments} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: theme.primary }]}
        onPress={() => {
          setFormError(null);
          reset({
            patient_id: 1,
            amount: 15000,
            payment_method: 'cash',
            receipt_number: `REC-${Date.now().toString().slice(-6)}`,
            notes: ''
          });
          setModalVisible(true);
        }}
      >
        <Text style={styles.createBtnText}>+ Registrar Cobro</Text>
      </TouchableOpacity>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
        ListEmptyComponent={<EmptyState title="Sin registros de cobros" subtitle="No se han registrado pagos hoy" />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.header}>
              <Text style={[styles.patient, { color: theme.text }]}>
                {item.patient_last_name}, {item.patient_first_name}
              </Text>
              <Text style={[styles.amount, { color: theme.success }]}>
                ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={[styles.method, { color: theme.textSecondary }]}>
                Método: {item.payment_method?.toUpperCase()}
              </Text>
              <Text style={[styles.receipt, { color: theme.textSecondary }]}>
                Comprobante: {item.receipt_number || 'S/N'}
              </Text>
            </View>
            <Text style={[styles.date, { color: theme.textSecondary }]}>
              {item.created_at ? new Date(item.created_at).toLocaleString('es-AR') : ''}
            </Text>
          </View>
        )}
      />

      {/* Modal de Alta de Pago */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Registrar Cobro</Text>

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

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Monto ($)</Text>
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.amount ? theme.error : theme.border, color: theme.text }]}
                    value={String(value || '')}
                    onChangeText={onChange}
                    keyboardType="numeric"
                  />
                )}
              />
              {formErrors.amount && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.amount.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>N° de Recibo / Comprobante</Text>
              <Controller
                control={control}
                name="receipt_number"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.receipt_number ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="REC-00123"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.receipt_number && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.receipt_number.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Método de Pago</Text>
              <Controller
                control={control}
                name="payment_method"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.methodSelector}>
                    {[
                      { key: 'cash', label: 'Efectivo' },
                      { key: 'debit_card', label: 'Débito' },
                      { key: 'credit_card', label: 'Crédito' },
                      { key: 'bank_transfer', label: 'Transferencia' },
                      { key: 'qr_mercadopago', label: 'QR / MP' }
                    ].map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.methodChip,
                          { borderColor: theme.border },
                          value === m.key && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => onChange(m.key)}
                      >
                        <Text style={[styles.methodChipText, { color: value === m.key ? '#FFFFFF' : theme.text }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Notas / Observaciones</Text>
              <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Opcional..."
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
                  onPress={() => handleSubmit(onCreatePayment)()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createBtnText}>Guardar Cobro</Text>
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
  card: { padding: 16, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  patient: { fontSize: 16, fontWeight: 'bold' },
  amount: { fontSize: 16, fontWeight: 'bold' },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  method: { fontSize: 13, textTransform: 'capitalize' },
  receipt: { fontSize: 13 },
  date: { fontSize: 11, marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { maxHeight: '90%', borderRadius: 14, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  fieldError: { fontSize: 11, marginTop: 2 },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  methodSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  methodChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  methodChipText: { fontSize: 12, fontWeight: '600' },
  errorBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  errorBannerText: { fontSize: 12, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
