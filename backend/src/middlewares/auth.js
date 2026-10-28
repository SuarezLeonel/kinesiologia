import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { authRepository } from '../modules/auth/repository.js';

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
    } catch {
      throw new UnauthorizedError('Token inválido o expirado');
    }

    // Solo los tokens de acceso son válidos aquí (se rechazan tokens de reset u otros propósitos)
    if (payload.type !== 'access' || !payload.userId) {
      throw new UnauthorizedError('Token inválido o expirado');
    }

    // Identidad, rol y estado se leen SIEMPRE de la base (fail-closed): si la consulta falla,
    // el error se propaga y la petición no se autentica.
    const user = await authRepository.findUserById(payload.userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Usuario inactivo o no encontrado');
    }

    req.user = {
      id: user.id,
      roleId: user.role_id,
      role: user.role_name,
      email: user.email,
      permissions: user.permissions || []
    };

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

export function authorizePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('No autenticado'));
    }
    // El rol admin siempre tiene autorización total
    if (req.user.role === 'admin' || (req.user.permissions && req.user.permissions.includes(permissionCode))) {
      return next();
    }
    return next(new ForbiddenError(`Permiso requerido no concedido: ${permissionCode}`));
  };
}
