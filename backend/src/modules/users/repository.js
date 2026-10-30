/**
 * @file repository.js
 * @module users
 * @description Acceso a datos para usuarios y roles en MySQL.
 */
import { query } from '../../config/database.js';

export class UsersRepository {
  async searchUsers({ roleId, role, search, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (roleId) {
      conditions.push('u.role_id = ?');
      params.push(roleId);
    }
    if (role) {
      conditions.push('r.name = ?');
      params.push(role);
    }
    if (search) {
      conditions.push('(u.name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.dni LIKE ? OR u.license_number LIKE ? OR u.specialty LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.dni, u.email, u.phone, u.license_number, u.specialty, u.is_active, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.dni, u.email, u.phone, u.license_number, u.specialty, u.is_active, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async updateUser(id, fields) {
    const updates = [];
    const params = [];

    if (fields.roleId !== undefined) {
      updates.push('role_id = ?');
      params.push(fields.roleId);
    }
    if (fields.name !== undefined) {
      updates.push('name = ?');
      params.push(fields.name);
    }
    if (fields.lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(fields.lastName);
    }
    if (fields.dni !== undefined) {
      updates.push('dni = ?');
      params.push(fields.dni);
    }
    if (fields.phone !== undefined) {
      updates.push('phone = ?');
      params.push(fields.phone);
    }
    if (fields.licenseNumber !== undefined) {
      updates.push('license_number = ?');
      params.push(fields.licenseNumber);
    }
    if (fields.specialty !== undefined) {
      updates.push('specialty = ?');
      params.push(fields.specialty);
    }
    if (fields.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(fields.isActive ? 1 : 0);
    }

    if (updates.length === 0) return;

    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async softDelete(id) {
    await query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  }
}

export const usersRepository = new UsersRepository();
