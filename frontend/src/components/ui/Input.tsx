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
            {required && <Text style={{ color: theme.error }}> *</Text>}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.surface,
            borderColor,
            minHeight: multiline ? (numberOfLines ? numberOfLines * 24 + 16 : 80) : controlHeights.md
          }
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              height: multiline ? (numberOfLines ? numberOfLines * 24 + 16 : 80) : controlHeights.md,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingTop: multiline ? spacing.sm + 2 : undefined
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
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightAction && <View style={styles.iconButton}>{rightAction}</View>}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md
  },
  labelRow: {
    marginBottom: spacing.xs + 2
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0.1
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base
  },
  iconButton: {
    paddingHorizontal: spacing.md,
    height: controlHeights.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs
  }
});
