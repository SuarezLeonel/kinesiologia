/**
 * @file rateLimit.js
 * @description Política centralizada de Rate Limiting basada únicamente en `NODE_ENV`.
 * En `NODE_ENV=development` desactiva el rate limiting de las operaciones habituales
 * manteniendo intacta la protección contra fuerza bruta en login y recuperación de contraseña.
 * Cuando `NODE_ENV=production` o no está definido, aplica los límites seguros de producción.
 */
import rateLimit from 'express-rate-limit';

/**
 * Indica si el modo desarrollo para rate limiting está activo.
 * Solo retorna `true` cuando `process.env.NODE_ENV === 'development'`.
 * Si `NODE_ENV` no está definido, retorna `false` (comportamiento seguro de producción).
 * @returns {boolean}
 */
export function isRateLimitDevelopmentMode() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Crea un middleware de rate limiting respetando el entorno `NODE_ENV`.
 * @param {object} options
 * @param {number} options.max - Límite máximo de solicitudes en la ventana.
 * @param {number} options.windowMs - Duración de la ventana en milisegundos.
 * @param {string} options.message - Mensaje devuelto ante código HTTP 429.
 * @param {boolean} [options.preserveInDevelopment=false] - Si es true, mantiene la protección en `NODE_ENV=development` (ej. login y recuperación).
 * @param {Function} [options.keyGenerator] - Generador opcional de clave por IP/identificador.
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
export function createRateLimiter({
  max,
  windowMs,
  message,
  preserveInDevelopment = false,
  keyGenerator
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    ...(keyGenerator ? { keyGenerator } : {}),
    skip: preserveInDevelopment ? undefined : () => isRateLimitDevelopmentMode(),
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message
      }
    }
  });
}

