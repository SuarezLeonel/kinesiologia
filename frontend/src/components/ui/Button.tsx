/**
 * @file Button.tsx
 * @description Botón táctil accesible con estados primario, secundario, peligro y loading.
 */
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, controlHeights } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  accessibilityLabel
}) => {
  const { theme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: controlHeights.sm,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: spacing.xs + 2,
          fontSize: typography.fontSize.sm
        };
      case 'lg':
        return {
          minHeight: controlHeights.lg,
          paddingHorizontal: spacing.xxl,
          paddingVertical: spacing.sm + 2,
          fontSize: typography.fontSize.md
        };
      case 'md':
      default:
        return {
          minHeight: controlHeights.md,
          paddingHorizontal: spacing.lg + 2,
          paddingVertical: spacing.sm,
          fontSize: typography.fontSize.base
        };
    }
  };

  const getVariantStyles = () => {
    if (disabled) {
      return {
        bg: theme.surfaceSubtle,
        border: theme.border,
        text: theme.textMuted
      };
    }

    switch (variant) {
      case 'secondary':
        return {
          bg: theme.surfaceSubtle,
          border: theme.border,
          text: theme.text
        };
      case 'outline':
        return {
          bg: theme.surface,
          border: theme.primary,
          text: theme.primary
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          text: theme.textSecondary
        };
      case 'danger':
        return {
          bg: theme.errorBg,
          border: theme.error,
          text: theme.error
        };
      case 'primary':
      default:
        return {
          bg: theme.primary,
          border: theme.primary,
          text: theme.primaryContrast
        };
    }
  };

  const dims = getDimensions();
  const v = getVariantStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        {
          minHeight: dims.minHeight,
          minWidth: 44,
          paddingHorizontal: dims.paddingHorizontal,
          paddingVertical: dims.paddingVertical,
          backgroundColor: v.bg,
          borderColor: isFocused ? theme.text : v.border,
          borderWidth: isFocused ? 2.5 : variant === 'outline' || variant === 'danger' ? 1.5 : 1
        },
        fullWidth && { width: '100%' },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {Boolean(icon) && <>{icon}</>}
          <Text
            style={[
              styles.text,
              {
                color: v.text,
                fontSize: dims.fontSize,
                marginLeft: icon ? spacing.xs + 2 : 0
              },
              textStyle
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.1,
    textAlign: 'center'
  }
});
