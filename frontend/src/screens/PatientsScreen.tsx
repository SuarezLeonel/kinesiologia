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
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, Input, ScreenHeader, ModalWrapper } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/FeedbackStates';

const patientSchema = z.object({
  dni: z.string().min(7, 'El DNI debe tener al menos 7 dígitos').max(10, 'Máximo 10 caracteres'),
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
  const [modalVisible, setModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
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

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearch = () => {
    setLoading(true);
    fetchPatients(searchTerm);
  };

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
        setModalVisible(false);
        reset();
        fetchPatients(searchTerm);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Error al registrar paciente');
    }
  };

  if (loading && !refreshing) return <LoadingState message="Cargando pacientes..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchPatients(searchTerm)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Padrón de Pacientes"
        subtitle="Registro clínico, datos de contacto y cobertura médica"
        action={
          <Button
            title="+ Nuevo Paciente"
            size="sm"
            onPress={() => {
              setFormError(null);
              reset();
              setModalVisible(true);
            }}
          />
        }
      />

      {/* Buscador */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Input
            placeholder="Buscar por DNI, nombre o apellido..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Buscar"
          variant="secondary"
          size="md"
          onPress={handleSearch}
          style={{ marginLeft: spacing.sm }}
        />
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id.toString()}
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
              onPress: () => setModalVisible(true)
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
                  <Badge
                    label={item.insurance_provider}
                    variant="neutral"
                    size="sm"
                  />
                ) : (
                  <Badge label="Particular" variant="neutral" size="sm" />
                )}
              </View>

              {(item.email || item.insurance_number || item.kinesiologist_name) && (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
                  <View style={styles.extraDetails}>
                    {item.email ? (
                      <Text style={[styles.subText, { color: theme.textMuted }]}>
                        {item.email}
                      </Text>
                    ) : null}
                    {item.insurance_number ? (
                      <Text style={[styles.subText, { color: theme.textMuted }]}>
                        Afiliado: {item.insurance_number}
                      </Text>
                    ) : null}
                    {item.kinesiologist_name ? (
                      <Text style={[styles.kineText, { color: theme.primary }]}>
                        Kinesiólogo: {item.kinesiologist_name} {item.kinesiologist_last_name || ''}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
            </Card>
          );
        }}
      />

      {/* Modal de Alta de Paciente */}
      <ModalWrapper
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Registrar Nuevo Paciente"
        subtitle="Complete los datos filiatorios y de cobertura de salud"
        footer={
          <>
            <Button
              title="Cancelar"
              variant="secondary"
              size="md"
              onPress={() => setModalVisible(false)}
            />
            <Button
              title="Guardar Paciente"
              size="md"
              loading={isSubmitting}
              onPress={() => handleSubmit(onCreatePatient)()}
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
          name="dni"
          render={({ field: { onChange, value } }) => (
            <Input
              label="DNI / Documento"
              value={value}
              onChangeText={onChange}
              keyboardType="numeric"
              placeholder="38450123"
              error={formErrors.dni?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="first_name"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Nombre"
              value={value}
              onChangeText={onChange}
              placeholder="Martín"
              error={formErrors.first_name?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="last_name"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Apellido"
              value={value}
              onChangeText={onChange}
              placeholder="Gómez"
              error={formErrors.last_name?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="birth_date"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Fecha de Nacimiento (AAAA-MM-DD)"
              value={value}
              onChangeText={onChange}
              placeholder="1990-05-15"
              error={formErrors.birth_date?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Teléfono de contacto"
              value={value}
              onChangeText={onChange}
              placeholder="+5491122334455"
              error={formErrors.phone?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Correo electrónico (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="paciente@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={formErrors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="insurance_provider"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Obra Social / Prepaga (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="OSDE / Swiss Medical / Particular"
            />
          )}
        />

        <Controller
          control={control}
          name="insurance_number"
          render={({ field: { onChange, value } }) => (
            <Input
              label="N° de Afiliado (opcional)"
              value={value || ''}
              onChangeText={onChange}
              placeholder="12345678-01"
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  searchInputContainer: {
    flex: 1
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
    flex: 1,
    paddingRight: spacing.sm
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  infoCol: {
    flex: 1
  },
  patientName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm
  },
  extraDetails: {
    gap: 2
  },
  subText: {
    fontSize: typography.fontSize.xs
  },
  kineText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2
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
  }
});
