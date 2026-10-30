/**
 * @file errors.js
 * @description Jerarquía de clases de error personalizadas para el backend de KinesioGestión.
 * Permite tipificar errores HTTP con códigos estandarizados y mensajes amigables,
 * facilitando su captura y formateo en el errorHandler centralizado.
 */

/**
 * Clase base para errores operativos de la aplicación.
 * @extends Error
 */
export class AppError extends Error {
  /**
   * Crea una instancia de AppError.
   * @param {string} message - Mensaje descriptivo del error.
   * @param {number} [statusCode=400] - Código de estado HTTP asociado.
   * @param {string} [errorCode='BAD_REQUEST'] - Código textual identificador del error.
   * @param {Array|Object|null} [details=null] - Detalles complementarios o errores de validación por campo.
   */
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error 404: Indica que el recurso solicitado no existe en la base de datos o el sistema.
 * @extends AppError
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message='Recurso no encontrado']
   */
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Error 401: Indica que la petición no posee credenciales válidas o el token ha expirado.
 * @extends AppError
 */
export class UnauthorizedError extends AppError {
  /**
   * @param {string} [message='No autorizado']
   */
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Error 403: Indica que el usuario está autenticado pero no tiene permisos para la acción solicitada.
 * (Ejemplo: Recepcionista intentando acceder a historias clínicas).
 * @extends AppError
 */
export class ForbiddenError extends AppError {
  /**
   * @param {string} [message='Acceso denegado']
   */
  constructor(message = 'Acceso denegado') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error 409: Conflicto con el estado actual del recurso (ej. duplicados, turnos superpuestos).
 * @extends AppError
 */
export class ConflictError extends AppError {
  /**
   * @param {string} [message='Conflicto con el recurso existente']
   */
  constructor(message = 'Conflicto con el recurso existente') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Error 422: Datos de entrada no superan los esquemas de validación Zod.
 * @extends AppError
 */
export class ValidationError extends AppError {
  /**
   * @param {string} [message='Error de validación']
   * @param {Array|Object|null} [details=null] - Lista detallada de campos inválidos y mensajes.
   */
  constructor(message = 'Error de validación', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}
