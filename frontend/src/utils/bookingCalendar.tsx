/**
 * @file bookingCalendar.tsx
 * @description Utilidades compartidas y caché en cliente para validación de calendario de turnos:
 * - Ventana estricta de [hoy, hoy + 14 días corridos]
 * - Atención exclusiva de lunes a viernes (sábados y domingos deshabilitados)
 * - Feriados nacionales (ArgentinaDatos), provinciales, municipales y días no laborables opcionales
 */
import { apiClient } from '../api/client';

export const MAX_BOOKING_CALENDAR_DAYS = 14;

export interface HolidayItem {
  id?: number;
  date: string;
  year: number;
  name: string;
  holidayType: string;
  scope: 'national' | 'provincial' | 'municipal' | 'clinic';
  jurisdiction?: string;
  isOptional: boolean;
  isClosed: boolean;
  source?: string;
}

export interface CalendarDayEvaluation {
  date: string;
  available: boolean;
  reasonCode: string;
  reason: string;
  dayOfWeek?: number;
  holiday?: HolidayItem | null;
}

export type CalendarDayStatus = CalendarDayEvaluation;

export interface CalendarAvailabilityResponse {
  minDate: string;
  maxDate: string;
  maxDays: number;
  firstAvailableDate: string | null;
  yearsChecked: number[];
  days: CalendarDayEvaluation[];
}

export function formatLocalISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  return formatLocalISO(dt);
}

export function getBookingWindow(referenceDate?: Date): { minDate: string; maxDate: string } {
  const minDate = formatLocalISO(referenceDate || new Date());
  const maxDate = addDaysISO(minDate, MAX_BOOKING_CALENDAR_DAYS);
  return { minDate, maxDate };
}

export function getWeekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

// Caché en memoria en el cliente y deduplicación in-flight para no consultar en cada apertura del calendario
let cachedAvailability: {
  mode: 'staff' | 'patient';
  loadedAt: number;
  data: CalendarAvailabilityResponse;
  byDate: Record<string, CalendarDayEvaluation>;
} | null = null;

const inFlightAvailability: Partial<
  Record<
    'staff' | 'patient',
    Promise<{
      minDate: string;
      maxDate: string;
      firstAvailableDate: string;
      byDate: Record<string, CalendarDayEvaluation>;
    }>
  >
> = {};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function invalidateClientCalendarCache() {
  cachedAvailability = null;
}

export const invalidateBookingCalendarCache = invalidateClientCalendarCache;

export async function fetchBookingCalendarAvailability(
  mode: 'staff' | 'patient' = 'staff',
  forceRefresh = false
): Promise<{
  minDate: string;
  maxDate: string;
  firstAvailableDate: string;
  byDate: Record<string, CalendarDayEvaluation>;
}> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedAvailability &&
    cachedAvailability.mode === mode &&
    now - cachedAvailability.loadedAt < CLIENT_CACHE_TTL_MS
  ) {
    const { minDate, maxDate, firstAvailableDate } = cachedAvailability.data;
    return {
      minDate,
      maxDate,
      firstAvailableDate: firstAvailableDate || minDate,
      byDate: cachedAvailability.byDate
    };
  }

  if (!forceRefresh && inFlightAvailability[mode]) {
    return inFlightAvailability[mode]!;
  }

  const { minDate: localMin, maxDate: localMax } = getBookingWindow();
  // Pedimos el rango desde el inicio del mes actual hasta el fin del mes siguiente para pintar el calendario completo
  const fromMonthStart = `${localMin.slice(0, 8)}01`;
  const toExtended = addDaysISO(localMax, 25);

  const endpoint =
    mode === 'patient'
      ? '/patient-portal/calendar-availability'
      : '/appointments/calendar-availability';

  const reqPromise = (async () => {
    try {
      const res = await apiClient.post(endpoint, {
        fromDate: fromMonthStart,
        toDate: toExtended
      });
      if (res.data?.success && res.data?.data) {
        const payload: CalendarAvailabilityResponse = res.data.data;
        const byDate: Record<string, CalendarDayEvaluation> = {};
        for (const d of payload.days || []) {
          byDate[d.date] = d;
        }
        cachedAvailability = {
          mode,
          loadedAt: Date.now(),
          data: payload,
          byDate
        };
        return {
          minDate: payload.minDate || localMin,
          maxDate: payload.maxDate || localMax,
          firstAvailableDate:
            payload.firstAvailableDate || findFirstAvailableLocal(localMin, localMax, byDate),
          byDate
        };
      }
    } catch {
      // Si falla la red y teníamos caché previa, usar caché previa
      if (cachedAvailability && cachedAvailability.mode === mode) {
        return {
          minDate: cachedAvailability.data.minDate,
          maxDate: cachedAvailability.data.maxDate,
          firstAvailableDate: cachedAvailability.data.firstAvailableDate || localMin,
          byDate: cachedAvailability.byDate
        };
      }
    }

    // Si todavía no existen datos almacenados ni respuesta del servidor, evitar habilitar fechas cuya condición de feriado no pudo verificarse
    const fallbackByDate: Record<string, CalendarDayEvaluation> = {
      __unverified__: {
        date: '__unverified__',
        available: false,
        reasonCode: 'UNVERIFIED_HOLIDAYS',
        reason: 'No se pudo verificar la condición de feriado para esta fecha.'
      }
    };
    return {
      minDate: localMin,
      maxDate: localMax,
      firstAvailableDate: localMin,
      byDate: fallbackByDate
    };
  })().finally(() => {
    delete inFlightAvailability[mode];
  });

  inFlightAvailability[mode] = reqPromise;
  return reqPromise;
}

export function evaluateDateClient(
  dateStr: string,
  byDate: Record<string, CalendarDayEvaluation>,
  minDate?: string,
  maxDate?: string
): { disabled: boolean; reason?: string; holidayName?: string; isHoliday?: boolean; isOptionalOpen?: boolean } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { disabled: true, reason: 'Formato de fecha inválido (AAAA-MM-DD).' };
  }

  const bounds = getBookingWindow();
  const min = minDate || bounds.minDate;
  const max = maxDate || bounds.maxDate;

  if (dateStr < min) {
    return { disabled: true, reason: 'No se permiten reservas en fechas pasadas.' };
  }

  if (dateStr > max) {
    return {
      disabled: true,
      reason: `Solo se permiten reservas hasta 14 días corridos (${max}).`
    };
  }

  const dow = getWeekdayIndex(dateStr);
  if (dow === 6) {
    return {
      disabled: true,
      reason: 'Sábado no laborable (el consultorio atiende de lunes a viernes).'
    };
  }
  if (dow === 0) {
    return {
      disabled: true,
      reason: 'Domingo no laborable (el consultorio atiende de lunes a viernes).'
    };
  }

  if (byDate['__unverified__']) {
    return {
      disabled: true,
      reason: byDate['__unverified__'].reason
    };
  }

  const serverEval = byDate[dateStr];
  if (serverEval) {
    if (!serverEval.available) {
      return {
        disabled: true,
        reason: serverEval.reason,
        holidayName: serverEval.holiday?.name,
        isHoliday: Boolean(serverEval.holiday)
      };
    }
    if (serverEval.reasonCode === 'OPTIONAL_WORKING_DAY' && serverEval.holiday) {
      return {
        disabled: false,
        reason: serverEval.reason,
        holidayName: serverEval.holiday.name,
        isOptionalOpen: true
      };
    }
  }

  return { disabled: false };
}

export function findFirstAvailableLocal(
  minDate: string,
  maxDate: string,
  byDate: Record<string, CalendarDayEvaluation>
): string {
  let cursor = minDate;
  for (let i = 0; i <= MAX_BOOKING_CALENDAR_DAYS; i++) {
    const check = evaluateDateClient(cursor, byDate, minDate, maxDate);
    if (!check.disabled) {
      return cursor;
    }
    cursor = addDaysISO(cursor, 1);
  }
  return minDate;
}
