import { usersService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class UsersController {
  async search(req, res, next) {
    try {
      const results = await usersService.searchUsers(req.body);
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const user = await usersService.getUserDetail(req.body.id);
      return sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = await usersService.createUser(req.body);
      return sendSuccess(res, user, 'Usuario creado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await usersService.updateUser(req.params.id, req.body);
      return sendSuccess(res, updated, 'Usuario actualizado');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await usersService.deleteUser(req.params.id);
      return sendSuccess(res, result, 'Usuario desactivado');
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
