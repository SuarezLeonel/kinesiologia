/**
 * @file AppearanceSelector.tsx
 * @description Componente reutilizable para la selección del tema visual (Claro, Oscuro, Automático).
 * Cumple con accesibilidad WCAG 2.2 AA, contraste reforzado, soporte táctil (>= 48x48 px)
 * y persistencia individualizada por usuario.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme, ThemeMode } from '../../theme/ThemeContext';
import { spacing, radii, typography } from '../../theme/tokens';
import { Card } from './Card';

export interface AppearanceSelectorProps {
  /** Si se renderiza dentro de una Card propia o sin envoltorio adicional */
  wrapInCard?: boolean;
  /** Título personalizado (por defecto "Apariencia") */
  title?: string;
  /** Subtítulo explicativo opcional */
  subtitle?: string;
}

interface ThemeOptionItem {
  key: ThemeMode;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

const THEME_OPTIONS: ThemeOptionItem[] = [
  {
    key: 'system',
    label: 'Automático',
    desc: 'Adapta el tema según la configuración del dispositivo',
    icon: 'brightness-auto'
  },
  {
    key: 'light',
    label: 'Claro',
    desc: 'Utiliza siempre el tema claro',
    icon: 'light-mode'
  },
  {
    key: 'dark',
    label: 'Oscuro',
    desc: 'Utiliza siempre el tema oscuro',
    icon: 'dark-mode'
  }
];

export const AppearanceSelector: React.FC<AppearanceSelectorProps> = ({
  wrapInCard = true,
  title = 'Apariencia',
  subtitle = 'Elegí cómo querés ver la aplicación.'
}) => {
  const { theme, mode, setMode } = useAppTheme();

  const content = (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
      ) : null}

      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}

      <View style={styles.optionsList}>
        {THEME_OPTIONS.map((opt) => {
          const isSelected = mode === opt.key;

          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.75}
              onPress={() => setMode(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`Tema ${opt.label}. ${opt.desc}`}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected ? theme.primaryLight : theme.surfaceSubtle,
                  borderColor: isSelected ? theme.primary : theme.border
                }
              ]}
            >
              {/* Ícono representativo */}
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border
                  }
                ]}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={22}
                  color={isSelected ? '#FFFFFF' : theme.textSecondary}
                />
              </View>

              {/* Textos: Nombre y descripción */}
              <View style={styles.textCol}>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: isSelected ? theme.primary : theme.text,
                      fontWeight: isSelected
                        ? typography.fontWeight.bold
                        : typography.fontWeight.semibold
                    }
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  {opt.desc}
                </Text>
              </View>

              {/* Indicador de radio / selección */}
              <MaterialIcons
                name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={isSelected ? theme.primary : theme.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (wrapInCard) {
    return (
      <Card elevated style={styles.cardWrapper} padding="lg">
        {content}
      </Card>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%'
  },
  container: {
    width: '100%'
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
    marginBottom: spacing.md,
    lineHeight: 18
  },
  optionsList: {
    gap: spacing.sm,
    width: '100%'
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    minHeight: 56
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textCol: {
    flex: 1
  },
  optionLabel: {
    fontSize: typography.fontSize.sm + 1,
    marginBottom: 2
  },
  optionDesc: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16
  }
});

