import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // Manejo de errores Zod (compatible con Zod 3 y Zod 4)
  if (err instanceof ZodError || err.name === 'ZodError') {
    const issues = err.issues || err.errors || [];
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos proporcionados no son válidos',
        details: issues.map(e => ({
          field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
          message: e.message
        }))
      }
    });
  }

  // Manejo de AppError personalizado
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details || null
      }
    });
  }

  // Errores de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Ya existe un registro con esos datos únicos'
      }
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es un JSON válido' }
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande' }
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({
      success: false,
      error: { code: 'INVALID_REFERENCE', message: 'Se referencia un registro que no existe' }
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      success: false,
      error: { code: 'RECORD_IN_USE', message: 'El registro está en uso y no puede eliminarse' }
    });
  }

  if (['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(err.code)) {
    console.error(`[ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}: base de datos no disponible (${err.code})`);
    return res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible temporalmente' }
    });
  }

  // Log seguro sin filtrar tokens ni datos clínicos
  console.error(`[ERROR] ${new Date().toISOString()} ${req.method} ${req.originalUrl}:`, err.message);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado en el servidor'
    }
  });
}
