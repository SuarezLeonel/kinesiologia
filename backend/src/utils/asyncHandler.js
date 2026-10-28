/**
 * Envuelve una función asíncrona para capturar cualquier promesa rechazada
 * y pasar el error al middleware de errores de Express automáticamente.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
