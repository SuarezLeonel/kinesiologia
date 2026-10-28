import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { Card, Badge, Button, ScreenHeader } from '../components/ui';

export const SettingsScreen = () => {
  const { theme, mode, setMode } = useAppTheme();
  const { user, logout } = useAuth();

  const themeOptions: { key: 'system' | 'light' | 'dark'; label: string; desc: string }[] = [
    { key: 'system', label: 'Sistema', desc: 'Sigue la configuración del dispositivo' },
    { key: 'light', label: 'Claro', desc: 'Superficies cálidas y legibles' },
    { key: 'dark', label: 'Oscuro', desc: 'Fondo descansado para baja iluminación' }
  ];

  const roleName = user?.role || user?.role_name || 'usuario';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Configuración"
        subtitle="Preferencias de apariencia, perfil y seguridad de la sesión"
      />

      {/* Selector de Apariencia */}
      <Card elevated style={styles.card} padding="lg">
        <Text style={[styles.cardTitle, { color: theme.text }]}>Apariencia de la Interfaz</Text>
        <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
          Seleccione su esquema de colores preferido. La preferencia se sincroniza de forma inmediata.
        </Text>

        <View style={styles.segmentContainer}>
          {themeOptions.map((opt) => {
            const isSelected = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                onPress={() => setMode(opt.key)}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: isSelected ? theme.primaryLight : theme.surfaceSubtle,
                    borderColor: isSelected ? theme.primary : theme.border
                  }
                ]}
              >
                <Text
                  style={[
                    styles.segmentTitle,
                    {
                      color: isSelected ? theme.primary : theme.text,
                      fontWeight: isSelected ? typography.fontWeight.bold : typography.fontWeight.medium
                    }
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={[styles.segmentDesc, { color: theme.textSecondary }]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Sesión Actual */}
      <Card elevated style={styles.card} padding="lg">
        <Text style={[styles.cardTitle, { color: theme.text }]}>Sesión Profesional</Text>
        <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
          Credenciales activas para el consultorio
        </Text>

        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user?.name} {user?.lastName || user?.last_name || ''}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
              {user?.email}
            </Text>
            <View style={{ marginTop: spacing.xs }}>
              <Badge
                label={`ROL: ${roleName.toUpperCase()}`}
                variant="default"
                size="sm"
              />
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

        <Button
          title="Cerrar Sesión Segura"
          variant="danger"
          size="md"
          onPress={logout}
          style={{ alignSelf: 'flex-start' }}
        />
      </Card>

      {/* Información Técnica */}
      <Card style={[styles.card, { backgroundColor: theme.surfaceSubtle }]} padding="md">
        <Text style={[styles.infoTitle, { color: theme.textSecondary }]}>
          SEGURIDAD Y CUMPLIMIENTO
        </Text>
        <Text style={[styles.infoText, { color: theme.textMuted }]}>
          KinesioGestión v1.0.0 • Regla cero GET activa • Autenticación fail-closed con TiDB Cloud.
        </Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? spacing.xl : spacing.md
  },
  card: {
    marginBottom: spacing.lg
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  cardSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    marginBottom: spacing.md
  },
  segmentContainer: {
    gap: spacing.sm
  },
  segmentButton: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1
  },
  segmentTitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: 2
  },
  segmentDesc: {
    fontSize: typography.fontSize.xs
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold
  },
  profileEmail: {
    fontSize: typography.fontSize.xs,
    marginTop: 1
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  },
  infoTitle: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: 2
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16
  }
});
