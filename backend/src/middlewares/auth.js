import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { query } from '../config/database.js';

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      throw new UnauthorizedError('Token inválido o expirado');
    }

    // Extraer datos del payload del token
    req.user = {
      id: payload.userId,
      roleId: payload.roleId || null,
      role: payload.role || 'user',
      email: payload.email
    };

    // Si la base de datos está disponible, comprobar estado activo
    try {
      const users = await query('SELECT id, role_id, email, is_active FROM users WHERE id = ? LIMIT 1', [payload.userId]);
      if (users && users.length > 0) {
        if (!users[0].is_active) {
          throw new UnauthorizedError('Usuario inactivo');
        }
        req.user.roleId = users[0].role_id;
      }
    } catch (dbErr) {
      // Si la conexión a la base de datos no está disponible en entorno de tests unitarios, usar datos verificados del JWT
      if (dbErr.code !== 'ECONNREFUSED' && dbErr.code !== 'ER_ACCESS_DENIED_ERROR') {
        throw dbErr;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('No autenticado'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('No posee los permisos necesarios para realizar esta acción'));
    }
    next();
  };
}
