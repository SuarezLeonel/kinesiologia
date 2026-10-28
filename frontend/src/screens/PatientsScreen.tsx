import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

const patientSchema = z.object({
  dni: z.string().min(7, 'El DNI debe tener al menos 7 dígitos').max(20, 'Máximo 20 caracteres'),
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)'),
  phone: z.string().min(6, 'Ingrese un teléfono de contacto válido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  insurance_provider: z.string().optional(),
  insurance_number: z.string().optional()
});

type PatientFormData = z.infer<typeof patientSchema>;

export const PatientsScreen = () => {
  const { theme } = useAppTheme();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal Alta de Paciente
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [createdPatientSuccess, setCreatedPatientSuccess] = useState<any | null>(null);

  // Modal Reserva de Turno desde Recepción
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [targetPatient, setTargetPatient] = useState<any | null>(null);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [kinesiologistsList, setKinesiologistsList] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedKinesiologist, setSelectedKinesiologist] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bookingTime, setBookingTime] = useState<string>('10:00');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors: formErrors, isSubmitting }
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      dni: '',
      first_name: '',
      last_name: '',
      birth_date: '1990-01-01',
      phone: '',
      email: '',
      insurance_provider: '',
      insurance_number: ''
    }
  });

  const watchedDni = watch('dni');
  const watchedEmail = watch('email');

  const fetchPatients = async (query = '') => {
    try {
      setError(null);
      // REGLA HTTP ESTRICTA: POST /patients/search
      const response = await apiClient.post('/patients/search', {
        search: query || undefined,
        page: 1,
        limit: 50
      });
      if (response.data?.success) {
        setPatients(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener pacientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBookingDependencies = async () => {
    try {
      const [servRes, userRes] = await Promise.all([
        apiClient.post('/services/search', { limit: 50 }),
        apiClient.post('/users/search', { roleId: 2, limit: 50 })
      ]);
      if (servRes.data?.success) setServicesList(servRes.data.data);
      if (userRes.data?.success) setKinesiologistsList(userRes.data.data);
    } catch (e) {
      console.warn('Error loading booking dependencies', e);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    loadBookingDependencies();
  }, []);

  // Comprobar duplicados en tiempo real
  useEffect(() => {
    const checkDup = async () => {
      if ((watchedDni && watchedDni.length >= 7) || (watchedEmail && watchedEmail.includes('@'))) {
        try {
          const res = await apiClient.post('/patients/check-duplicate', {
            dni: watchedDni.length >= 7 ? watchedDni : undefined,
            email: watchedEmail && watchedEmail.includes('@') ? watchedEmail : undefined
          });
          if (res.data?.success && res.data.data?.isDuplicate) {
            setDuplicateWarning(res.data.data);
          } else {
            setDuplicateWarning(null);
          }
        } catch {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    };
    const t = setTimeout(checkDup, 400);
    return () => clearTimeout(t);
  }, [watchedDni, watchedEmail]);

  const onCreatePatient = async (data: PatientFormData) => {
    setFormError(null);
    try {
      const payload = {
        firstName: data.first_name.trim(),
        lastName: data.last_name.trim(),
        dni: data.dni.trim(),
        birthDate: data.birth_date.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || undefined,
        address: [data.insurance_provider, data.insurance_number].filter(Boolean).join(' - ') || undefined
      };
      const res = await apiClient.post('/patients', payload);
      if (res.data?.success) {
        const createdId = res.data.data?.id;
        const newPatient = {
          id: createdId,
          first_name: payload.firstName,
          last_name: payload.lastName,
          dni: payload.dni,
          phone: payload.phone
        };
        setCreatedPatientSuccess(newPatient);
        fetchPatients(searchTerm);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar paciente');
    }
  };

  const handleOpenBookingModal = (patient: any) => {
    setBookingError(null);
    setBookingSuccess(null);
    setTargetPatient(patient);
    setSelectedService(servicesList[0] || null);
    setSelectedKinesiologist(kinesiologistsList[0] || null);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    setBookingDate(tomorrow);
    setBookingTime('10:00');
    setBookingNotes('');
    setBookingModalVisible(true);
  };

  const handleConfirmBookingFromReception = async () => {
    if (!targetPatient || !selectedService || !selectedKinesiologist) {
      setBookingError('Complete todos los campos obligatorios para agendar');
      return;
    }
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const duration = selectedService.duration_minutes || 45;
      const startD = new Date(`${bookingDate}T${bookingTime}:00`);
      const endD = new Date(startD.getTime() + duration * 60000);
      const startTime = `${bookingDate} ${bookingTime}:00`;
      const endTime = endD.toISOString().slice(0, 19).replace('T', ' ');

      const res = await apiClient.post('/appointments', {
        patientId: targetPatient.id,
        kinesiologistId: selectedKinesiologist.id,
        serviceId: selectedService.id,
        startTime,
        endTime,
        notes: bookingNotes.trim() || undefined,
        agreedPrice: Number(selectedService.default_price)
      });

      if (res.data?.success) {
        setBookingSuccess(`✓ Turno agendado exitosamente para ${targetPatient.last_name || targetPatient.lastName}, ${targetPatient.first_name || targetPatient.firstName}`);
        setTimeout(() => {
          setBookingModalVisible(false);
        }, 1300);
      }
    } catch (err: any) {
      setBookingError(err.response?.data?.error?.message || 'Conflicto al agendar turno');
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando pacientes..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchPatients(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Padrón de Pacientes"
        subtitle="Fichas administrativas de pacientes, coberturas y gestión de turnos"
        action={
          <Button
            title="+ Registrar paciente"
            size="sm"
            onPress={() => {
              setFormError(null);
              setDuplicateWarning(null);
              setCreatedPatientSuccess(null);
              reset();
              setModalVisible(true);
            }}
          />
        }
      />

      {/* Buscador en tiempo real */}
      <View style={styles.searchRow}>
        <Input
          placeholder="Buscar por DNI, nombre o apellido..."
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

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPatients(searchTerm);
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No se encontraron pacientes"
            subtitle="Intenta con otro término o da de alta un nuevo registro."
            action={{
              label: 'Registrar paciente',
              onPress: () => {
                setFormError(null);
                setDuplicateWarning(null);
                setCreatedPatientSuccess(null);
                reset();
                setModalVisible(true);
              }
            }}
          />
        }
        renderItem={({ item }) => {
          const initials = `${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase();

          return (
            <Card elevated style={styles.patientCard} padding="md">
              <View style={styles.cardHeader}>
                <View style={styles.nameSection}>
                  <View style={[styles.avatar, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>{initials || 'P'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {item.last_name}, {item.first_name}
                    </Text>
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      DNI {item.dni} • Tel: {item.phone}
                    </Text>
                  </View>
                </View>

                {item.insurance_provider ? (
                  <Badge label={item.insurance_provider} variant="neutral" size="sm" />
                ) : (
                  <Badge label="Particular" variant="neutral" size="sm" />
                )}
              </View>

              {(item.email || item.insurance_number || item.user_id) && (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
                  <View style={styles.extraDetails}>
                    {item.email ? (
                      <Text style={[styles.subText, { color: theme.textMuted }]}>
                        {item.email}
                      </Text>
                    ) : null}
                    <View style={styles.accountBadgeRow}>
                      {item.user_id ? (
                        <Badge label="Cuenta vinculada" variant="success" size="sm" />
                      ) : (
                        <Badge label="Sin cuenta digital" variant="neutral" size="sm" />
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* Botón Acción para Agendar Turno directamente desde la ficha */}
              <View style={[styles.cardActionRow, { borderTopColor: theme.borderSubtle }]}>
                <Button
                  title="📅 Registrar turno"
                  variant="outline"
                  size="sm"
                  onPress={() => handleOpenBookingModal(item)}
                />
              </View>
            </Card>
          );
        }}
      />

      {/* ========================================== */}
      {/* MODAL: REGISTRAR PACIENTE (SECRETARIO) */}
      {/* ========================================== */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Registrar paciente"
        subtitle="Ficha administrativa independiente. No genera contraseña ni obliga a crear cuenta."
        footer={
          createdPatientSuccess ? (
            <Button
              title="Cerrar"
              size="md"
              onPress={() => {
                setModalVisible(false);
                setCreatedPatientSuccess(null);
              }}
            />
          ) : (
            <>
              <Button
                title="Cancelar"
                variant="secondary"
                size="md"
                onPress={() => setModalVisible(false)}
              />
              <Button
                title="Guardar Ficha"
                size="md"
                loading={isSubmitting}
                onPress={() => handleSubmit(onCreatePatient)()}
              />
            </>
          )
        }
      >
        {formError && (
          <View style={[styles.modalError, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        {/* Advertencia de duplicado seguro */}
        {duplicateWarning && !createdPatientSuccess && (
          <View style={[styles.warningBox, { backgroundColor: theme.warningBg || '#FEF3C7', borderColor: theme.warning }]}>
            <MaterialIcons name="warning" size={20} color={theme.warning} style={{ marginRight: spacing.xs }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warningTitle, { color: theme.warning }]}>Posible Ficha Existente</Text>
              <Text style={[styles.warningText, { color: theme.text }]}>
                {duplicateWarning.message} ({duplicateWarning.existingPatient?.last_name}, {duplicateWarning.existingPatient?.first_name}).
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setSearchTerm(duplicateWarning.existingPatient?.dni || '');
                }}
                style={{ marginTop: 4 }}
              >
                <Text style={[styles.warningLink, { color: theme.primary }]}>Ver ficha existente en el padrón</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Éxito tras creación de ficha */}
        {createdPatientSuccess ? (
          <View style={styles.successCreationBox}>
            <MaterialIcons name="check-circle" size={48} color={theme.success} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.successTitle, { color: theme.text }]}>
              ¡Ficha creada exitosamente!
            </Text>
            <Text style={[styles.successDesc, { color: theme.textSecondary }]}>
              {createdPatientSuccess.last_name}, {createdPatientSuccess.first_name} (DNI {createdPatientSuccess.dni}) fue registrado administrativamente sin contraseña obligatoria.
            </Text>

            <Button
              title="📅 Agendar Turno para este Paciente"
              size="lg"
              onPress={() => {
                const pat = createdPatientSuccess;
                setModalVisible(false);
                setCreatedPatientSuccess(null);
                handleOpenBookingModal(pat);
              }}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />
          </View>
        ) : (
          <>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="first_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Nombre"
                      placeholder="Juan"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.first_name?.message}
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="last_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Apellido"
                      placeholder="Pérez"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.last_name?.message}
                      required
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="dni"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="DNI / Documento"
                      placeholder="12345678"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.dni?.message}
                      keyboardType="numeric"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="birth_date"
                  render={({ field: { onChange, value } }) => (
                    <DateInput
                      label="Fecha de nacimiento"
                      value={value}
                      onChangeDate={onChange}
                      error={formErrors.birth_date?.message}
                      max={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Teléfono"
                      placeholder="+54 9 11 1234-5678"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.phone?.message}
                      keyboardType="phone-pad"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Correo electrónico (opcional)"
                      placeholder="juan@example.com"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.email?.message}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="insurance_provider"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Obra social / Cobertura"
                      placeholder="Ej: OSDE, Swiss Medical"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.insurance_provider?.message}
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={control}
                  name="insurance_number"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="N° de afiliado"
                      placeholder="Ej: 1234567801"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={formErrors.insurance_number?.message}
                    />
                  )}
                />
              </View>
            </View>
          </>
        )}
      </ModalWrapper>

      {/* ========================================== */}
      {/* MODAL: REGISTRAR TURNO DESDE FICHA */}
      {/* ========================================== */}
      <ModalWrapper
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        title="Registrar turno"
        subtitle={`Para el paciente: ${targetPatient?.last_name || targetPatient?.lastName || ''}, ${targetPatient?.first_name || targetPatient?.firstName || ''} (DNI ${targetPatient?.dni || ''})`}
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setBookingModalVisible(false)}
            />
            <Button
              title="Confirmar Reserva"
              size="md"
              loading={bookingSubmitting}
              onPress={handleConfirmBookingFromReception}
            />
          </>
        }
      >
        {bookingError && (
          <View style={[styles.modalError, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{bookingError}</Text>
          </View>
        )}

        {bookingSuccess && (
          <View style={[styles.modalSuccess, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
            <Text style={[styles.modalSuccessText, { color: theme.success }]}>{bookingSuccess}</Text>
          </View>
        )}

        <Text style={[styles.inputLabel, { color: theme.text }]}>1. Prestación / Servicio</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {servicesList.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedService?.id === s.id ? theme.primary : theme.surfaceSubtle,
                  borderColor: selectedService?.id === s.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => setSelectedService(s)}
            >
              <Text style={{ color: selectedService?.id === s.id ? '#FFF' : theme.text, fontWeight: '600' }}>
                {s.name} (${Number(s.default_price).toLocaleString('es-AR')})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.inputLabel, { color: theme.text }]}>2. Profesional Kinesiólogo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {kinesiologistsList.map((k) => (
            <TouchableOpacity
              key={k.id}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedKinesiologist?.id === k.id ? theme.primary : theme.surfaceSubtle,
                  borderColor: selectedKinesiologist?.id === k.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => setSelectedKinesiologist(k)}
            >
              <Text style={{ color: selectedKinesiologist?.id === k.id ? '#FFF' : theme.text, fontWeight: '600' }}>
                Lic. {k.last_name}, {k.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <DateInput
              label="Fecha del turno"
              value={bookingDate}
              onChangeDate={setBookingDate}
              min={new Date().toISOString().slice(0, 10)}
            />
          </View>
          <View style={styles.formCol}>
            <Input
              label="Horario (HH:MM)"
              value={bookingTime}
              onChangeText={setBookingTime}
              placeholder="10:00"
            />
          </View>
        </View>

        {/* Resumen con profesional, servicio, fecha, hora y precio validado */}
        {selectedService && selectedKinesiologist && (
          <View style={[styles.summaryCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.summaryCardTitle, { color: theme.primary }]}>Resumen del Turno</Text>
            <Text style={[styles.summaryItemText, { color: theme.text }]}>
              • Profesional: Lic. {selectedKinesiologist.last_name}, {selectedKinesiologist.name}
            </Text>
            <Text style={[styles.summaryItemText, { color: theme.text }]}>
              • Prestación: {selectedService.name} ({selectedService.duration_minutes} min)
            </Text>
            <Text style={[styles.summaryItemText, { color: theme.text }]}>
              • Fecha y Hora: {bookingDate} a las {bookingTime} hs
            </Text>
            <Text style={[styles.summaryItemPrice, { color: theme.text }]}>
              Precio acordado registrado: ${Number(selectedService.default_price).toLocaleString('es-AR')} ARS
            </Text>
          </View>
        )}

        <Input
          label="Observaciones administrativas"
          value={bookingNotes}
          onChangeText={setBookingNotes}
          placeholder="Ej: Turno agendado en recepción presencialmente"
          containerStyle={{ marginTop: spacing.md }}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  listContent: {
    paddingBottom: spacing.xxl
  },
  patientCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  avatarText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  infoCol: {
    flex: 1
  },
  patientName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  },
  extraDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subText: {
    fontSize: typography.fontSize.xs
  },
  accountBadgeRow: {
    flexDirection: 'row',
    gap: 4
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  formCol: {
    flex: 1
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
  modalSuccess: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  modalSuccessText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  warningTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    lineHeight: 16
  },
  warningLink: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textDecorationLine: 'underline'
  },
  successCreationBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg
  },
  successTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  successDesc: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18
  },
  inputLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    marginTop: spacing.xs
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.sm
  },
  summaryCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    gap: 4
  },
  summaryCardTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  summaryItemText: {
    fontSize: typography.fontSize.xs
  },
  summaryItemPrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: 4
  }
});
