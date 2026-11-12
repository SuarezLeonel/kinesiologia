/**
 * @file date.ts
 * @description Utilidades centralizadas de fecha y hora para el consultorio de kinesiología.
 * Zona horaria oficial: America/Argentina/Buenos_Aires (UTC-3).
 * Garantiza consistencia absoluta en visualización de turnos para Administradores, Kinesiólogos,
 * Recepcionistas y Pacientes, evitando desfasajes por zona horaria de servidor o dispositivo.
 */

export const CLINIC_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la fecha en formato 'YYYY-MM-DD' en la zona horaria de la clínica.
 * Funciona de manera determinista ante cadenas SQL ('2026-11-12 15:00:00'),
 * ISO con Z ('2026-11-12T18:00:00.000Z') o instancias Date.
 */
export function getClinicDateStr(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    // Si viene como 'YYYY-MM-DD HH:mm:ss' o 'YYYY-MM-DDTHH:mm:ss' (sin Z ni offset)
    const localMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (localMatch && !raw.includes('Z') && !raw.includes('+') && !raw.match(/-\d{2}:\d{2}$/)) {
      return localMatch[1];
    }
  }
  const d = typeof raw === 'string' ? new Date(raw) : raw;
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Obtiene la hora en formato 'HH:mm' en la zona horaria de la clínica.
 * Evita desfasajes de huso horario entre distintos usuarios y servidores.
 */
export function getClinicTimeStr(raw: string | Date | null | undefined, fallback = '10:00'): string {
  if (!raw) return fallback;
  if (typeof raw === 'string') {
    // Si viene como 'YYYY-MM-DD HH:mm:ss' o 'YYYY-MM-DDTHH:mm:ss' (sin Z ni offset)
    const localMatch = raw.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
    if (localMatch && !raw.includes('Z') && !raw.includes('+') && !raw.match(/-\d{2}:\d{2}$/)) {
      return `${localMatch[1]}:${localMatch[2]}`;
    }
  }
  const d = typeof raw === 'string' ? new Date(raw) : raw;
  if (!d || isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: CLINIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

/**
 * Formatea una fecha completa en español: 'Jueves 12 de noviembre de 2026'
 */
export function formatFullSpanishDate(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const dateStr = getClinicDateStr(raw);
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return String(raw);

  const [y, m, d] = dateStr.split('-').map(Number);
  // Mediodía local para evitar cualquier salto de día
  const safeDate = new Date(y, m - 1, d, 12, 0, 0);
  const formatted = safeDate.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Formatea fecha y hora combinadas: 'Jueves 12/11/2026 a las 15:00 hs'
 */
export function formatAppointmentDateTime(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const dateStr = getClinicDateStr(raw);
  const timeStr = getClinicTimeStr(raw);
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const safeDate = new Date(y, m - 1, d, 12, 0, 0);
  const shortDate = safeDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return `${shortDate} a las ${timeStr} hs`;
}

