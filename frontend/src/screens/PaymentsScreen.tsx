/**
 * @file PaymentsScreen.tsx
 * @description Pantalla de caja y cobros: registro de pagos, venta de paquetes y arqueo diario (exclusivo Admin/Recepción).
 */
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
  Platform,
  ActivityIndicator
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

interface CajaSummary {
  date: string;
  totalIncome: number;
  transactionsCount: number;
  cashTotal: number;
  electronicTotal: number;
  byMethod: {
    cash: number;
    transfer: number;
    debit_card: number;
    credit_card: number;
    insurance: number;
  };
}

export const PaymentsScreen = () => {
  const { theme } = useAppTheme();
  const { isKinesiologist } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [cajaSummary, setCajaSummary] = useState<CajaSummary | null>(null);
  const [viewFilter, setViewFilter] = useState<'today' | 'all'>('today');
  const [patients, setPatients] = useState<any[]>([]);
  const [basePatients, setBasePatients] = useState<any[]>([]);
  const [selectedPatientObj, setSelectedPatientObj] = useState<any>(null);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
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

  const selectedPatient = useMemo(() => {
    if (!selectedPatientId || Number(selectedPatientId) === 0) return null;
    return (
      patients.find((p) => p.id === Number(selectedPatientId)) ||
      basePatients.find((p) => p.id === Number(selectedPatientId)) ||
      selectedPatientObj
    );
  }, [patients, basePatients, selectedPatientId, selectedPatientObj]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return basePatients;
    const q = patientSearch.toLowerCase().trim();
    const combined = [...basePatients];
    for (const p of patients) {
      if (!combined.some((item) => item.id === p.id)) {
        combined.push(p);
      }
    }
    return combined.filter((p) => {
      const fullName = `${p.last_name || ''} ${p.first_name || ''} ${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const dni = String(p.dni || '');
      const email = String(p.email || '').toLowerCase();
      return fullName.includes(q) || dni.includes(q) || email.includes(q);
    });
  }, [basePatients, patients, patientSearch]);

  const fetchCajaSummary = async () => {
    if (isKinesiologist) return;
    try {
      // REGLA HTTP ESTRICTA: POST para consultas de métricas
      const res = await apiClient.post('/payments/caja-summary', {});
      if (res.data?.success) {
        setCajaSummary(res.data.data);
      }
    } catch {
      // Manejo silencioso para no bloquear la lista
    }
  };

  const fetchPayments = async (filterMode: 'today' | 'all' = viewFilter) => {
    if (isKinesiologist) return;
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST para consultas con payload
      const res = await apiClient.post('/payments/search', {
        todayOnly: filterMode === 'today',
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

  const fetchPatientsList = async (searchQuery?: string) => {
    try {
      if (searchQuery) {
        setIsSearchingPatients(true);
      }
      // REGLA HTTP ESTRICTA: POST para consultas con filtros
      const res = await apiClient.post('/patients/search', {
        search: searchQuery?.trim() || undefined,
        page: 1,
        limit: 300
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        if (!searchQuery) {
          setBasePatients(list);
          setPatients(list);
        } else {
          setPatients(list);
        }
      }
    } catch {
      // Manejo silencioso
    } finally {
      setIsSearchingPatients(false);
    }
  };

  useEffect(() => {
    if (!patientSearch.trim()) {
      setIsSearchingPatients(false);
      return;
    }
    const timer = setTimeout(() => {
      fetchPatientsList(patientSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const loadAll = async (mode: 'today' | 'all' = viewFilter) => {
    await Promise.all([fetchPayments(mode), fetchCajaSummary(), fetchPatientsList()]);
  };

  useEffect(() => {
    if (!isKinesiologist) {
      loadAll();
    }
  }, [isKinesiologist]);

  const handleFilterChange = (mode: 'today' | 'all') => {
    setViewFilter(mode);
    setLoading(true);
    fetchPayments(mode);
  };

  const onCreatePayment = async (data: PaymentFormData) => {
    setFormError(null);
    try {
      const response = await apiClient.post('/payments', data);
      if (response.data?.success) {
        setModalVisible(false);
        reset();
        await Promise.all([fetchPayments(viewFilter), fetchCajaSummary()]);
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

  if (loading && !refreshing) return <LoadingState message="Cargando cobros y caja del día..." />;
  if (error) return <ErrorState message={error} onRetry={() => loadAll(viewFilter)} />;

  const paymentMethods: { key: PaymentFormData['payment_method']; label: string }[] = [
    { key: 'cash', label: 'Efectivo' },
    { key: 'debit_card', label: 'Débito' },
    { key: 'credit_card', label: 'Crédito' },
    { key: 'bank_transfer', label: 'Transferencia' },
    { key: 'qr_mercadopago', label: 'QR / MP' }
  ];

  const todayLabel = cajaSummary?.date
    ? new Date(`${cajaSummary.date}T12:00:00`).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Cobros y Caja"
        subtitle="Control diario de aranceles, arqueo de ingresos y facturación"
        action={
          <Button
            title="+ Registrar Cobro"
            onPress={() => {
              setFormError(null);
              fetchPatientsList();
              setSelectedPatientObj(null);
              reset({
                patient_id: 0,
                amount: 15000,
                payment_method: 'cash',
                receipt_number: `REC-${Date.now().toString().slice(-6)}`,
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
              loadAll(viewFilter);
            }}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* TARJETA DE ARQUEO DIARIO DE CAJA */}
            <Card elevated style={styles.cajaCard} padding="lg">
              <View style={styles.cajaTopRow}>
                <View style={styles.cajaHeaderTitleRow}>
                  <MaterialIcons name="point-of-sale" size={22} color={theme.primary} style={{ marginRight: spacing.xs }} />
                  <Text style={[styles.cajaCardTitle, { color: theme.text }]}>
                    ARQUEO DE CAJA DEL DÍA
                  </Text>
                </View>
                <Badge
                  label={`JORNADA: ${todayLabel}`}
                  variant="neutral"
                  size="sm"
                />
              </View>

              <View style={styles.cajaAmountRow}>
                <View>
                  <Text style={[styles.cajaAmountLabel, { color: theme.textSecondary }]}>
                    Total Cobrado Hoy
                  </Text>
                  <Text style={[styles.cajaBigAmount, { color: theme.text }]}>
                    ${Number(cajaSummary?.totalIncome || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.txCountBadgeWrapper}>
                  <Badge
                    label={`${cajaSummary?.transactionsCount || 0} ${cajaSummary?.transactionsCount === 1 ? 'COBRO' : 'COBROS'}`}
                    variant={Number(cajaSummary?.transactionsCount || 0) > 0 ? 'success' : 'neutral'}
                    size="md"
                  />
                </View>
              </View>

              {/* DESGLOSE POR MÉTODO DE PAGO DE HOY */}
              <View style={[styles.cajaDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.cajaBreakdownTitle, { color: theme.textSecondary }]}>
                DESGLOSE DE HOY POR MEDIO DE COBRO
              </Text>

              <View style={styles.methodsGrid}>
                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="payments" size={16} color="#16A34A" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Efectivo</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number(cajaSummary?.cashTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="qr-code-scanner" size={16} color="#0284C7" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Transferencia / MP</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number(cajaSummary?.byMethod?.transfer || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="credit-card" size={16} color="#9333EA" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Tarjetas Déb/Créd</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number((cajaSummary?.byMethod?.debit_card || 0) + (cajaSummary?.byMethod?.credit_card || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="health-and-safety" size={16} color="#D97706" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Obra Social</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number(cajaSummary?.byMethod?.insurance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </Card>

            {/* SELECTOR DE VISTA: SOLO HOY VS HISTÓRICO */}
            <View style={styles.filterSection}>
              <View style={styles.filterTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    viewFilter === 'today'
                      ? [styles.filterTabActive, { backgroundColor: theme.primary, borderColor: theme.primary }]
                      : [styles.filterTabInactive, { backgroundColor: theme.surface, borderColor: theme.border }]
                  ]}
                  onPress={() => handleFilterChange('today')}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name="today"
                    size={16}
                    color={viewFilter === 'today' ? '#FFFFFF' : theme.textSecondary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: viewFilter === 'today' ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    Cobros de Hoy
                  </Text>
                  {Number(cajaSummary?.transactionsCount || 0) > 0 && (
                    <View
                      style={[
                        styles.filterBadge,
                        { backgroundColor: viewFilter === 'today' ? '#FFFFFF' : theme.primaryLight + '50' }
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterBadgeText,
                          { color: viewFilter === 'today' ? theme.primary : '#FFFFFF' }
                        ]}
                      >
                        {cajaSummary?.transactionsCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    viewFilter === 'all'
                      ? [styles.filterTabActive, { backgroundColor: theme.primary, borderColor: theme.primary }]
                      : [styles.filterTabInactive, { backgroundColor: theme.surface, borderColor: theme.border }]
                  ]}
                  onPress={() => handleFilterChange('all')}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name="history"
                    size={16}
                    color={viewFilter === 'all' ? '#FFFFFF' : theme.textSecondary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: viewFilter === 'all' ? '#FFFFFF' : theme.text }
                    ]}
                  >
                    Historial Completo
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionNoticeRow}>
                <MaterialIcons
                  name={viewFilter === 'today' ? 'check-circle' : 'info'}
                  size={15}
                  color={viewFilter === 'today' ? theme.primary : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.sectionNoticeText, { color: theme.textSecondary }]}>
                  {viewFilter === 'today'
                    ? `Mostrando exclusivamente cobros registrados hoy (${todayLabel})`
                    : 'Mostrando historial general de cobros y comprobantes pasados'}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={viewFilter === 'today' ? 'Sin cobros asentados hoy' : 'Sin cobros registrados'}
            subtitle={
              viewFilter === 'today'
                ? `Aún no se han cobrado aranceles en la fecha ${todayLabel}. Utilice "+ Registrar Cobro" para asentar un ingreso en la caja.`
                : 'Aún no se han registrado cobros o comprobantes en el sistema.'
            }
          />
        }
        renderItem={({ item }) => {
          const dateStr = item.payment_date || item.created_at
            ? new Date(item.payment_date || item.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
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
                    Recibo: {item.receipt_number || 'S/N'} • {dateStr}
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
        subtitle="Seleccione el paciente y asiente el pago de aranceles en la caja"
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
                  placeholder="Buscar por nombre, apellido, DNI o email..."
                  placeholderTextColor={theme.textMuted}
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                  style={[styles.searchInput, { color: theme.text }]}
                  autoFocus
                />
                {isSearchingPatients && (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: spacing.xs }} />
                )}
                {patientSearch ? (
                  <TouchableOpacity onPress={() => setPatientSearch('')}>
                    <MaterialIcons name="close" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredPatients.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={[styles.dropdownEmptyText, { color: theme.textMuted }]}>
                      {isSearchingPatients
                        ? 'Buscando pacientes en el consultorio...'
                        : 'No se encontraron pacientes que coincidan'}
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
                          setSelectedPatientObj(p);
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
                            DNI: {p.dni}{p.email ? ` • ${p.email}` : ''}
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
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md
  },
  headerContainer: {
    marginBottom: spacing.md
  },
  cajaCard: {
    marginBottom: spacing.md
  },
  cajaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  cajaHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cajaCardTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  cajaAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginVertical: spacing.xs
  },
  cajaAmountLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  cajaBigAmount: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.5,
    marginTop: 2
  },
  txCountBadgeWrapper: {
    marginBottom: 4
  },
  cajaDivider: {
    height: 1,
    marginVertical: spacing.md
  },
  cajaBreakdownTitle: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.4,
    marginBottom: spacing.sm
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  methodStatCard: {
    flex: 1,
    minWidth: 140,
    padding: spacing.sm + 2,
    borderRadius: radii.md
  },
  methodStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  methodStatLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4
  },
  methodStatValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  filterSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1
  },
  filterTabActive: {},
  filterTabInactive: {},
  filterTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold
  },
  filterBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full
  },
  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  sectionNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: 2
  },
  sectionNoticeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
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
    maxHeight: 220
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
