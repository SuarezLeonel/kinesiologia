/**
 * Utilidades de fecha y zona horaria para el consultorio de kinesiología.
 * Zona horaria oficial: America/Argentina/Buenos_Aires (UTC-3).
 */

export const CLINIC_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la fecha actual en formato 'YYYY-MM-DD' según la hora local de Argentina.
 * @param {Date|string|number} [date]
 * @returns {string} Fecha en formato 'YYYY-MM-DD'
 */
export function getClinicDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Obtiene la fecha y hora actual en formato 'YYYY-MM-DD HH:mm:ss' según la hora local de Argentina.
 * @param {Date|string|number} [date]
 * @returns {string} Fecha y hora en formato 'YYYY-MM-DD HH:mm:ss'
 */
export function getClinicDateTimeString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

/**
 * Suma o resta una cantidad exacta de días calendario a una fecha 'YYYY-MM-DD'.
 * @param {string} dateStr - Fecha base 'YYYY-MM-DD'
 * @param {number} days - Cantidad de días corridos a sumar o restar
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
 * Calcula los límites de inicio (00:00:00) y fin (23:59:59.999) de un día en la zona horaria del consultorio.
 * Devuelve objetos Date listos para consultas SQL parametrizadas.
 * @param {string} [dateString] Fecha en formato 'YYYY-MM-DD'. Si no se pasa, usa hoy.
 * @returns {{ date: string, start: Date, end: Date }}
 */
export function getClinicDayBounds(dateString) {
  const targetDate = dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? dateString
    : getClinicDateString();

  // Argentina es UTC-3 (sin horario de verano)
  const start = new Date(`${targetDate}T00:00:00.000-03:00`);
  const end = new Date(`${targetDate}T23:59:59.999-03:00`);

  return {
    date: targetDate,
    start,
    end
  };
}

