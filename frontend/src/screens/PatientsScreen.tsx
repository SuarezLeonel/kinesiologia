import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
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
    resolver: zodResolver(patientSchema),
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
        ...data,
        email: data.email || null,
        insurance_provider: data.insurance_provider || null,
        insurance_number: data.insurance_number || null
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
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Buscar por nombre, apellido o DNI..."
            placeholderTextColor={theme.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.primary }]} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: theme.success }]}
          onPress={() => {
            setFormError(null);
            reset();
            setModalVisible(true);
          }}
        >
          <Text style={styles.createBtnText}>+ Nuevo Paciente</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPatients(searchTerm); }} />}
        ListEmptyComponent={<EmptyState title="No se encontraron pacientes" subtitle="Prueba con otro criterio de búsqueda" />}
        renderItem={({ item }) => (
          <View style={[styles.patientCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.patientName, { color: theme.text }]}>{item.last_name}, {item.first_name}</Text>
            <Text style={[styles.patientDetail, { color: theme.textSecondary }]}>
              DNI: {item.dni} | Tel: {item.phone}
            </Text>
            {item.insurance_provider && (
              <Text style={[styles.insuranceDetail, { color: theme.textSecondary }]}>
                Obra Social: {item.insurance_provider} ({item.insurance_number || 'S/N'})
              </Text>
            )}
            {item.kinesiologist_name && (
              <Text style={[styles.kineTag, { color: theme.primary }]}>
                Kinesiólogo asignado: {item.kinesiologist_name} {item.kinesiologist_last_name}
              </Text>
            )}
          </View>
        )}
      />

      {/* Modal de Alta de Paciente */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Registrar Paciente</Text>

            {formError && (
              <View style={[styles.errorBanner, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
                <Text style={[styles.errorBannerText, { color: theme.error }]}>{formError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>DNI / Documento</Text>
              <Controller
                control={control}
                name="dni"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.dni ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    placeholder="Ej. 38450123"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.dni && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.dni.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Nombre</Text>
              <Controller
                control={control}
                name="first_name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.first_name ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ej. Martín"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.first_name && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.first_name.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Apellido</Text>
              <Controller
                control={control}
                name="last_name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.last_name ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ej. Gómez"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.last_name && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.last_name.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Fecha de Nacimiento (AAAA-MM-DD)</Text>
              <Controller
                control={control}
                name="birth_date"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.birth_date ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="1990-05-15"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.birth_date && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.birth_date.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Teléfono</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.phone ? theme.error : theme.border, color: theme.text }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder="+5491122334455"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />
              {formErrors.phone && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.phone.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Correo Electrónico (Opcional)</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: formErrors.email ? theme.error : theme.border, color: theme.text }]}
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="paciente@correo.com"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                )}
              />
              {formErrors.email && <Text style={[styles.fieldError, { color: theme.error }]}>{formErrors.email.message}</Text>}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Obra Social / Prepaga (Opcional)</Text>
              <Controller
                control={control}
                name="insurance_provider"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Ej. OSDE / Swiss Medical / Particular"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}
              />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>N° de Afiliado (Opcional)</Text>
              <Controller
                control={control}
                name="insurance_number"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder="Ej. 12345678-01"
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
                  onPress={() => handleSubmit(onCreatePatient)()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createBtnText}>Guardar Paciente</Text>
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
  topBar: { marginBottom: 16 },
  searchContainer: { flexDirection: 'row', marginBottom: 8 },
  searchInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  searchBtn: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  searchBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  createBtn: { height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  createBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  patientCard: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  patientName: { fontSize: 16, fontWeight: 'bold' },
  patientDetail: { fontSize: 13, marginTop: 4 },
  insuranceDetail: { fontSize: 12, marginTop: 2 },
  kineTag: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { maxHeight: '90%', borderRadius: 14, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  fieldError: { fontSize: 11, marginTop: 2 },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  errorBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  errorBannerText: { fontSize: 12, fontWeight: '500' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  cancelBtnText: { fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
});
