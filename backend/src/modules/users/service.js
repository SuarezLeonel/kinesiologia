/**
 * @file service.js
 * @module users
 * @description Lógica de administración de usuarios y trazabilidad de cambios de permisos.
 */
import { usersRepository } from './repository.js';
import { authRepository } from '../auth/repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';
import bcrypt from 'bcryptjs';

export class UsersService {
  async searchUsers(filters) {
    return await usersRepository.searchUsers(filters);
  }

  async getUserDetail(id) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    return user;
  }

  async createUser({ roleId, name, lastName, dni, email, password, phone, licenseNumber, specialty }, currentUser = null) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = await authRepository.createUser({
      roleId,
      name,
      lastName,
      dni,
      email,
      passwordHash,
      phone,
      licenseNumber,
      specialty
    });

    await logAudit({
      userId: currentUser?.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: id,
      details: { roleId, email, name, lastName, dni, licenseNumber, specialty }
    });

    return await usersRepository.findById(id);
  }

  async updateUser(id, fields, currentUser = null) {
    await this.getUserDetail(id);
    await usersRepository.updateUser(id, fields);

    await logAudit({
      userId: currentUser?.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      details: fields
    });

    return await usersRepository.findById(id);
  }

  async deleteUser(id, currentUser = null) {
    await this.getUserDetail(id);
    await usersRepository.softDelete(id);

    await logAudit({
      userId: currentUser?.id,
      action: 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: id
    });

    return { success: true };
  }
}

export const usersService = new UsersService();
