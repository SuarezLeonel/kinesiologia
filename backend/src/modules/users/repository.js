import { query } from '../../config/database.js';

export class UsersRepository {
  async searchUsers({ roleId, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (roleId) {
      conditions.push('u.role_id = ?');
      params.push(roleId);
    }
    if (search) {
      conditions.push('(u.name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.email, u.phone, u.is_active, u.created_at
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
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.email, u.phone, u.is_active, u.created_at
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
    if (fields.phone !== undefined) {
      updates.push('phone = ?');
      params.push(fields.phone);
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
