/**
 * @file SettingsScreen.tsx
 * @description Pantalla de ajustes: selector de tema visual (claro/oscuro), información de cuenta y logout.
 */
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
    { key: 'system', label: 'Sistema', desc: 'Automático según el dispositivo' },
    { key: 'light', label: 'Claro', desc: 'Tema claro' },
    { key: 'dark', label: 'Oscuro', desc: 'Tema oscuro' }
  ];

  const roleName = user?.role || user?.role_name || 'usuario';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Ajustes"
      />

      {/* Selector de Apariencia */}
      <Card elevated style={styles.card} padding="lg">
        <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.md }]}>Apariencia</Text>

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
        <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.sm }]}>Tu Cuenta</Text>

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
                label={roleName.toUpperCase()}
                variant="default"
                size="sm"
              />
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

        <Button
          title="Cerrar sesión"
          variant="danger"
          size="md"
          onPress={logout}
          style={{ alignSelf: 'flex-start' }}
        />
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
