/**
 * @file validate.js
 * @description Middleware para validación de esquemas Zod en solicitudes HTTP entrantes.
 * Valida de forma síncrona/asíncrona el body, query y params, sanitizando y reemplazando
 * las propiedades validadas en el objeto request de Express.
 */

/**
 * Genera un middleware de validación a partir de un esquema de Zod.
 * @param {import('zod').ZodSchema} schema - Esquema de Zod que define la estructura esperada de body/params/query.
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      req.body = parsed.body || req.body;
      req.query = parsed.query || req.query;
      req.params = parsed.params || req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
}
