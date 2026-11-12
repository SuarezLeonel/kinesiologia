/**
 * @file DateInput.tsx
 * @description Campo de selección y entrada de fechas adaptado a móvil y web,
 * con soporte para bloqueo visual de fines de semana, feriados y límites de calendario.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Modal,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radii, typography, controlHeights } from '../../theme/tokens';

export interface DateDisabledEvaluation {
  disabled: boolean;
  reason?: string;
  holidayName?: string;
  isHoliday?: boolean;
  isOptionalOpen?: boolean;
}

export interface DateInputProps {
  label?: string;
  value?: string; // Formato YYYY-MM-DD
  onChangeDate: (date: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  min?: string;
  max?: string;
  disableWeekends?: boolean;
  isDateDisabled?: (dateStr: string) => DateDisabledEvaluation;
  containerStyle?: StyleProp<ViewStyle>;
  placeholder?: string;
  disabled?: boolean;
  inlineCalendar?: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEK_DAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChangeDate,
  error,
  helperText,
  required = false,
  min,
  max,
  disableWeekends = false,
  isDateDisabled,
  containerStyle,
  placeholder = 'Seleccionar fecha en el calendario',
  disabled = false,
  inlineCalendar = false
}) => {
  const { theme } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [disabledFeedback, setDisabledFeedback] = useState<string | null>(null);

  const hasCustomRestrictions = Boolean(disableWeekends || isDateDisabled);

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

  const evaluateDayStr = (dateStr: string): DateDisabledEvaluation => {
    if (min && dateStr < min) {
      return { disabled: true, reason: 'No se permiten reservas en fechas pasadas.' };
    }
    if (max && dateStr > max) {
      return { disabled: true, reason: `Solo se permiten reservas hasta el ${max.split('-').reverse().join('/')}.` };
    }
    if (disableWeekends) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dow = new Date(y, m - 1, d, 12, 0, 0).getDay();
      if (dow === 6) {
        return { disabled: true, reason: 'Sábado no laborable (atención de lunes a viernes).' };
      }
      if (dow === 0) {
        return { disabled: true, reason: 'Domingo no laborable (atención de lunes a viernes).' };
      }
    }
    if (isDateDisabled) {
      return isDateDisabled(dateStr);
    }
    return { disabled: false };
  };

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
    setDisabledFeedback(null);
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
    setDisabledFeedback(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    setDisabledFeedback(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${mStr}-${dStr}`;
    const evaluation = evaluateDayStr(newDateStr);
    if (evaluation.disabled) {
      setDisabledFeedback(evaluation.reason || 'Fecha no laborable o fuera del rango permitido.');
      return;
    }
    setDisabledFeedback(null);
    setSelectedDay(day);
    onChangeDate(newDateStr);
    setModalVisible(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const yStr = today.getFullYear();
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yStr}-${mStr}-${dStr}`;
    const evaluation = evaluateDayStr(todayStr);
    if (evaluation.disabled) {
      setDisabledFeedback(evaluation.reason || 'El día de hoy no está habilitado para reservas.');
      return;
    }
    onChangeDate(todayStr);
    setModalVisible(false);
  };

  // Formato visual legible para el botón
  const displayFormatted = useMemo(() => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [yStr, mStr, dStr] = value.split('-');
      const y = Number(yStr);
      const m = Number(mStr) - 1;
      const d = Number(dStr);
      const dt = new Date(y, m, d, 12, 0, 0);
      const weekDay = WEEK_DAY_NAMES[dt.getDay()] || '';
      const monthName = MONTH_NAMES[m] ? MONTH_NAMES[m].toLowerCase() : mStr;
      return `${weekDay} ${d} de ${monthName} de ${y} (${dStr}/${mStr}/${yStr})`;
    }
    return value;
  }, [value]);

  const currentSelectionEvaluation = useMemo(() => {
    if (!value || !hasCustomRestrictions) return null;
    return evaluateDayStr(value);
  }, [value, min, max, disableWeekends, isDateDisabled]);

  const borderColor = error || currentSelectionEvaluation?.disabled ? theme.error : theme.border;

  const renderCalendarCard = (isInline: boolean) => (
    <View
      style={[
        isInline ? styles.inlineCalendarCard : styles.modalCard,
        { backgroundColor: theme.surface, borderColor: theme.border }
      ]}
    >
      {/* Header del Calendario */}
      <View
        style={[
          styles.modalHeader,
          { backgroundColor: theme.primaryLight + '30', borderBottomColor: theme.border }
        ]}
      >
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={[styles.modalHeaderSub, { color: theme.primary }]}>
            {hasCustomRestrictions ? 'CALENDARIO DE ATENCIÓN (LUN A VIE)' : 'SELECCIONAR FECHA'}
          </Text>
          <TouchableOpacity
            onPress={() => setYearPickerVisible(!yearPickerVisible)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar año"
            style={styles.yearToggleBtn}
          >
            <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>
              {MONTH_NAMES[viewMonth]} {viewYear} ▾
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerArrows}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            style={[styles.arrowBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <MaterialIcons name="chevron-left" size={26} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            style={[styles.arrowBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector de Años (si está expandido) */}
      {yearPickerVisible ? (
        <ScrollView style={styles.yearListContainer}>
          <View style={styles.yearGrid}>
            {Array.from({ length: 95 }, (_, i) => new Date().getFullYear() - 80 + i).map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => {
                  setViewYear(y);
                  setYearPickerVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Año ${y}`}
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
              <Text
                key={idx}
                style={[
                  styles.weekDayText,
                  {
                    color: hasCustomRestrictions && idx >= 5 ? theme.error : theme.textSecondary
                  }
                ]}
              >
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
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const evaluation = evaluateDayStr(dateStr);
              const isDayDisabled = evaluation.disabled;
              const isSelected = Boolean(value && value === dateStr && !isDayDisabled);
              const isToday =
                new Date().getFullYear() === viewYear &&
                new Date().getMonth() === viewMonth &&
                new Date().getDate() === d;

              return (
                <TouchableOpacity
                  key={`day-${d}`}
                  onPress={() => handleSelectDay(d)}
                  activeOpacity={isDayDisabled ? 0.9 : 0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`Día ${d} de ${MONTH_NAMES[viewMonth]} de ${viewYear}${isDayDisabled ? ' (No disponible)' : ''}`}
                  accessibilityState={{ disabled: isDayDisabled, selected: isSelected }}
                  style={[
                    styles.dayCell,
                    isDayDisabled && {
                      backgroundColor: evaluation.isHoliday ? theme.errorBg : theme.surfaceSubtle,
                      borderRadius: radii.md,
                      opacity: 0.45
                    },
                    isSelected && { backgroundColor: theme.primary, borderRadius: radii.md },
                    !isSelected && !isDayDisabled && isToday && {
                      borderWidth: 2,
                      borderColor: theme.primary,
                      borderRadius: radii.md
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : isDayDisabled
                          ? evaluation.isHoliday
                            ? theme.error
                            : theme.textMuted
                          : isToday
                          ? theme.primary
                          : theme.text
                      },
                      isDayDisabled && { textDecorationLine: 'line-through' },
                      isSelected && { fontWeight: typography.fontWeight.bold }
                    ]}
                  >
                    {d}
                  </Text>
                  {evaluation.isHoliday && (
                    <View style={[styles.holidayDot, { backgroundColor: theme.error }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {hasCustomRestrictions && (
            <View style={[styles.legendRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Turnos habilitados de lunes a viernes (próximos 14 días). Sábados, domingos y feriados cerrados están deshabilitados.
              </Text>
            </View>
          )}

          {Boolean(disabledFeedback) && (
            <View style={[styles.feedbackBanner, { backgroundColor: theme.errorBg, borderColor: theme.error }]}>
              <MaterialIcons name="event-busy" size={20} color={theme.error} />
              <Text style={[styles.feedbackText, { color: theme.error }]}>{disabledFeedback}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer con acciones */}
      <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          onPress={handleSelectToday}
          accessibilityRole="button"
          accessibilityLabel="Seleccionar el día de hoy"
          style={[styles.footerBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
        >
          <Text style={[styles.footerBtnText, { color: theme.primary }]}>Ir a hoy</Text>
        </TouchableOpacity>

        {!isInline && (
          <TouchableOpacity
            onPress={() => setModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar calendario"
            style={[styles.footerBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
          >
            <Text style={[styles.footerBtnText, { color: theme.textSecondary }]}>Cerrar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // RENDERIZADO INTERACTIVO CON CALENDARIO VISUAL ACCESIBLE (Móvil + Web)
  return (
    <View style={[styles.container, containerStyle]}>
      {Boolean(label) && (
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
            minHeight: controlHeights.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm
          }
        ]}
      >
        <Text
          style={[
            styles.valueText,
            {
              color: value ? theme.text : theme.textMuted,
              flex: 1
            }
          ]}
        >
          {displayFormatted || placeholder}
        </Text>
        {!inlineCalendar && (
          <View style={[styles.calendarBadge, { backgroundColor: theme.primaryLight + '35' }]}>
            <MaterialIcons name="event" size={20} color={theme.primary} />
            <Text style={[styles.calendarBadgeText, { color: theme.primary }]}>
              {value ? 'Cambiar' : 'Elegir'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {inlineCalendar && (
        <View style={{ marginTop: spacing.md }}>
          {renderCalendarCard(true)}
        </View>
      )}

      {error ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={18} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      ) : currentSelectionEvaluation?.disabled && currentSelectionEvaluation?.reason ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={18} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{currentSelectionEvaluation.reason}</Text>
        </View>
      ) : currentSelectionEvaluation?.isOptionalOpen && currentSelectionEvaluation?.reason ? (
        <Text style={[styles.helperText, { color: theme.primary }]}>{currentSelectionEvaluation.reason}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{helperText}</Text>
      ) : null}

      {/* Modal de Selector de Fecha con bloqueo visual de días no laborables y feriados */}
      {!inlineCalendar && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            {renderCalendarCard(false)}
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs + 2
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  inputWrapper: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    overflow: 'hidden'
  },
  valueText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium
  },
  calendarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.sm
  },
  calendarBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs + 2
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  helperText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs + 2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  inlineCalendarCard: {
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    overflow: 'hidden'
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
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  yearToggleBtn: {
    minHeight: 40,
    justifyContent: 'center'
  },
  modalHeaderTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  headerArrows: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
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
    width: '14.28%',
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  dayCell: {
    width: '14.28%',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2
  },
  dayText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium
  },
  holidayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2
  },
  legendRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 20
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  },
  yearListContainer: {
    maxHeight: 260,
    padding: spacing.md
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center'
  },
  yearChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    minWidth: 72,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  yearChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1
  },
  footerBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  footerBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  }
});
