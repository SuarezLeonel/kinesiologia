import { usersRepository } from './repository.js';
import { authRepository } from '../auth/repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
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

  async createUser({ roleId, name, lastName, email, password, phone }) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = await authRepository.createUser({ roleId, name, lastName, email, passwordHash, phone });
    return await usersRepository.findById(id);
  }

  async updateUser(id, fields) {
    await this.getUserDetail(id);
    await usersRepository.updateUser(id, fields);
    return await usersRepository.findById(id);
  }

  async deleteUser(id) {
    await this.getUserDetail(id);
    await usersRepository.softDelete(id);
    return { success: true };
  }
}

export const usersService = new UsersService();
