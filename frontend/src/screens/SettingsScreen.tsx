/**
 * @file SettingsScreen.tsx
 * @description Pantalla de ajustes: selector de tema visual (claro/oscuro/automático), información de cuenta y logout.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, radii, typography } from '../theme/tokens';
import { useResponsive } from '../theme/useResponsive';
import { Card, Badge, Button, ScreenHeader, AppearanceSelector } from '../components/ui';

export const SettingsScreen = () => {
  const { theme } = useAppTheme();
  const { isPhone, isSmallPhone, contentMaxWidth } = useResponsive();
  const { user, logout } = useAuth();

  const roleName = user?.role || user?.role_name || 'usuario';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: isSmallPhone ? spacing.sm : isPhone ? spacing.md : spacing.xl
        }
      ]}
    >
      <ScreenHeader
        title="Ajustes"
      />

      {/* Selector de Apariencia Unificado */}
      <View style={styles.sectionMargin}>
        <AppearanceSelector wrapInCard />
      </View>

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
    flex: 1
  },
  sectionMargin: {
    marginBottom: spacing.lg
  },
  card: {
    marginBottom: spacing.lg
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md
  },
  avatar: {
    width: 48,
    height: 48,
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
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  },
  profileEmail: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: spacing.md
  }
});
