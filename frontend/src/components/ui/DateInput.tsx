/**
 * @file DateInput.tsx
 * @description Campo de selección y entrada de fechas adaptado a móvil y web.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  Modal,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, controlHeights } from '../../theme/tokens';

export interface DateInputProps {
  label?: string;
  value?: string; // Formato YYYY-MM-DD
  onChangeDate: (date: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  min?: string;
  max?: string;
  containerStyle?: StyleProp<ViewStyle>;
  placeholder?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChangeDate,
  error,
  helperText,
  required = false,
  min,
  max,
  containerStyle,
  placeholder = 'AAAA-MM-DD',
  disabled = false
}) => {
  const { theme, isDark } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Parsear fecha actual o usar fecha de hoy
  const parsedDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsedDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(parsedDate.getDate());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Sincronizar estado interno cuando se abre el modal
  const openModal = () => {
    if (disabled) return;
    const current = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(Number(value.split('-')[0]), Number(value.split('-')[1]) - 1, Number(value.split('-')[2]))
      : new Date();
    setViewYear(current.getFullYear());
    setViewMonth(current.getMonth());
    setSelectedDay(current.getDate());
    setYearPickerVisible(false);
    setModalVisible(true);
  };

  // Días del mes actual
  const calendarDays = useMemo(() => {
    const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Lunes = 0
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${mStr}-${dStr}`;
    onChangeDate(newDateStr);
    setModalVisible(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const yStr = today.getFullYear();
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yStr}-${mStr}-${dStr}`;
    onChangeDate(todayStr);
    setModalVisible(false);
  };

  // Formato visual legible para el botón en móvil
  const displayFormatted = useMemo(() => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  }, [value]);

  const borderColor = error ? theme.error : theme.border;

  // RENDERIZADO EN ENTORNO WEB (HTML5 Input Date nativo)
  if (Platform.OS === 'web') {
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
              backgroundColor: disabled ? theme.surfaceSubtle : theme.surface,
              borderColor,
              height: controlHeights.md
            }
          ]}
        >
          <input
            type="date"
            value={value || ''}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e: any) => onChangeDate(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              paddingLeft: spacing.md,
              paddingRight: spacing.md,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: theme.text,
              fontSize: typography.fontSize.sm,
              fontFamily: 'inherit',
              cursor: disabled ? 'not-allowed' : 'pointer',
              colorScheme: isDark ? 'dark' : 'light'
            }}
          />
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        ) : helperText ? (
          <Text style={[styles.helperText, { color: theme.textSecondary }]}>{helperText}</Text>
        ) : null}
      </View>
    );
  }

  // RENDERIZADO EN ENTORNO NATIVO (Mobile iOS/Android con selector interactivo)
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

      <TouchableOpacity
        onPress={openModal}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label || 'Seleccionar fecha'}
        style={[
          styles.inputWrapper,
          {
            backgroundColor: disabled ? theme.surfaceSubtle : theme.surface,
            borderColor,
            height: controlHeights.md,
            paddingHorizontal: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }
        ]}
      >
        <Text
          style={[
            styles.valueText,
            {
              color: value ? theme.text : theme.textMuted
            }
          ]}
        >
          {displayFormatted || placeholder}
        </Text>
        <MaterialIcons name="event" size={20} color={theme.primary} />
      </TouchableOpacity>

      {error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{helperText}</Text>
      ) : null}

      {/* Modal de Selector de Fecha para Dispositivos Móviles */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Header del Calendario */}
            <View style={[styles.modalHeader, { backgroundColor: theme.primaryLight + '30', borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalHeaderSub, { color: theme.primary }]}>SELECCIONAR FECHA</Text>
                <TouchableOpacity onPress={() => setYearPickerVisible(!yearPickerVisible)}>
                  <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>
                    {MONTH_NAMES[viewMonth]} {viewYear} ▾
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.headerArrows}>
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={[styles.arrowBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <MaterialIcons name="chevron-left" size={22} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={[styles.arrowBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                >
                  <MaterialIcons name="chevron-right" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Selector de Años (si está expandido) */}
            {yearPickerVisible ? (
              <ScrollView style={styles.yearListContainer}>
                <View style={styles.yearGrid}>
                  {Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - 75 + i).map((y) => (
                    <TouchableOpacity
                      key={y}
                      onPress={() => {
                        setViewYear(y);
                        setYearPickerVisible(false);
                      }}
                      style={[
                        styles.yearChip,
                        {
                          backgroundColor: y === viewYear ? theme.primary : theme.surfaceSubtle,
                          borderColor: y === viewYear ? theme.primary : theme.border
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.yearChipText,
                          { color: y === viewYear ? '#FFFFFF' : theme.text }
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.calendarBody}>
                {/* Cabecera de días de la semana */}
                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((w, idx) => (
                    <Text key={idx} style={[styles.weekDayText, { color: theme.textSecondary }]}>
                      {w}
                    </Text>
                  ))}
                </View>

                {/* Cuadrícula de días */}
                <View style={styles.daysGrid}>
                  {calendarDays.map((d, idx) => {
                    if (d === null) {
                      return <View key={`empty-${idx}`} style={styles.dayCell} />;
                    }
                    const isSelected =
                      value &&
                      value ===
                        `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isToday =
                      new Date().getFullYear() === viewYear &&
                      new Date().getMonth() === viewMonth &&
                      new Date().getDate() === d;

                    return (
                      <TouchableOpacity
                        key={`day-${d}`}
                        onPress={() => handleSelectDay(d)}
                        style={[
                          styles.dayCell,
                          isSelected && { backgroundColor: theme.primary, borderRadius: radii.full },
                          !isSelected && isToday && { borderWidth: 1, borderColor: theme.primary, borderRadius: radii.full }
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: isSelected ? '#FFFFFF' : isToday ? theme.primary : theme.text },
                            isSelected && { fontWeight: typography.fontWeight.bold }
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Footer con acciones */}
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                onPress={handleSelectToday}
                style={[styles.footerBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              >
                <Text style={[styles.footerBtnText, { color: theme.primary }]}>Hoy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.footerBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              >
                <Text style={[styles.footerBtnText, { color: theme.textSecondary }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  inputWrapper: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  valueText: {
    fontSize: typography.fontSize.sm
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  modalHeaderSub: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8
  },
  modalHeaderTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  headerArrows: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  calendarBody: {
    padding: spacing.md
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  dayCell: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2
  },
  dayText: {
    fontSize: typography.fontSize.sm
  },
  yearListContainer: {
    maxHeight: 220,
    padding: spacing.md
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center'
  },
  yearChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 55,
    alignItems: 'center'
  },
  yearChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1
  },
  footerBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1
  },
  footerBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold
  }
});
