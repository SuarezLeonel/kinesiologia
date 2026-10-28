import { query } from '../config/database.js';

/**
 * Registra una acción sensible en la tabla audit_logs de forma estructurada.
 * No propaga fallos de logging para no bloquear la operación de negocio, pero emite alerta a consola.
 */
export async function logAudit({
  userId = null,
  action,
  entityType,
  entityId,
  details = null,
  ipAddress = null
}) {
  try {
    const detailsJson = details ? JSON.stringify(details) : null;
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, String(entityId), detailsJson, ipAddress]
    );
  } catch (err) {
    console.error(`[AUDIT_ERROR] No se pudo escribir log de auditoría (${action} sobre ${entityType}:${entityId}):`, err.message);
  }
}
