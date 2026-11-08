/**
 * @file Input.tsx
 * @description Campo de texto accesible con soporte para etiquetas, errores de validación e iconos.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, controlHeights } from '../../theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  isPassword?: boolean;
  rightAction?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  required = false,
  isPassword = false,
  rightAction,
  containerStyle,
  style,
  onFocus,
  onBlur,
  multiline,
  numberOfLines,
  secureTextEntry,
  ...rest
}) => {
  const { theme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const borderColor = error
    ? theme.error
    : isFocused
    ? theme.primary
    : theme.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.text }]}>
            {label}
            {required && <Text style={{ color: theme.error, fontWeight: '700' }}> *</Text>}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.surface,
            borderColor,
            borderWidth: isFocused || error ? 2 : 1.5,
            minHeight: multiline ? (numberOfLines ? numberOfLines * 26 + 20 : 88) : controlHeights.md
          }
        ]}
      >
        <TextInput
          accessibilityLabel={label || rest.placeholder}
          style={[
            styles.input,
            {
              color: theme.text,
              minHeight: multiline ? (numberOfLines ? numberOfLines * 26 + 20 : 88) : controlHeights.md,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? spacing.sm + 2 : spacing.xs + 2
            },
            style
          ]}
          placeholderTextColor={theme.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={isPassword ? !showPassword : secureTextEntry}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightAction && <View style={styles.iconButton}>{rightAction}</View>}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={16} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md + 2
  },
  labelRow: {
    marginBottom: spacing.xs + 2
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.1
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    overflow: 'hidden'
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base
  },
  iconButton: {
    paddingHorizontal: spacing.md,
    minWidth: 44,
    minHeight: controlHeights.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs + 2
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs + 2,
    lineHeight: 20
  }
});
