/**
 * @file Card.tsx
 * @description Contenedor estructurado tipo tarjeta con bordes y sombreado adaptativo al tema.
 */
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, shadows } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  padding?: keyof typeof spacing;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = false,
  padding = 'lg'
}) => {
  const { theme } = useAppTheme();

  const containerStyles = [
    styles.card,
    {
      backgroundColor: elevated ? theme.surfaceElevated : theme.surface,
      borderColor: theme.border,
      padding: spacing[padding]
    },
    elevated ? shadows.subtle : shadows.none,
    style
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={containerStyles}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md
  }
});
