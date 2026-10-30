/**
 * @file Button.tsx
 * @description Botón táctil accesible con estados primario, secundario, peligro y loading.
 */
import React from 'react';
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
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}) => {
  const { theme } = useAppTheme();

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return {
          height: controlHeights.sm,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm
        };
      case 'lg':
        return {
          height: controlHeights.lg,
          paddingHorizontal: spacing.xxl,
          fontSize: typography.fontSize.md
        };
      case 'md':
      default:
        return {
          height: controlHeights.md,
          paddingHorizontal: spacing.lg,
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
          bg: 'transparent',
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
          border: theme.error + '40',
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
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          height: dims.height,
          paddingHorizontal: dims.paddingHorizontal,
          backgroundColor: v.bg,
          borderColor: v.border
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.text,
              {
                color: v.text,
                fontSize: dims.fontSize,
                marginLeft: icon ? spacing.xs : 0
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
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.1
  }
});
