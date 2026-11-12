/**
 * @file holidayService.js
 * @description Servicio de gestión de feriados nacionales (ArgentinaDatos API), provinciales,
 * municipales, días no laborables opcionales y validación de ventana de reserva de 14 días corridos.
 */
import { query } from '../config/database.js';
import { getClinicDateString } from '../utils/date.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const ARGENTINA_DATOS_BASE_URL = 'https://api.argentinadatos.com/v1/feriados';
export const MAX_BOOKING_CALENDAR_DAYS = 14;
const MEMORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas en memoria

/**
 * Feriados jurisdiccionales (provinciales y municipales) recurrentes aplicables a la ubicación del consultorio.
 */
const RECURRING_JURISDICTION_HOLIDAYS = [
  {
    monthDay: '11-11',
    name: 'San Martín de Tours (Patrono Jurisdiccional)',
    holiday_type: 'municipal',
    scope: 'municipal',
    jurisdiction: 'CABA / San Martín',
    is_optional: 0,
    is_closed: 1,
    source: 'local_jurisdiction'
  },
  {
    monthDay: '11-19',
    name: 'Aniversario Fundacional Provincial',
    holiday_type: 'provincial',
    scope: 'provincial',
    jurisdiction: 'Provincia de Buenos Aires',
    is_optional: 0,
    is_closed: 1,
    source: 'local_jurisdiction'
  }
];

/**
 * Extrae una fecha 'YYYY-MM-DD' desde un string ISO, 'YYYY-MM-DD HH:mm:ss' o instancia Date.
 * @param {string|Date} input
 * @returns {string|null}
 */
export function extractDateISO(input) {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return getClinicDateString(input);
  }
  const str = String(input).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const candidate = match[1];
    const [y, m, d] = candidate.split('-').map(Number);
    const check = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (
      check.getUTCFullYear() === y &&
      check.getUTCMonth() + 1 === m &&
      check.getUTCDate() === d
    ) {
      return candidate;
    }
    return null;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getClinicDateString(parsed);
  }
  return null;
}

/**
 * Suma una cantidad de días calendario exactos a una fecha 'YYYY-MM-DD'.
 * @param {string} dateStr - Fecha base 'YYYY-MM-DD'
 * @param {number} days - Cantidad de días corridos a sumar
 * @returns {string} Fecha resultante 'YYYY-MM-DD'
 */
export function addCalendarDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Devuelve el día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado) para 'YYYY-MM-DD'.
 * @param {string} dateStr
 * @returns {number}
 */
export function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Determina si un registro devuelto por ArgentinaDatos corresponde a un día no laborable opcional / puente.
 * @param {{ tipo?: string, nombre?: string }} apiItem
 * @returns {boolean}
 */
export function isOptionalHolidayFromApi(apiItem) {
  const tipo = String(apiItem?.tipo || '').toLowerCase().trim();
  const nombre = String(apiItem?.nombre || '').toLowerCase().trim();
  return (
    tipo === 'puente' ||
    tipo === 'no_laborable' ||
    tipo === 'opcional' ||
    nombre.includes('no laborable') ||
    nombre.includes('puente turístico')
  );
}

export class HolidayService {
  constructor() {
    /**
     * Caché en memoria por año:
     * Map<number, { loadedAt: number, verified: boolean, source: string, byDate: Map<string, Array<Object>> }>
     */
    this.yearCache = new Map();
    this.customFetcher = null;
  }

  /**
   * Permite inyectar un cliente HTTP personalizado en pruebas automatizadas.
   * @param {Function|null} fn
   */
  setCustomFetcher(fn) {
    this.customFetcher = fn;
  }

  /**
   * Limpia la caché en memoria (completo o de un año específico).
   * @param {number} [year]
   */
  invalidateCache(year) {
    if (year !== undefined && year !== null) {
      this.yearCache.delete(Number(year));
    } else {
      this.yearCache.clear();
    }
  }

  /**
   * Calcula los límites calendario permitidos para reservas: [hoy, hoy + 14 días corridos].
   * @param {string} [referenceDate] - Fecha base 'YYYY-MM-DD' (por defecto hoy en Argentina).
   * @returns {{ minDate: string, maxDate: string, maxDays: number }}
   */
  getBookingWindowBounds(referenceDate) {
    const minDate = extractDateISO(referenceDate) || getClinicDateString();
    const maxDate = addCalendarDays(minDate, MAX_BOOKING_CALENDAR_DAYS);
    return {
      minDate,
      maxDate,
      maxDays: MAX_BOOKING_CALENDAR_DAYS
    };
  }

  /**
   * Consulta el endpoint oficial de ArgentinaDatos para un año específico:
   * https://api.argentinadatos.com/v1/feriados/{año}
   * @param {number} year
   * @returns {Promise<Array<{ fecha: string, tipo: string, nombre: string }>>}
   */
  async fetchFromArgentinaDatos(year) {
    const url = `${ARGENTINA_DATOS_BASE_URL}/${year}`;
    const fetcher = this.customFetcher || globalThis.fetch;
    if (typeof fetcher !== 'function') {
      throw new Error('Fetch API no disponible en el entorno');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetcher(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response || !response.ok) {
        throw new Error(`ArgentinaDatos respondió con estado ${response?.status || 'desconocido'}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Formato de respuesta inválido desde ArgentinaDatos');
      }
      return data.filter(
        (item) => item && typeof item.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.fecha)
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Carga desde MySQL los feriados y el estado de sincronización de un año.
   * @param {number} year
   */
  async loadYearFromDatabase(year) {
    const [syncRows, holidayRows] = await Promise.all([
      query('SELECT year, synced_at, source, holidays_count FROM holiday_sync_status WHERE year = ? LIMIT 1', [year]),
      query(
        `SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date, year, name,
                holiday_type, scope, jurisdiction, is_optional, is_closed, source
         FROM clinic_holidays
         WHERE year = ?
         ORDER BY holiday_date ASC, id ASC`,
        [year]
      )
    ]);

    return {
      syncRecord: syncRows[0] || null,
      holidays: holidayRows || []
    };
  }

  /**
   * Sincroniza los feriados de un año desde ArgentinaDatos hacia MySQL, preservando la
   * configuración local (como `is_closed` en días no laborables opcionales).
   * @param {number} year
   */
  async syncYearWithExternalApi(year) {
    const apiHolidays = await this.fetchFromArgentinaDatos(year);

    for (const item of apiHolidays) {
      const dateStr = item.fecha;
      const optional = isOptionalHolidayFromApi(item) ? 1 : 0;
      const holidayType = String(item.tipo || (optional ? 'puente' : 'inamovible')).slice(0, 50);
      const name = String(item.nombre || 'Feriado Nacional').slice(0, 180);

      // Si es un feriado oficial (is_optional = 0), siempre permanece cerrado (is_closed = 1).
      // Si es opcional (is_optional = 1), al actualizar no pisamos is_closed si ya fue configurado en el sistema.
      await query(
        `INSERT INTO clinic_holidays
          (holiday_date, year, name, holiday_type, scope, jurisdiction, is_optional, is_closed, source)
         VALUES (?, ?, ?, ?, 'national', 'Argentina', ?, 1, 'argentinadatos')
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           holiday_type = VALUES(holiday_type),
           is_optional = VALUES(is_optional),
           is_closed = IF(VALUES(is_optional) = 0, 1, is_closed)`,
        [dateStr, year, name, holidayType, optional]
      );
    }

    // Asegurar también los feriados provinciales y municipales recurrentes del consultorio para ese año
    for (const localH of RECURRING_JURISDICTION_HOLIDAYS) {
      const dateStr = `${year}-${localH.monthDay}`;
      await query(
        `INSERT INTO clinic_holidays
          (holiday_date, year, name, holiday_type, scope, jurisdiction, is_optional, is_closed, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name)`,
        [
          dateStr,
          year,
          localH.name,
          localH.holiday_type,
          localH.scope,
          localH.jurisdiction,
          localH.is_optional,
          localH.is_closed,
          localH.source
        ]
      );
    }

    const totalCountRows = await query(
      'SELECT COUNT(*) as total FROM clinic_holidays WHERE year = ?',
      [year]
    );
    const total = Number(totalCountRows[0]?.total || apiHolidays.length);

    await query(
      `INSERT INTO holiday_sync_status (year, source, holidays_count)
       VALUES (?, 'argentinadatos', ?)
       ON DUPLICATE KEY UPDATE
         synced_at = CURRENT_TIMESTAMP,
         source = 'argentinadatos',
         holidays_count = VALUES(holidays_count)`,
      [year, total]
    );
  }

  /**
   * Construye la entrada de caché en memoria a partir de las filas de `clinic_holidays`.
   */
  _buildCacheEntry(holidays, verified, source) {
    const byDate = new Map();
    for (const row of holidays) {
      const dateKey = String(row.holiday_date).slice(0, 10);
      const normalized = {
        id: row.id,
        date: dateKey,
        year: Number(row.year),
        name: row.name,
        holidayType: row.holiday_type,
        scope: row.scope,
        jurisdiction: row.jurisdiction,
        isOptional: Boolean(row.is_optional),
        // Regla: Los feriados oficiales (no opcionales) SIEMPRE mantienen el consultorio cerrado.
        // Los días no laborables opcionales respetan su configuración is_closed.
        isClosed: row.is_optional ? Boolean(row.is_closed) : true,
        source: row.source
      };
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push(normalized);
    }

    return {
      loadedAt: Date.now(),
      verified: Boolean(verified),
      source: source || 'database',
      byDate
    };
  }

  /**
   * Garantiza que los feriados del año solicitado estén cargados y verificados en caché.
   * - Primero consulta caché en memoria (evita peticiones externas cada vez que se abre el calendario).
   * - Luego consulta la base de datos MySQL.
   * - Si el año no está sincronizado o se solicita `forceRefresh`, consulta ArgentinaDatos API.
   * - Si la API falla y existen datos previos almacenados, utiliza los datos en caché/BD.
   * - Si la API falla y NO existen datos almacenados para ese año, marca `verified: false`
   *   para impedir habilitar fechas cuya condición de feriado no pudo comprobarse.
   *
   * @param {number} year
   * @param {{ forceRefresh?: boolean }} [options]
   */
  async ensureYearHolidays(year, { forceRefresh = false } = {}) {
    const numYear = Number(year);
    if (!Number.isInteger(numYear) || numYear < 2000 || numYear > 2100) {
      return this._buildCacheEntry([], false, 'invalid_year');
    }

    const cached = this.yearCache.get(numYear);
    if (
      !forceRefresh &&
      cached &&
      cached.verified &&
      Date.now() - cached.loadedAt < MEMORY_CACHE_TTL_MS
    ) {
      return cached;
    }

    const dbData = await this.loadYearFromDatabase(numYear);
    const hasStoredHolidays = Boolean(dbData.syncRecord || dbData.holidays.length > 0);

    // Si ya tenemos los feriados sincronizados en la BD y no se forzó recarga, usar directamente
    if (!forceRefresh && hasStoredHolidays) {
      const entry = this._buildCacheEntry(dbData.holidays, true, dbData.syncRecord?.source || 'database_cache');
      this.yearCache.set(numYear, entry);
      return entry;
    }

    // Intentar sincronizar con ArgentinaDatos API
    try {
      await this.syncYearWithExternalApi(numYear);
      const freshDb = await this.loadYearFromDatabase(numYear);
      const entry = this._buildCacheEntry(freshDb.holidays, true, 'argentinadatos');
      this.yearCache.set(numYear, entry);
      return entry;
    } catch {
      // Fallback a datos previamente almacenados si la API externa no está disponible
      if (hasStoredHolidays) {
        const fallbackEntry = this._buildCacheEntry(dbData.holidays, true, 'database_fallback');
        this.yearCache.set(numYear, fallbackEntry);
        return fallbackEntry;
      }

      // Si no hay datos almacenados y la API falló, NO habilitar fechas sin verificar
      return this._buildCacheEntry([], false, 'unverified');
    }
  }

  /**
   * Evalúa si una fecha ('YYYY-MM-DD') está habilitada para atención y reserva de turnos.
   * @param {string|Date} dateInput
   * @param {{ referenceDate?: string, enforceWindow?: boolean, kinesiologistId?: number|string }} [options]
   */
  async evaluateDate(dateInput, { referenceDate, enforceWindow = true, kinesiologistId } = {}) {
    const dateStr = extractDateISO(dateInput);
    if (!dateStr) {
      return {
        date: String(dateInput || ''),
        available: false,
        reasonCode: 'INVALID_DATE',
        reason: 'Formato de fecha inválido. Utilice AAAA-MM-DD.',
        holiday: null
      };
    }

    const { minDate, maxDate } = this.getBookingWindowBounds(referenceDate);

    if (enforceWindow) {
      if (dateStr < minDate) {
        return {
          date: dateStr,
          available: false,
          reasonCode: 'PAST_DATE',
          reason: 'No se permiten reservas ni turnos en fechas pasadas.',
          minDate,
          maxDate,
          holiday: null
        };
      }

      if (dateStr > maxDate) {
        return {
          date: dateStr,
          available: false,
          reasonCode: 'EXCEEDS_MAX_WINDOW',
          reason: `Solo se permiten reservas dentro de los próximos ${MAX_BOOKING_CALENDAR_DAYS} días corridos (hasta el ${maxDate}).`,
          minDate,
          maxDate,
          holiday: null
        };
      }
    }

    const dayOfWeek = getDayOfWeek(dateStr);
    if (dayOfWeek === 6) {
      return {
        date: dateStr,
        available: false,
        reasonCode: 'WEEKEND_SATURDAY',
        reason: 'El consultorio permanece cerrado los días sábados (atención exclusiva de lunes a viernes).',
        dayOfWeek,
        holiday: null
      };
    }

    if (dayOfWeek === 0) {
      return {
        date: dateStr,
        available: false,
        reasonCode: 'WEEKEND_SUNDAY',
        reason: 'El consultorio permanece cerrado los días domingos (atención exclusiva de lunes a viernes).',
        dayOfWeek,
        holiday: null
      };
    }

    const year = Number(dateStr.slice(0, 4));
    const yearData = await this.ensureYearHolidays(year);

    if (!yearData.verified) {
      return {
        date: dateStr,
        available: false,
        reasonCode: 'UNVERIFIED_HOLIDAYS',
        reason: `No se pudo verificar el calendario de feriados para el año ${year}. Fecha deshabilitada preventivamente.`,
        dayOfWeek,
        holiday: null
      };
    }

    const holidaysOnDate = yearData.byDate.get(dateStr) || [];
    if (holidaysOnDate.length > 0) {
      // Buscar si alguno implica cierre del consultorio (feriado oficial o día no laborable configurado como cerrado)
      const blockingHoliday = holidaysOnDate.find((h) => !h.isOptional || h.isClosed);
      if (blockingHoliday) {
        let reasonCode = 'NATIONAL_HOLIDAY';
        let label = 'feriado nacional';
        if (blockingHoliday.scope === 'provincial') {
          reasonCode = 'PROVINCIAL_HOLIDAY';
          label = `feriado provincial (${blockingHoliday.jurisdiction})`;
        } else if (blockingHoliday.scope === 'municipal') {
          reasonCode = 'MUNICIPAL_HOLIDAY';
          label = `feriado municipal (${blockingHoliday.jurisdiction})`;
        } else if (blockingHoliday.isOptional) {
          reasonCode = 'OPTIONAL_NON_WORKING_CLOSED';
          label = 'día no laborable';
        }

        return {
          date: dateStr,
          available: false,
          reasonCode,
          reason: `El consultorio permanece cerrado por ${label}: ${blockingHoliday.name}.`,
          dayOfWeek,
          holiday: blockingHoliday
        };
      }

      // Es un día no laborable opcional configurado como laborable (is_closed = 0)
      const optionalOpen = holidaysOnDate[0];
      if (kinesiologistId) {
        const onVacation = await this.isKinesiologistOnVacation(kinesiologistId, dateStr);
        if (onVacation) {
          return {
            date: dateStr,
            available: false,
            reasonCode: 'KINESIOLOGIST_VACATION',
            reason: 'El profesional seleccionado se encuentra de vacaciones en la fecha seleccionada.',
            dayOfWeek,
            holiday: null
          };
        }
      }

      return {
        date: dateStr,
        available: true,
        reasonCode: 'OPTIONAL_WORKING_DAY',
        reason: `Día no laborable opcional habilitado para atención: ${optionalOpen.name}.`,
        dayOfWeek,
        holiday: optionalOpen
      };
    }

    if (kinesiologistId) {
      const onVacation = await this.isKinesiologistOnVacation(kinesiologistId, dateStr);
      if (onVacation) {
        return {
          date: dateStr,
          available: false,
          reasonCode: 'KINESIOLOGIST_VACATION',
          reason: 'El profesional seleccionado se encuentra de vacaciones en la fecha seleccionada.',
          dayOfWeek,
          holiday: null
        };
      }
    }

    return {
      date: dateStr,
      available: true,
      reasonCode: 'WORKING_DAY',
      reason: 'Día hábil de atención normal.',
      dayOfWeek,
      holiday: null
    };
  }

  /**
   * Determina si un kinesiólogo está de vacaciones en una fecha dada (YYYY-MM-DD).
   * @param {number|string} kinesiologistId
   * @param {string} dateStr
   * @returns {Promise<boolean>}
   */
  async isKinesiologistOnVacation(kinesiologistId, dateStr) {
    if (!kinesiologistId || !dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    const rows = await query(
      `SELECT id FROM kinesiologist_vacations
       WHERE kinesiologist_id = ?
         AND status IN ('scheduled', 'active')
         AND ? >= start_date AND ? <= end_date
       LIMIT 1`,
      [kinesiologistId, cleanDate, cleanDate]
    );
    return rows.length > 0;
  }

  /**
   * Valida una fecha/hora de turno y lanza BadRequestError (400) si la fecha no es válida o no es laborable.
   * Se utiliza al crear, modificar o reprogramar turnos.
   * @param {string|Date} dateTimeInput
   * @param {{ referenceDate?: string, kinesiologistId?: number|string }} [options]
   */
  async validateAppointmentDate(dateTimeInput, options = {}) {
    const evaluation = await this.evaluateDate(dateTimeInput, {
      referenceDate: options.referenceDate,
      kinesiologistId: options.kinesiologistId,
      enforceWindow: true
    });

    if (!evaluation.available) {
      throw new BadRequestError(evaluation.reason, {
        reasonCode: evaluation.reasonCode,
        date: evaluation.date,
        holiday: evaluation.holiday
      });
    }

    return evaluation;
  }

  /**
   * Obtiene el mapa completo de disponibilidad del calendario para el período de reserva [hoy, hoy + 14 días],
   * contemplando también cambios de año (ej. diciembre -> enero).
   * @param {{ referenceDate?: string, fromDate?: string, toDate?: string }} [params]
   */
  async getCalendarAvailability(params = {}) {
    const { minDate, maxDate, maxDays } = this.getBookingWindowBounds(params.referenceDate);
    const startStr = extractDateISO(params.fromDate) || minDate;
    const endStr = extractDateISO(params.toDate) || maxDate;

    const startYear = Number(minDate.slice(0, 4));
    const endYear = Number(maxDate.slice(0, 4));
    const yearsToEnsure = new Set([
      startYear,
      endYear,
      Number(startStr.slice(0, 4)),
      Number(endStr.slice(0, 4))
    ]);

    for (const y of yearsToEnsure) {
      await this.ensureYearHolidays(y);
    }

    const days = [];
    let cursor = startStr;
    let safetyCounter = 0;
    let firstAvailableDate = null;

    while (cursor <= endStr && safetyCounter < 90) {
      const evalResult = await this.evaluateDate(cursor, {
        referenceDate: minDate,
        enforceWindow: true,
        kinesiologistId: params.kinesiologistId
      });
      days.push(evalResult);
      if (evalResult.available && !firstAvailableDate) {
        firstAvailableDate = cursor;
      }
      cursor = addCalendarDays(cursor, 1);
      safetyCounter++;
    }

    // Si el rango consultado no incluía la ventana [minDate, maxDate], calcular igual el primer día hábil disponible
    if (!firstAvailableDate) {
      let winCursor = minDate;
      for (let i = 0; i <= maxDays; i++) {
        const ev = await this.evaluateDate(winCursor, {
          referenceDate: minDate,
          enforceWindow: true,
          kinesiologistId: params.kinesiologistId
        });
        if (ev.available) {
          firstAvailableDate = winCursor;
          break;
        }
        winCursor = addCalendarDays(winCursor, 1);
      }
    }

    return {
      minDate,
      maxDate,
      maxDays,
      firstAvailableDate,
      yearsChecked: Array.from(yearsToEnsure),
      days
    };
  }

  /**
   * Lista los feriados y días no laborables registrados (filtrable por año, alcance o condición opcional).
   */
  async listHolidays({ year, scope, includeOptionalOnly = false } = {}) {
    const targetYear = Number(year) || Number(getClinicDateString().slice(0, 4));
    await this.ensureYearHolidays(targetYear);

    const conditions = ['year = ?'];
    const params = [targetYear];

    if (scope) {
      conditions.push('scope = ?');
      params.push(scope);
    }
    if (includeOptionalOnly) {
      conditions.push('is_optional = 1');
    }

    const rows = await query(
      `SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') as date, year, name,
              holiday_type as holidayType, scope, jurisdiction,
              is_optional as isOptional, is_closed as isClosed, source
       FROM clinic_holidays
       WHERE ${conditions.join(' AND ')}
       ORDER BY holiday_date ASC, id ASC`,
      params
    );

    return rows.map((r) => ({
      ...r,
      isOptional: Boolean(r.isOptional),
      isClosed: r.isOptional ? Boolean(r.isClosed) : true
    }));
  }

  /**
   * Crea o configura un feriado (provincial, municipal, institucional) o un día no laborable opcional.
   * Si es un feriado oficial (`isOptional === false`), `isClosed` se fuerza a `true`.
   * Si es un día no laborable opcional (`isOptional === true`), `isClosed` puede configurarse en `true` o `false`.
   */
  async configureHoliday({
    date,
    name,
    holidayType = 'no_laborable',
    scope = 'clinic',
    jurisdiction = 'Consultorio',
    isOptional = true,
    isClosed = true
  }) {
    const dateStr = extractDateISO(date);
    if (!dateStr) {
      throw new BadRequestError('Fecha inválida para configuración de feriado o día no laborable.');
    }
    if (!name || String(name).trim().length < 2) {
      throw new BadRequestError('El nombre o motivo del feriado/día no laborable es obligatorio.');
    }

    const year = Number(dateStr.slice(0, 4));
    const optionalFlag = isOptional ? 1 : 0;
    // Regla: feriados oficiales siempre cerrados; opcionales configurables
    const closedFlag = optionalFlag ? (isClosed ? 1 : 0) : 1;

    await query(
      `INSERT INTO clinic_holidays
        (holiday_date, year, name, holiday_type, scope, jurisdiction, is_optional, is_closed, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         holiday_type = VALUES(holiday_type),
         jurisdiction = VALUES(jurisdiction),
         is_optional = VALUES(is_optional),
         is_closed = VALUES(is_closed)`,
      [
        dateStr,
        year,
        String(name).trim(),
        String(holidayType).trim(),
        scope,
        String(jurisdiction).trim(),
        optionalFlag,
        closedFlag
      ]
    );

    await query(
      `INSERT INTO holiday_sync_status (year, source, holidays_count)
       VALUES (?, 'manual', 1)
       ON DUPLICATE KEY UPDATE synced_at = CURRENT_TIMESTAMP`,
      [year]
    );

    this.invalidateCache(year);

    const rows = await query(
      `SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') as date, year, name,
              holiday_type as holidayType, scope, jurisdiction,
              is_optional as isOptional, is_closed as isClosed, source
       FROM clinic_holidays
       WHERE holiday_date = ? AND scope = ?
       LIMIT 1`,
      [dateStr, scope]
    );

    return rows[0]
      ? {
          ...rows[0],
          isOptional: Boolean(rows[0].isOptional),
          isClosed: rows[0].isOptional ? Boolean(rows[0].isClosed) : true
        }
      : null;
  }

  /**
   * Actualiza la configuración de un día no laborable opcional por su ID o fecha.
   * Si se intenta marcar como laborable (`isClosed: false`) un feriado oficial no opcional, se rechaza.
   */
  async updateOptionalDayStatus({ id, date, scope, isClosed }) {
    let rows = [];
    if (id) {
      rows = await query(
        `SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') as date, year, name,
                holiday_type, scope, is_optional, is_closed
         FROM clinic_holidays WHERE id = ? LIMIT 1`,
        [id]
      );
    } else if (date) {
      const dateStr = extractDateISO(date);
      const params = [dateStr];
      let sql = `SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') as date, year, name,
                        holiday_type, scope, is_optional, is_closed
                 FROM clinic_holidays WHERE holiday_date = ?`;
      if (scope) {
        sql += ' AND scope = ?';
        params.push(scope);
      }
      sql += ' LIMIT 1';
      rows = await query(sql, params);
    }

    if (rows.length === 0) {
      throw new NotFoundError('Registro de feriado o día no laborable no encontrado');
    }

    const target = rows[0];
    if (!target.is_optional && isClosed === false) {
      throw new BadRequestError(
        `El feriado oficial "${target.name}" es de cierre obligatorio y no puede configurarse como laborable.`
      );
    }

    const closedFlag = isClosed ? 1 : 0;
    await query('UPDATE clinic_holidays SET is_closed = ? WHERE id = ?', [closedFlag, target.id]);
    this.invalidateCache(target.year);

    return {
      id: target.id,
      date: target.date,
      year: target.year,
      name: target.name,
      scope: target.scope,
      isOptional: Boolean(target.is_optional),
      isClosed: Boolean(closedFlag)
    };
  }
}

export const holidayService = new HolidayService();

