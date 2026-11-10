/**
 * @file PaymentsScreen.tsx
 * @description Pantalla de caja y cobros: registro de pagos con precios de catálogo no modificables,
 * selección de consultas atendidas y arqueo diario (exclusivo Admin/Recepción).
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useDataSync } from '../context/DataSyncContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { useResponsive } from '../theme/useResponsive';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AccessDeniedState } from '../components/FeedbackStates';

const paymentSchema = z.object({
  patient_id: z.coerce.number().positive('Seleccioná un paciente.'),
  appointment_id: z.coerce.number().positive('Seleccioná una consulta.'),
  payment_method: z.enum(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'insurance', 'qr_mercadopago']),
  receipt_number: z.string().min(3, 'Completá este campo.'),
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
  const { isPhone, isSmallPhone, isDesktop, contentMaxWidth } = useResponsive();
  const { isKinesiologist } = useAuth();
  const { scopeVersions } = useDataSync();
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

  // Consultas y turnos realizados del paciente seleccionado
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [selectedAppointmentObj, setSelectedAppointmentObj] = useState<any>(null);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [showAppointmentPicker, setShowAppointmentPicker] = useState(false);

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
      appointment_id: 0,
      payment_method: 'cash',
      receipt_number: '',
      notes: ''
    }
  });

  const selectedMethod = watch('payment_method');
  const selectedPatientId = watch('patient_id');
  const selectedAppointmentId = watch('appointment_id');

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

  const fetchPayments = async (filterMode: 'today' | 'all' = viewFilter, silent = false) => {
    if (isKinesiologist) return;
    try {
      if (!silent) {
        setError(null);
      }
      // REGLA HTTP ESTRICTA: POST para consultas con payload
      const res = await apiClient.post('/payments/search', {
        todayOnly: filterMode === 'today',
        page: 1,
        limit: 50
      });
      if (res.data?.success) {
        setPayments(res.data.data);
        setError(null);
      }
    } catch (err: any) {
      if (!silent || (payments.length === 0 && !cajaSummary)) {
        setError(err.response?.data?.error?.message || 'Error al obtener transacciones de cobros');
      }
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

  const fetchPatientAppointments = async (patientId: number) => {
    if (!patientId) {
      setPatientAppointments([]);
      setSelectedAppointmentObj(null);
      return;
    }
    setIsLoadingAppointments(true);
    try {
      // REGLA HTTP ESTRICTA: POST para obtener turnos atendidos y no cobrados
      const res = await apiClient.post('/appointments/search', {
        patientId,
        status: 'attended',
        unpaidOnly: true,
        limit: 100
      });
      if (res.data?.success) {
        setPatientAppointments(res.data.data || []);
      } else {
        setPatientAppointments([]);
      }
    } catch {
      setPatientAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  const generateReceiptNumber = () => {
    const code = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    setValue('receipt_number', code, { shouldValidate: true });
  };

  const formatAppointmentDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const loadAll = async (mode: 'today' | 'all' = viewFilter, silent = false) => {
    await Promise.all([fetchPayments(mode, silent), fetchCajaSummary(), fetchPatientsList()]);
  };

  useEffect(() => {
    if (!isKinesiologist) {
      loadAll(viewFilter, false);
    }
  }, [isKinesiologist]);

  useEffect(() => {
    if (isKinesiologist) return;
    if (
      scopeVersions.payments > 0 ||
      scopeVersions.appointments > 0 ||
      scopeVersions.patients > 0 ||
      scopeVersions.services > 0
    ) {
      loadAll(viewFilter, true);
      if (modalVisible && selectedPatientId && Number(selectedPatientId) > 0) {
        fetchPatientAppointments(Number(selectedPatientId));
      }
    }
  }, [
    scopeVersions.payments,
    scopeVersions.appointments,
    scopeVersions.patients,
    scopeVersions.services,
    isKinesiologist
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!isKinesiologist) {
        loadAll(viewFilter, true);
      }
    }, [viewFilter, isKinesiologist])
  );

  const handleFilterChange = (mode: 'today' | 'all') => {
    setViewFilter(mode);
    fetchPayments(mode, true);
  };

  const onCreatePayment = async (data: PaymentFormData) => {
    setFormError(null);
    try {
      // Seguridad: el backend ignora cualquier importe enviado y utiliza el precio de catálogo de la BD
      const response = await apiClient.post('/payments', {
        patient_id: data.patient_id,
        appointment_id: data.appointment_id,
        payment_method: data.payment_method,
        receipt_number: data.receipt_number,
        notes: data.notes
      });

      if (response.data?.success) {
        const createdId = response.data.data?.id || Date.now();
        const amountNumber = Number(
          response.data.data?.amount ||
            selectedAppointmentObj?.agreed_price ||
            selectedAppointmentObj?.service_default_price ||
            0
        );
        const optimisticPayment = {
          id: createdId,
          patient_id: data.patient_id,
          appointment_id: data.appointment_id,
          patient_first_name: selectedPatient?.first_name || '',
          patient_last_name: selectedPatient?.last_name || '',
          patient_dni: selectedPatient?.dni || '',
          service_name: selectedAppointmentObj?.service_name || 'Consulta Kinésica',
          amount: amountNumber,
          payment_method: data.payment_method,
          receipt_number: data.receipt_number,
          notes: data.notes,
          paid_at: new Date().toISOString()
        };
        setPayments((prev) => [optimisticPayment, ...prev.filter((p) => p.id !== createdId)]);
        setModalVisible(false);
        reset();
        setSelectedPatientObj(null);
        setSelectedAppointmentObj(null);
        setPatientAppointments([]);
        await Promise.all([fetchPayments(viewFilter, true), fetchCajaSummary()]);
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

  if (loading && !refreshing && payments.length === 0 && !cajaSummary) {
    return <LoadingState message="Cargando cobros y caja del día..." />;
  }
  if (error && payments.length === 0 && !cajaSummary) {
    return <ErrorState message={error} onRetry={() => loadAll(viewFilter, false)} />;
  }

  const paymentMethods: { key: PaymentFormData['payment_method']; label: string }[] = [
    { key: 'cash', label: 'Efectivo' },
    { key: 'debit_card', label: 'Débito' },
    { key: 'credit_card', label: 'Crédito' },
    { key: 'bank_transfer', label: 'Transferencia' },
    { key: 'qr_mercadopago', label: 'QR / MP' },
    { key: 'insurance', label: 'Obra Social' }
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

  const configuredPrice = selectedAppointmentObj
    ? Number(selectedAppointmentObj.agreed_price || selectedAppointmentObj.service_default_price || 0)
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          width: '100%',
          flex: 1,
          paddingHorizontal: isSmallPhone ? spacing.sm : isPhone ? spacing.md : spacing.xl
        }
      ]}
    >
      <ScreenHeader
        title="Cobros y Caja"
        action={
          <Button
            title="+ Registrar Cobro"
            onPress={() => {
              setFormError(null);
              fetchPatientsList();
              setSelectedPatientObj(null);
              setSelectedAppointmentObj(null);
              setPatientAppointments([]);
              setShowPatientPicker(false);
              setShowAppointmentPicker(false);
              setPatientSearch('');
              reset({
                patient_id: 0,
                appointment_id: 0,
                payment_method: 'cash',
                receipt_number: `REC-${Date.now().toString().slice(-6)}`,
                notes: ''
              });
              setModalVisible(true);
            }}
            size="sm"
          />
        }
      />

      <FlatList
        key={isDesktop ? 'pay-grid-2' : 'pay-list-1'}
        numColumns={isDesktop ? 2 : 1}
        columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
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
                    CAJA DE HOY
                  </Text>
                </View>
                <Badge
                  label={todayLabel}
                  variant="neutral"
                  size="sm"
                />
              </View>

              <View style={styles.cajaAmountRow}>
                <View>
                  <Text style={[styles.cajaAmountLabel, { color: theme.textSecondary }]}>
                    Total cobrado hoy
                  </Text>
                  <Text style={[styles.cajaBigAmount, { color: theme.text }]}>
                    ${Number(cajaSummary?.totalIncome || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.txCountBadgeWrapper}>
                  <Badge
                    label={`${cajaSummary?.transactionsCount || 0} ${cajaSummary?.transactionsCount === 1 ? 'cobro' : 'cobros'}`}
                    variant={Number(cajaSummary?.transactionsCount || 0) > 0 ? 'success' : 'neutral'}
                    size="md"
                  />
                </View>
              </View>

              {/* DESGLOSE POR MÉTODO DE PAGO DE HOY */}
              <View style={[styles.cajaDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.cajaBreakdownTitle, { color: theme.textSecondary }]}>
                POR MEDIO DE PAGO
              </Text>

              <View style={styles.methodsGrid}>
                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle, minWidth: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%', flexBasis: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%' }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="payments" size={16} color="#16A34A" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Efectivo</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number(cajaSummary?.cashTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle, minWidth: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%', flexBasis: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%' }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="qr-code-scanner" size={16} color="#0284C7" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Transferencia / MP</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number(cajaSummary?.byMethod?.transfer || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle, minWidth: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%', flexBasis: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%' }]}>
                  <View style={styles.methodStatHeader}>
                    <MaterialIcons name="credit-card" size={16} color="#9333EA" />
                    <Text style={[styles.methodStatLabel, { color: theme.textSecondary }]}>Tarjetas Déb/Créd</Text>
                  </View>
                  <Text style={[styles.methodStatValue, { color: theme.text }]}>
                    ${Number((cajaSummary?.byMethod?.debit_card || 0) + (cajaSummary?.byMethod?.credit_card || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={[styles.methodStatCard, { backgroundColor: theme.surfaceSubtle, minWidth: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%', flexBasis: isSmallPhone ? '100%' : isDesktop ? '23%' : '47%' }]}>
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
                    Historial
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={viewFilter === 'today' ? 'Sin cobros hoy' : 'Sin cobros registrados'}
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
                  {item.service_name ? (
                    <Text style={[styles.serviceNameTag, { color: theme.primary }]}>
                      {item.service_name}
                    </Text>
                  ) : null}
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
        errorMessage={formError}
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar cobro"
              size="md"
              loading={isSubmitting}
              disabled={!selectedAppointmentObj || configuredPrice <= 0}
              onPress={() => handleSubmit(onCreatePayment)()}
            />
          </>
        }
      >
        {/* PASO 1: SELECCIÓN DEL PACIENTE */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            1. Paciente <Text style={{ color: theme.error }}>*</Text>
          </Text>

          <TouchableOpacity
            style={[
              styles.pickerTrigger,
              {
                backgroundColor: theme.surface,
                borderColor: formErrors.patient_id ? theme.error : theme.border
              }
            ]}
            onPress={() => {
              setShowPatientPicker(!showPatientPicker);
              setShowAppointmentPicker(false);
            }}
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
                          setValue('appointment_id', 0);
                          setSelectedAppointmentObj(null);
                          setShowPatientPicker(false);
                          setShowAppointmentPicker(false);
                          setPatientSearch('');
                          fetchPatientAppointments(p.id);
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

        {/* PASO 2: SELECCIÓN DE CONSULTA REALIZADA (TURNO ATENDIDO) */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            2. Consulta Realizada <Text style={{ color: theme.error }}>*</Text>
          </Text>

          {!selectedPatient ? (
            <View style={[styles.noticeCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <MaterialIcons name="info-outline" size={18} color={theme.textMuted} style={{ marginRight: spacing.xs }} />
              <Text style={[styles.noticeCardText, { color: theme.textSecondary }]}>
                Seleccioná primero al paciente.
              </Text>
            </View>
          ) : isLoadingAppointments ? (
            <View style={[styles.noticeCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: spacing.sm }} />
              <Text style={[styles.noticeCardText, { color: theme.textSecondary }]}>
                Cargando consultas...
              </Text>
            </View>
          ) : patientAppointments.length === 0 ? (
            <View style={[styles.warningCard, { backgroundColor: theme.warningBg || theme.surfaceSubtle, borderColor: theme.warning || '#F59E0B' }]}>
              <MaterialIcons name="event-busy" size={20} color={theme.warning || '#D97706'} style={{ marginRight: spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningTitle, { color: theme.text }]}>
                  Sin consultas pendientes de cobro
                </Text>
                <Text style={[styles.warningSub, { color: theme.textSecondary }]}>
                  Solo se pueden cobrar consultas marcadas como "Atendido".
                </Text>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.pickerTrigger,
                  {
                    backgroundColor: theme.surface,
                    borderColor: formErrors.appointment_id ? theme.error : theme.border
                  }
                ]}
                onPress={() => {
                  setShowAppointmentPicker(!showAppointmentPicker);
                  setShowPatientPicker(false);
                }}
                accessibilityRole="button"
              >
                <View style={styles.pickerTriggerContent}>
                  <MaterialIcons name="medical-services" size={20} color={theme.primary} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    {selectedAppointmentObj ? (
                      <View>
                        <Text style={[styles.pickerSelectedText, { color: theme.text }]}>
                          {selectedAppointmentObj.service_name}
                        </Text>
                        <Text style={[styles.pickerSelectedSub, { color: theme.textSecondary }]}>
                          {formatAppointmentDate(selectedAppointmentObj.start_time)} • Prof: {selectedAppointmentObj.kinesiologist_last_name ? `Lic. ${selectedAppointmentObj.kinesiologist_last_name}` : 'Sin asignar'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.pickerPlaceholder, { color: theme.textMuted }]}>
                        Seleccione una de las {patientAppointments.length} consultas realizadas...
                      </Text>
                    )}
                  </View>
                  <MaterialIcons
                    name={showAppointmentPicker ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={theme.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {formErrors.appointment_id && (
                <Text style={[styles.fieldError, { color: theme.error }]}>
                  {formErrors.appointment_id.message}
                </Text>
              )}

              {showAppointmentPicker && (
                <View style={[styles.dropdownContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {patientAppointments.map((app) => {
                      const isSelected = app.id === Number(selectedAppointmentId);
                      const price = Number(app.agreed_price || app.service_default_price || 0);

                      return (
                        <TouchableOpacity
                          key={app.id}
                          style={[
                            styles.appointmentRow,
                            { borderBottomColor: theme.border + '30' },
                            isSelected && { backgroundColor: theme.primaryLight + '35' }
                          ]}
                          onPress={() => {
                            setValue('appointment_id', app.id, { shouldValidate: true });
                            setSelectedAppointmentObj(app);
                            setShowAppointmentPicker(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.appRowHeader}>
                              <Text style={[styles.appRowService, { color: isSelected ? theme.primary : theme.text }]}>
                                {app.service_name}
                              </Text>
                              <Badge
                                label={`$${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                variant="default"
                                size="sm"
                              />
                            </View>
                            <Text style={[styles.appRowDate, { color: theme.textSecondary }]}>
                              {formatAppointmentDate(app.start_time)}
                            </Text>
                            <Text style={[styles.appRowProf, { color: theme.textMuted }]}>
                              Atendido por: {app.kinesiologist_last_name ? `Lic. ${app.kinesiologist_last_name}${app.kinesiologist_name ? `, ${app.kinesiologist_name}` : ''}` : 'Sin asignar'}
                            </Text>
                          </View>
                          {isSelected && (
                            <MaterialIcons name="check" size={20} color={theme.primary} style={{ marginLeft: spacing.sm }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>

        {/* PASO 3 Y 4: IDENTIFICACIÓN AUTOMÁTICA Y PRECIO FIJADO (NO EDITABLE) */}
        {selectedAppointmentObj && (
          <View style={[styles.priceBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <View style={styles.priceBoxHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.priceBoxSubtitle, { color: theme.textSecondary }]}>
                  PRESTACIÓN IDENTIFICADA
                </Text>
                <Text style={[styles.priceBoxServiceName, { color: theme.text }]}>
                  {selectedAppointmentObj.service_name}
                </Text>
              </View>
              <View style={[styles.priceLockBadge, { backgroundColor: theme.primaryLight + '25' }]}>
                <MaterialIcons name="lock" size={13} color={theme.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.priceLockBadgeText, { color: theme.primary }]}>Precio fijado</Text>
              </View>
            </View>

            <View style={[styles.priceDivider, { backgroundColor: theme.border }]} />

            <View style={styles.priceRow}>
              <Text style={[styles.priceTotalLabel, { color: theme.text }]}>
                Importe:
              </Text>
              <Text style={[styles.priceAmountValue, { color: theme.primary }]}>
                ${configuredPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* PASO 5: SELECCIÓN DEL MEDIO DE PAGO */}
        <View style={styles.methodContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            3. Medio de Pago <Text style={{ color: theme.error }}>*</Text>
          </Text>
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

        {/* PASO 6: COMPROBANTE Y NOTAS */}
        <View style={styles.fieldContainer}>
          <View style={styles.receiptHeaderRow}>
            <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 0 }]}>
              4. N° de Comprobante / Recibo <Text style={{ color: theme.error }}>*</Text>
            </Text>
            <TouchableOpacity onPress={generateReceiptNumber} style={styles.autoGenBtn}>
              <MaterialIcons name="autorenew" size={14} color={theme.primary} style={{ marginRight: 2 }} />
              <Text style={[styles.autoGenText, { color: theme.primary }]}>Generar N°</Text>
            </TouchableOpacity>
          </View>

          <Controller
            control={control}
            name="receipt_number"
            render={({ field: { onChange, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="REC-202611-1234"
                error={formErrors.receipt_number?.message}
                required
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Notas u Observaciones (Opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="Detalle administrativo, comprobante de transferencia..."
            />
          )}
        />
      </ModalWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerContainer: {
    padding: spacing.md
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  cajaAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm
  },
  cajaAmountLabel: {
    fontSize: typography.fontSize.xs,
    marginBottom: 2
  },
  cajaBigAmount: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.5
  },
  txCountBadgeWrapper: {
    paddingBottom: 4
  },
  cajaDivider: {
    height: 1,
    marginVertical: spacing.md
  },
  cajaBreakdownTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing.sm
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  methodStatCard: {
    flex: 1,
    minWidth: '45%',
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
    marginLeft: 4,
    fontWeight: typography.fontWeight.medium
  },
  methodStatValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  filterSection: {
    marginTop: spacing.xs
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
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
    fontSize: 10,
    fontWeight: typography.fontWeight.bold
  },
  sectionNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  sectionNoticeText: {
    fontSize: typography.fontSize.xs
  },
  columnWrapper: {
    gap: spacing.md
  },
  paymentCard: {
    flex: 1,
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
  serviceNameTag: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2
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
    fontSize: typography.fontSize.sm
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
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  noticeCardText: {
    fontSize: typography.fontSize.xs,
    flex: 1
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2
  },
  warningSub: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1
  },
  appRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  appRowService: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    marginRight: spacing.xs
  },
  appRowDate: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  appRowProf: {
    fontSize: 11,
    marginTop: 1
  },
  priceBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  priceBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  priceBoxSubtitle: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  priceBoxServiceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  priceLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full
  },
  priceLockBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold
  },
  priceDivider: {
    height: 1,
    marginVertical: spacing.sm
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceTotalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  priceAmountValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold
  },
  priceNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs + 2
  },
  priceNoticeText: {
    fontSize: 11,
    flex: 1
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2
  },
  autoGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  autoGenText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
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
