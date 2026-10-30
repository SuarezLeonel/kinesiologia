/**
 * @file auditLogger.js
 * @description Módulo de trazabilidad y registro inmutable de auditoría para KinesioGestión.
 * Almacena en la tabla audit_logs eventos críticos como inicios de sesión, cambios de roles,
 * rectificaciones clínicas y transacciones de cobro.
 */

import { query } from '../config/database.js';

/**
 * Registra una acción sensible en la tabla audit_logs de forma estructurada.
 * No propaga fallos de logging para no bloquear la operación de negocio, pero emite alerta a consola.
 * @param {Object} params - Parámetros de la acción a auditar.
 * @param {number|null} [params.userId=null] - Identificador del usuario que ejecuta la acción.
 * @param {string} params.action - Nombre normalizado de la acción (ej. 'LOGIN', 'ROLE_CHANGE', 'CLINICAL_RECORD_UPDATE').
 * @param {string} params.entityType - Tipo de entidad afectada (ej. 'users', 'clinical_records', 'payments').
 * @param {string|number} params.entityId - Identificador único de la entidad afectada.
 * @param {Object|null} [params.details=null] - Metadatos adicionales o valores anteriores/nuevos.
 * @param {string|null} [params.ipAddress=null] - Dirección IP de origen de la solicitud.
 * @returns {Promise<void>}
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
