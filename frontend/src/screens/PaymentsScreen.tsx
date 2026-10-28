import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
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
    watch,
    setValue,
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

  const selectedMethod = watch('payment_method');

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
            size="sm"
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
            title="Sin registros de cobros"
            subtitle="No se registran pagos en la jornada."
            action={{
              label: 'Registrar nuevo cobro',
              onPress: () => setModalVisible(true)
            }}
          />
        }
        renderItem={({ item }) => {
          const dateStr = item.created_at
            ? new Date(item.created_at).toLocaleString('es-AR', {
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
                  <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
                  <Text style={[styles.notesText, { color: theme.textMuted }]}>
                    Nota: {item.notes}
                  </Text>
                </>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Modal de Alta de Pago */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Registrar Cobro"
        subtitle="Asiento de pago con control estricto de idempotencia"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar Cobro"
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

        {/* Selector de Método de Pago */}
        <View style={styles.methodContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Método de Pago *</Text>
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
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.border
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      { color: isSelected ? theme.primaryContrast : theme.text }
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
          name="notes"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Observaciones (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="Detalle de sesión o número de autorización"
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
    flex: 1,
    paddingRight: spacing.sm
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
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs + 2
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
