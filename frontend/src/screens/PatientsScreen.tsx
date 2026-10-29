import React, { useEffect, useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper, DateInput, InsuranceSelector } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

const patientSchema = z.object({
  dni: z.string().min(7, 'El DNI debe tener al menos 7 dígitos').max(20, 'Máximo 20 caracteres'),
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)'),
  phone: z.string().min(6, 'Ingrese un teléfono de contacto válido'),
  email: z.string().min(1, 'El correo electrónico es obligatorio').email('Ingrese un correo electrónico válido'),
  insurance_provider: z.string().default('Particular'),
  custom_insurance_provider: z.string().optional(),
  insurance_number: z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal(''))
});

const kinesiologistSchema = z
  .object({
    first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    dni: z.string().min(7, 'El DNI debe tener al menos 7 dígitos').max(20, 'Máximo 20 caracteres'),
    license_number: z.string().min(2, 'La matrícula profesional es obligatoria'),
    specialty: z.string().min(2, 'La especialidad es obligatoria'),
    phone: z.string().min(6, 'Ingrese un teléfono de contacto válido'),
    email: z.string().min(1, 'El correo electrónico es obligatorio').email('Ingrese un correo electrónico válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirm_password: z.string().min(1, 'Confirme la contraseña')
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password']
  });

type PatientFormData = z.infer<typeof patientSchema>;
type KinesiologistFormData = z.infer<typeof kinesiologistSchema>;
type PersonRoleType = 'paciente' | 'kinesiologo';

const SPECIALTY_SUGGESTIONS = [
  'Kinesiología Deportiva',
  'Rehabilitación Traumatológica',
  'Neurorehabilitación',
  'RPG / Postural',
  'Fisioterapia General'
];

export const PatientsScreen = () => {
  const { theme } = useAppTheme();
  const { isAdmin } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState<'todos' | PersonRoleType>('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal Alta de Persona (Paciente / Kinesiólogo)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoleToCreate, setSelectedRoleToCreate] = useState<PersonRoleType>('paciente');
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [createdPersonSuccess, setCreatedPersonSuccess] = useState<any | null>(null);

  // Modal Reserva de Turno desde Ficha de Paciente
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [targetPatient, setTargetPatient] = useState<any | null>(null);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [kinesiologistsList, setKinesiologistsList] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedKinesiologist, setSelectedKinesiologist] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bookingTime, setBookingTime] = useState<string>('10:00');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  // Formulario 1: Paciente
  const {
    control: patientControl,
    handleSubmit: handlePatientSubmit,
    reset: resetPatientForm,
    setValue: setPatientValue,
    watch: watchPatient,
    formState: { errors: patientErrors, isSubmitting: isPatientSubmitting }
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      dni: '',
      first_name: '',
      last_name: '',
      birth_date: '1990-01-01',
      phone: '',
      email: '',
      insurance_provider: 'Particular',
      custom_insurance_provider: '',
      insurance_number: '',
      password: ''
    }
  });

  // Formulario 2: Kinesiólogo
  const {
    control: kineControl,
    handleSubmit: handleKineSubmit,
    reset: resetKineForm,
    setValue: setKineValue,
    watch: watchKine,
    formState: { errors: kineErrors, isSubmitting: isKineSubmitting }
  } = useForm<KinesiologistFormData>({
    resolver: zodResolver(kinesiologistSchema) as any,
    defaultValues: {
      first_name: '',
      last_name: '',
      dni: '',
      license_number: '',
      specialty: 'Kinesiología Deportiva',
      phone: '',
      email: '',
      password: '',
      confirm_password: ''
    }
  });

  const watchedDni = watchPatient('dni');
  const watchedEmail = watchPatient('email');
  const watchedInsuranceProvider = watchPatient('insurance_provider');
  const watchedCustomInsurance = watchPatient('custom_insurance_provider');
  const watchedKineSpecialty = watchKine('specialty');

  const resetAllForms = () => {
    resetPatientForm();
    resetKineForm();
    setFormError(null);
    setDuplicateWarning(null);
    setCreatedPersonSuccess(null);
  };

  const fetchPeopleData = async (query = '') => {
    try {
      setError(null);
      const requests: Promise<any>[] = [
        apiClient.post('/patients/search', {
          search: query || undefined,
          page: 1,
          limit: 50
        })
      ];

      if (isAdmin) {
        requests.push(
          apiClient.post('/users/search', {
            search: query || undefined,
            page: 1,
            limit: 50
          })
        );
      }

      const [patientsRes, usersRes] = await Promise.all(requests);

      if (patientsRes?.data?.success) {
        setPatients(
          (patientsRes.data.data || []).map((p: any) => ({
            ...p,
            _personType: 'paciente' as PersonRoleType
          }))
        );
      }

      if (isAdmin && usersRes?.data?.success) {
        const staffOnly = (usersRes.data.data || [])
          .filter((u: any) => u.role_name === 'kinesiologist')
          .map((u: any) => ({
            ...u,
            first_name: u.name,
            _personType: 'kinesiologo' as PersonRoleType
          }));
        setStaffUsers(staffOnly);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al obtener registros');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBookingDependencies = async () => {
    try {
      const [servRes, userRes] = await Promise.all([
        apiClient.post('/services/search', { limit: 50 }),
        apiClient.post('/appointments/professionals', {})
      ]);
      if (servRes.data?.success) setServicesList(servRes.data.data);
      if (userRes.data?.success) setKinesiologistsList(userRes.data.data);
    } catch (e) {
      console.warn('Error loading booking dependencies', e);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPeopleData(searchTerm);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      fetchPeopleData(searchTerm);
      loadBookingDependencies();
    }, [searchTerm, isAdmin])
  );

  // Comprobar duplicados en tiempo real al registrar paciente
  useEffect(() => {
    if (selectedRoleToCreate !== 'paciente') {
      setDuplicateWarning(null);
      return;
    }
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
  }, [watchedDni, watchedEmail, selectedRoleToCreate]);

  const onCreatePatient = async (data: PatientFormData) => {
    setFormError(null);
    const selectedIns = data.insurance_provider || 'Particular';
    if (selectedIns === 'Otra' && (!data.custom_insurance_provider || !data.custom_insurance_provider.trim())) {
      setFormError('Por favor especifique el nombre de la obra social en la opción "Otra"');
      return;
    }
    const finalProvider = selectedIns === 'Otra' ? data.custom_insurance_provider?.trim() : selectedIns;
    const finalCoverage =
      finalProvider === 'Particular'
        ? 'Particular'
        : [finalProvider, data.insurance_number?.trim()].filter(Boolean).join(' - ');

    try {
      const payload: any = {
        firstName: data.first_name.trim(),
        lastName: data.last_name.trim(),
        dni: data.dni.trim(),
        birthDate: data.birth_date.trim(),
        phone: data.phone.trim(),
        email: data.email.trim().toLowerCase(),
        address: finalCoverage || 'Particular'
      };
      if (data.password && data.password.trim().length >= 8) {
        payload.password = data.password.trim();
      }
      const res = await apiClient.post('/patients', payload);
      if (res.data?.success) {
        const createdId = res.data.data?.id;
        const newPatient = {
          id: createdId,
          _personType: 'paciente',
          first_name: payload.firstName,
          last_name: payload.lastName,
          dni: payload.dni,
          phone: payload.phone,
          email: payload.email,
          user_id: res.data.data?.user_id || null
        };
        setCreatedPersonSuccess(newPatient);
        fetchPeopleData(searchTerm);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar paciente');
    }
  };

  const onCreateKinesiologist = async (data: KinesiologistFormData) => {
    setFormError(null);
    try {
      const payload = {
        roleId: 2,
        role: 'kinesiologist',
        name: data.first_name.trim(),
        lastName: data.last_name.trim(),
        dni: data.dni.trim(),
        licenseNumber: data.license_number.trim(),
        specialty: data.specialty.trim(),
        phone: data.phone.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password
      };
      const res = await apiClient.post('/users', payload);
      if (res.data?.success) {
        setCreatedPersonSuccess({
          id: res.data.data?.id,
          _personType: 'kinesiologo',
          first_name: payload.name,
          last_name: payload.lastName,
          dni: payload.dni,
          license_number: payload.licenseNumber,
          specialty: payload.specialty,
          email: payload.email
        });
        fetchPeopleData(searchTerm);
        loadBookingDependencies();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar kinesiólogo');
    }
  };

  const handlePrimaryModalSubmit = () => {
    if (selectedRoleToCreate === 'paciente') {
      handlePatientSubmit(onCreatePatient)();
    } else {
      handleKineSubmit(onCreateKinesiologist)();
    }
  };

  const isAnyFormSubmitting = isPatientSubmitting || isKineSubmitting;

  const fetchReceptionSlots = async (kineId: number, servId: number, dateStr: string) => {
    if (!kineId || !servId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    setLoadingSlots(true);
    setBookingError(null);
    try {
      const res = await apiClient.post('/appointments/available-slots', {
        kinesiologistId: Number(kineId),
        serviceId: Number(servId),
        date: dateStr
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        setAvailableSlots(list);
        if (list.length > 0) {
          setBookingTime(list[0].time || list[0].timeLabel || '10:00');
        } else {
          setBookingTime('');
        }
      }
    } catch {
      const fallback = Array.from({ length: 11 }, (_, i) => {
        const timeStr = `${String(8 + i).padStart(2, '0')}:00`;
        return { startTime: `${dateStr} ${timeStr}:00`, time: timeStr, timeLabel: timeStr, available: true };
      });
      setAvailableSlots(fallback);
      setBookingTime('10:00');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleOpenBookingModal = (patient: any) => {
    setBookingError(null);
    setBookingSuccess(null);
    setTargetPatient(patient);
    const serv = servicesList[0] || { id: 1, name: 'Rehabilitación Traumatológica', duration_minutes: 45, default_price: 12000 };
    const kine = kinesiologistsList[0] || { id: 2, name: 'Carlos', last_name: 'Kinesio' };
    setSelectedService(serv);
    setSelectedKinesiologist(kine);
    const d = new Date(Date.now() + 86400000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const tomorrow = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setBookingDate(tomorrow);
    setBookingTime('10:00');
    setBookingNotes('');
    setBookingModalVisible(true);
    if (kine && serv) {
      fetchReceptionSlots(kine.id, serv.id, tomorrow);
    }
  };

  const handleConfirmBookingFromReception = async () => {
    if (!targetPatient || !selectedService || !selectedKinesiologist || !bookingTime) {
      setBookingError('Seleccione servicio, profesional y un horario disponible para agendar');
      return;
    }
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const duration = selectedService.duration_minutes || 45;
      const startD = new Date(`${bookingDate}T${bookingTime}:00`);
      const endD = new Date(startD.getTime() + duration * 60000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const startTime = `${bookingDate} ${bookingTime}:00`;
      const endTime = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())} ${pad(endD.getHours())}:${pad(endD.getMinutes())}:00`;

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
        setBookingSuccess(
          `✓ Turno agendado exitosamente para ${targetPatient.last_name || targetPatient.lastName}, ${targetPatient.first_name || targetPatient.firstName}`
        );
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

  const displayedList = React.useMemo(() => {
    if (!isAdmin) return patients;
    const combined = [...staffUsers, ...patients];
    if (roleFilter === 'todos') return combined;
    return combined.filter((item) => item._personType === roleFilter);
  }, [isAdmin, patients, staffUsers, roleFilter]);

  if (loading && !refreshing) {
    return <LoadingState message={isAdmin ? 'Cargando padrón de personas...' : 'Cargando pacientes...'} />;
  }
  if (error) return <ErrorState message={error} onRetry={() => fetchPeopleData(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={isAdmin ? 'Padrón de Personas' : 'Padrón de Pacientes'}
        subtitle={
          isAdmin
            ? 'Gestión y registro integral de pacientes y kinesiólogos'
            : 'Fichas administrativas de pacientes, coberturas y gestión de turnos'
        }
        action={
          <Button
            title={isAdmin ? '+ Registrar persona' : '+ Registrar paciente'}
            size="sm"
            onPress={() => {
              resetAllForms();
              if (isAdmin && roleFilter !== 'todos') {
                setSelectedRoleToCreate(roleFilter);
              } else {
                setSelectedRoleToCreate('paciente');
              }
              setModalVisible(true);
            }}
          />
        }
      />

      {/* Filtros por Rol en Panel de Admin */}
      {isAdmin && (
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'todos', label: `Todos (${staffUsers.length + patients.length})`, icon: 'groups' },
              { key: 'paciente', label: `Pacientes (${patients.length})`, icon: 'person-outline' },
              {
                key: 'kinesiologo',
                label: `Kinesiólogos (${staffUsers.filter((u) => u._personType === 'kinesiologo').length})`,
                icon: 'medical-services'
              }
            ].map((tab) => {
              const active = roleFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderColor: active ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setRoleFilter(tab.key as any)}
                >
                  <MaterialIcons
                    name={tab.icon as any}
                    size={16}
                    color={active ? '#FFF' : theme.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: active ? '#FFF' : theme.text, fontWeight: '600', fontSize: typography.fontSize.xs }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Buscador en tiempo real */}
      <View style={styles.searchRow}>
        <Input
          placeholder={
            isAdmin
              ? 'Buscar por DNI, nombre, apellido, matrícula o correo...'
              : 'Buscar por DNI, nombre o apellido...'
          }
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
        data={displayedList}
        keyExtractor={(item) => `${item._personType || 'pat'}-${item.id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPeopleData(searchTerm);
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={isAdmin ? 'No se encontraron personas registradas' : 'No se encontraron pacientes'}
            subtitle="Intenta con otro término de búsqueda o da de alta un nuevo registro."
            action={{
              label: isAdmin ? 'Registrar persona' : 'Registrar paciente',
              onPress: () => {
                resetAllForms();
                setSelectedRoleToCreate('paciente');
                setModalVisible(true);
              }
            }}
          />
        }
        renderItem={({ item }) => {
          const personType: PersonRoleType = item._personType || 'paciente';
          const firstName = item.first_name || item.name || '';
          const lastName = item.last_name || '';
          const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

          if (personType === 'kinesiologo') {
            return (
              <Card elevated style={styles.patientCard} padding="md">
                <View style={styles.cardHeader}>
                  <View style={styles.nameSection}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: theme.infoBg || theme.primaryLight,
                          borderColor: (theme.info || theme.primary) + '40'
                        }
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: theme.info || theme.primary }]}>
                        {initials || 'K'}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={[styles.patientName, { color: theme.text }]}>
                        Lic. {lastName}, {firstName}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                        {item.dni ? `DNI ${item.dni} • ` : ''}
                        {item.license_number ? `Mat. ${item.license_number} • ` : ''}
                        Tel: {item.phone || 'S/D'}
                      </Text>
                    </View>
                  </View>

                  <Badge label="Kinesiólogo" variant="info" size="sm" />
                </View>

                <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
                <View style={styles.extraDetails}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subText, { color: theme.textMuted }]}>{item.email}</Text>
                    {item.specialty ? (
                      <Text style={[styles.subText, { color: theme.textSecondary, fontWeight: '600', marginTop: 2 }]}>
                        Especialidad: {item.specialty}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={item.is_active ? 'Cuenta activa' : 'Inactivo'} variant={item.is_active ? 'success' : 'neutral'} size="sm" />
                </View>
              </Card>
            );
          }

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

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {isAdmin && <Badge label="Paciente" variant="default" size="sm" />}
                  {item.insurance_provider || item.address ? (
                    <Badge label={item.insurance_provider || String(item.address).split(' - ')[0]} variant="neutral" size="sm" />
                  ) : (
                    <Badge label="Particular" variant="neutral" size="sm" />
                  )}
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
              <View style={styles.extraDetails}>
                <Text style={[styles.subText, { color: theme.textMuted }]}>
                  {item.email || 'Sin correo electrónico'}
                </Text>
                <View style={styles.accountBadgeRow}>
                  {item.user_id ? (
                    <Badge label="Cuenta vinculada" variant="success" size="sm" />
                  ) : (
                    <Badge label="Sin cuenta digital" variant="neutral" size="sm" />
                  )}
                </View>
              </View>

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

      {/* ============================================================ */}
      {/* MODAL: REGISTRAR PERSONA (PACIENTE / KINESIÓLOGO)            */}
      {/* ============================================================ */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={
          isAdmin
            ? selectedRoleToCreate === 'paciente'
              ? 'Registrar Persona — Paciente'
              : 'Registrar Persona — Kinesiólogo'
            : 'Registrar paciente'
        }
        subtitle={
          isAdmin
            ? 'Seleccione el rol a dar de alta y complete todos sus campos correspondientes.'
            : 'Ficha administrativa independiente. No genera contraseña ni obliga a crear cuenta.'
        }
        footer={
          createdPersonSuccess ? (
            <Button
              title="Cerrar"
              size="md"
              onPress={() => {
                setModalVisible(false);
                setCreatedPersonSuccess(null);
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
                title={selectedRoleToCreate === 'paciente' ? 'Guardar Paciente' : 'Guardar Kinesiólogo'}
                size="md"
                loading={isAnyFormSubmitting}
                onPress={handlePrimaryModalSubmit}
              />
            </>
          )
        }
      >
        {/* Selector de Tipo de Persona exclusivo para Administrador */}
        {isAdmin && !createdPersonSuccess && (
          <View style={styles.roleSelectorBox}>
            <Text style={[styles.inputLabel, { color: theme.text, marginTop: 0 }]}>Tipo de persona a registrar</Text>
            <View style={styles.roleTabsRow}>
              {[
                { key: 'paciente', label: 'Paciente', icon: 'person-outline' },
                { key: 'kinesiologo', label: 'Kinesiólogo', icon: 'medical-services' }
              ].map((r) => {
                const active = selectedRoleToCreate === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.roleTabButton,
                      {
                        backgroundColor: active ? theme.primary : theme.surfaceSubtle,
                        borderColor: active ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => {
                      setFormError(null);
                      setDuplicateWarning(null);
                      setSelectedRoleToCreate(r.key as PersonRoleType);
                    }}
                  >
                    <MaterialIcons
                      name={r.icon as any}
                      size={18}
                      color={active ? '#FFF' : theme.textSecondary}
                      style={{ marginBottom: 2 }}
                    />
                    <Text style={{ color: active ? '#FFF' : theme.text, fontWeight: '700', fontSize: typography.fontSize.xs }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {formError && (
          <View style={[styles.modalError, { backgroundColor: theme.errorBg, borderColor: theme.error + '40' }]}>
            <Text style={[styles.modalErrorText, { color: theme.error }]}>{formError}</Text>
          </View>
        )}

        {/* Advertencia de duplicado seguro */}
        {duplicateWarning && !createdPersonSuccess && selectedRoleToCreate === 'paciente' && (
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

        {/* Éxito tras creación */}
        {createdPersonSuccess ? (
          <View style={styles.successCreationBox}>
            <MaterialIcons name="check-circle" size={48} color={theme.success} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.successTitle, { color: theme.text }]}>
              {createdPersonSuccess._personType === 'paciente'
                ? '¡Paciente registrado exitosamente!'
                : '¡Kinesiólogo registrado exitosamente!'}
            </Text>
            <Text style={[styles.successDesc, { color: theme.textSecondary }]}>
              {createdPersonSuccess.last_name}, {createdPersonSuccess.first_name} (DNI {createdPersonSuccess.dni}) ya se encuentra activo en el sistema.
            </Text>

            {createdPersonSuccess._personType === 'paciente' && (
              <Button
                title="📅 Agendar Turno para este Paciente"
                size="lg"
                onPress={() => {
                  const pat = createdPersonSuccess;
                  setModalVisible(false);
                  setCreatedPersonSuccess(null);
                  handleOpenBookingModal(pat);
                }}
                style={{ marginTop: spacing.lg, width: '100%' }}
              />
            )}
          </View>
        ) : selectedRoleToCreate === 'paciente' ? (
          /* ========================================== */
          /* FORMULARIO 1: PACIENTE                     */
          /* ========================================== */
          <>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={patientControl}
                  name="first_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Nombre"
                      placeholder="Juan"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={patientErrors.first_name?.message}
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={patientControl}
                  name="last_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Apellido"
                      placeholder="Pérez"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={patientErrors.last_name?.message}
                      required
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={patientControl}
                  name="dni"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="DNI / Documento"
                      placeholder="12345678"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={patientErrors.dni?.message}
                      keyboardType="numeric"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={patientControl}
                  name="birth_date"
                  render={({ field: { onChange, value } }) => (
                    <DateInput
                      label="Fecha de nacimiento"
                      value={value}
                      onChangeDate={onChange}
                      error={patientErrors.birth_date?.message}
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
                  control={patientControl}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Teléfono"
                      placeholder="+54 9 11 1234-5678"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={patientErrors.phone?.message}
                      keyboardType="phone-pad"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={patientControl}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Correo electrónico"
                      placeholder="juan@example.com"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={patientErrors.email?.message}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      required
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={patientControl}
              name="insurance_provider"
              render={({ field: { onChange, value } }) => (
                <InsuranceSelector
                  label="Obra social / Cobertura"
                  value={value || 'Particular'}
                  onChange={onChange}
                  customValue={watchedCustomInsurance || ''}
                  onChangeCustom={(val) => setPatientValue('custom_insurance_provider', val)}
                  error={patientErrors.insurance_provider?.message}
                  required
                />
              )}
            />

            {watchedInsuranceProvider && watchedInsuranceProvider !== 'Particular' && (
              <Controller
                control={patientControl}
                name="insurance_number"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="N° de afiliado / Credencial (opcional)"
                    placeholder="Ej: 1234567801"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={patientErrors.insurance_number?.message}
                  />
                )}
              />
            )}

            {isAdmin && (
              <Controller
                control={patientControl}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Contraseña de acceso al portal (opcional)"
                    placeholder="Dejar en blanco si el paciente creará su cuenta luego"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={patientErrors.password?.message}
                    isPassword
                  />
                )}
              />
            )}
          </>
        ) : (
          /* ========================================== */
          /* FORMULARIO 2: KINESIÓLOGO                  */
          /* ========================================== */
          <>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="first_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Nombre"
                      placeholder="Carlos"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.first_name?.message}
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="last_name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Apellido"
                      placeholder="Gómez"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.last_name?.message}
                      required
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="dni"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="DNI / Documento"
                      placeholder="30123456"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.dni?.message}
                      keyboardType="numeric"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="license_number"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Matrícula Profesional"
                      placeholder="Ej: MN 14582 / MP 4310"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.license_number?.message}
                      required
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={kineControl}
              name="specialty"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Especialidad Clínica"
                  placeholder="Ej: Kinesiología Deportiva"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={kineErrors.specialty?.message}
                  required
                />
              )}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md, marginTop: -4 }}>
              {SPECIALTY_SUGGESTIONS.map((spec) => {
                const active = watchedKineSpecialty === spec;
                return (
                  <TouchableOpacity
                    key={spec}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: active ? theme.primaryLight : theme.surfaceSubtle,
                        borderColor: active ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => setKineValue('specialty', spec, { shouldValidate: true })}
                  >
                    <Text style={{ color: active ? theme.primary : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {spec}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Teléfono Profesional"
                      placeholder="+54 9 11 2233-4455"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.phone?.message}
                      keyboardType="phone-pad"
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Correo electrónico (Usuario)"
                      placeholder="profesional@kinesiologia.com"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.email?.message}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      required
                    />
                  )}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Contraseña de acceso"
                      placeholder="Mínimo 8 caracteres"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.password?.message}
                      isPassword
                      required
                    />
                  )}
                />
              </View>
              <View style={styles.formCol}>
                <Controller
                  control={kineControl}
                  name="confirm_password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Confirmar contraseña"
                      placeholder="Reescriba la contraseña"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={kineErrors.confirm_password?.message}
                      isPassword
                      required
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
              onPress={() => {
                setSelectedService(s);
                if (selectedKinesiologist) {
                  fetchReceptionSlots(selectedKinesiologist.id, s.id, bookingDate);
                }
              }}
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
              onPress={() => {
                setSelectedKinesiologist(k);
                if (selectedService) {
                  fetchReceptionSlots(k.id, selectedService.id, bookingDate);
                }
              }}
            >
              <Text style={{ color: selectedKinesiologist?.id === k.id ? '#FFF' : theme.text, fontWeight: '600' }}>
                Lic. {k.last_name}, {k.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <DateInput
          label="3. Fecha del turno"
          value={bookingDate}
          onChangeDate={(val) => {
            setBookingDate(val);
            if (val && selectedKinesiologist && selectedService) {
              fetchReceptionSlots(selectedKinesiologist.id, selectedService.id, val);
            }
          }}
          min={new Date().toISOString().slice(0, 10)}
        />

        <Text style={[styles.inputLabel, { color: theme.text }]}>4. Horario Disponible</Text>
        {loadingSlots ? (
          <Text style={[styles.subText, { color: theme.textMuted, marginBottom: spacing.md }]}>
            Calculando disponibilidad en tiempo real...
          </Text>
        ) : availableSlots.length === 0 ? (
          <Text style={[styles.subText, { color: theme.warning, marginBottom: spacing.md }]}>
            No hay horarios disponibles para esta fecha con el profesional seleccionado.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
            {availableSlots.map((slot, idx) => {
              const slotTime = slot.time || slot.timeLabel;
              const isSelected = bookingTime === slotTime;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.surfaceSubtle,
                      borderColor: isSelected ? theme.primary : theme.border,
                      marginRight: 0,
                      marginBottom: 4
                    }
                  ]}
                  onPress={() => setBookingTime(slotTime)}
                >
                  <Text style={{ color: isSelected ? '#FFF' : theme.text, fontWeight: '600' }}>
                    {slotTime} hs
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Resumen con profesional, servicio, fecha, hora y precio validado */}
        {selectedService && selectedKinesiologist && bookingTime ? (
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
        ) : null}

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
  filterRow: {
    marginBottom: spacing.sm
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs
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
  roleSelectorBox: {
    marginBottom: spacing.md
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  roleTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1
  },
  suggestionChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs
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
