import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const SettingsScreen = () => {
  const { theme, mode, setMode } = useAppTheme();
  const { user, logout } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Configuración y Tema</Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Apariencia de la Aplicación</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Selecciona tu modo preferido o permite que se adapte al sistema operativo.
        </Text>

        <View style={styles.themeOptions}>
          {(['system', 'light', 'dark'] as const).map((m) => {
            const isSelected = mode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.optionButton,
                  { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primaryLight : 'transparent' }
                ]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.optionText, { color: isSelected ? theme.primary : theme.text }]}>
                  {m === 'system' ? 'Sistema' : m === 'light' ? 'Claro' : 'Oscuro'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Sesión Actual</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Usuario: {user?.email} ({user?.role})
        </Text>
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.error }]} onPress={logout}>
          <Text style={styles.logoutBtnText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  themeOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  optionButton: { flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 8, marginHorizontal: 4, alignItems: 'center' },
  optionText: { fontSize: 14, fontWeight: '600' },
  logoutBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  logoutBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }
});
