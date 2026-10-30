/**
 * @file response.js
 * @description Utilidades de estandarización de respuestas HTTP exitosas para la API de KinesioGestión.
 * Garantiza una estructura uniforme `{ success: true, message: string, data: any }`.
 */

/**
 * Envía una respuesta HTTP exitosa estandarizada con formato JSON.
 * @param {import('express').Response} res - Objeto Response de Express.
 * @param {*} [data=null] - Datos o carga útil a devolver al cliente.
 * @param {string} [message='Operación exitosa'] - Mensaje descriptivo de la acción realizada.
 * @param {number} [statusCode=200] - Código de estado HTTP (200 OK, 201 Created).
 * @returns {import('express').Response}
 */
export function sendSuccess(res, data = null, message = 'Operación exitosa', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}
