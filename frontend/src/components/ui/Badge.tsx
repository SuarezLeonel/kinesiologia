import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography } from '../../theme/tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style
}) => {
  const { theme } = useAppTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: theme.successBg,
          text: theme.success,
          border: theme.success + '40'
        };
      case 'warning':
        return {
          bg: theme.warningBg,
          text: theme.warning,
          border: theme.warning + '40'
        };
      case 'error':
        return {
          bg: theme.errorBg,
          text: theme.error,
          border: theme.error + '40'
        };
      case 'info':
        return {
          bg: theme.infoBg,
          text: theme.info,
          border: theme.info + '40'
        };
      case 'neutral':
        return {
          bg: theme.surfaceSubtle,
          text: theme.textSecondary,
          border: theme.border
        };
      case 'default':
      default:
        return {
          bg: theme.primaryLight,
          text: theme.primary,
          border: theme.primary + '40'
        };
    }
  };

  const v = getVariantStyles();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingHorizontal: isSm ? spacing.xs + 2 : spacing.sm + 2,
          paddingVertical: isSm ? 2 : spacing.xs
        },
        style
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: v.text,
            fontSize: isSm ? typography.fontSize.tiny : typography.fontSize.xs
          }
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  }
});
