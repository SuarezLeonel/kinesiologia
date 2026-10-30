/**
 * @file InsuranceSelector.tsx
 * @description Selector de obras sociales y coberturas médicas para pacientes.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, controlHeights } from '../../theme/tokens';

export const ARGENTINA_INSURANCE_OPTIONS = [
  'Particular',
  'OSDE',
  'Swiss Medical',
  'Galeno',
  'IOMA',
  'PAMI',
  'Medifé',
  'OMINT',
  'Sancor Salud',
  'OSECAC',
  'OSPE',
  'Accord Salud',
  'Prevención Salud',
  'Federada Salud',
  'Hospital Italiano',
  'Hospital Alemán',
  'Hospital Británico',
  'OSDEPYM',
  'OSPLAD',
  'OSPRERA',
  'UOM (OSUOMRA)',
  'Otra'
];

interface InsuranceSelectorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  customValue?: string;
  onChangeCustom?: (custom: string) => void;
  error?: string;
  required?: boolean;
}

export const InsuranceSelector: React.FC<InsuranceSelectorProps> = ({
  label = 'Obra social / Cobertura',
  value,
  onChange,
  customValue = '',
  onChangeCustom,
  error,
  required = false
}) => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');

  const selectedLabel = value || 'Particular';

  const filteredOptions = ARGENTINA_INSURANCE_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(filterText.trim().toLowerCase())
  );

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.text }]}>
            {label}
            {required && <Text style={{ color: theme.error }}> *</Text>}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen((prev) => !prev)}
        style={[
          styles.selectorTrigger,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : open ? theme.primary : theme.border,
            minHeight: controlHeights.md
          }
        ]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.selectedText,
            { color: value ? theme.text : theme.textMuted }
          ]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={22}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {open && (
        <View
          style={[
            styles.dropdownContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border
            }
          ]}
        >
          <View style={[styles.searchBox, { borderBottomColor: theme.borderSubtle }]}>
            <MaterialIcons name="search" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              value={filterText}
              onChangeText={setFilterText}
              placeholder="Buscar obra social..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {filterText ? (
              <TouchableOpacity onPress={() => setFilterText('')}>
                <MaterialIcons name="close" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={styles.optionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredOptions.map((option) => {
              const isSelected = selectedLabel === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: isSelected ? theme.primaryLight : 'transparent',
                      borderBottomColor: theme.borderSubtle
                    }
                  ]}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                    setFilterText('');
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? theme.primary : theme.text,
                        fontWeight: isSelected ? typography.fontWeight.bold : typography.fontWeight.normal
                      }
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected && <MaterialIcons name="check" size={18} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {selectedLabel === 'Otra' && onChangeCustom && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
            Especifique cuál obra social o cobertura
          </Text>
          <View
            style={[
              styles.customInputWrapper,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                minHeight: controlHeights.md
              }
            ]}
          >
            <TextInput
              value={customValue}
              onChangeText={onChangeCustom}
              placeholder="Ej: Unión Personal, Luis Pasteur..."
              placeholderTextColor={theme.textMuted}
              style={[styles.customInput, { color: theme.text }]}
            />
          </View>
        </View>
      )}

      {error ? <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text> : null}
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
  subLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 4
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md
  },
  selectedText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    marginRight: spacing.xs
  },
  dropdownContainer: {
    marginTop: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 240
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    height: 40,
    borderBottomWidth: 1
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    paddingVertical: 4
  },
  optionsScroll: {
    maxHeight: 195
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1
  },
  optionText: {
    fontSize: typography.fontSize.sm
  },
  customInputWrapper: {
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  customInput: {
    fontSize: typography.fontSize.base,
    height: controlHeights.md
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium
  }
});
