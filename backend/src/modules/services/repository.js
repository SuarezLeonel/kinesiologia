/**
 * @file repository.js
 * @module services
 * @description Acceso a datos para prestaciones kinésicas, duraciones sugeridas y precios vigentes.
 */
import { query } from '../../config/database.js';

export class ServicesRepository {
  async search({ isActive = true, search }) {
    const conditions = [];
    const params = [];

    if (isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return await query(`
      SELECT id, name, description, duration_minutes, default_price, is_active, created_at, updated_at
      FROM services
      ${where}
      ORDER BY name ASC
    `, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT id, name, description, duration_minutes, default_price, is_active, created_at, updated_at
      FROM services
      WHERE id = ?
      LIMIT 1
    `, [id]);

    return rows[0] || null;
  }

  async create(data) {
    const result = await query(`
      INSERT INTO services (name, description, duration_minutes, default_price, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [
      data.name,
      data.description || null,
      data.durationMinutes || 45,
      data.defaultPrice || 0
    ]);

    return result.insertId;
  }

  async update(id, fields) {
    const updates = [];
    const params = [];

    if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
    if (fields.description !== undefined) { updates.push('description = ?'); params.push(fields.description); }
    if (fields.durationMinutes !== undefined) { updates.push('duration_minutes = ?'); params.push(fields.durationMinutes); }
    if (fields.defaultPrice !== undefined) { updates.push('default_price = ?'); params.push(fields.defaultPrice); }
    if (fields.isActive !== undefined) { updates.push('is_active = ?'); params.push(fields.isActive ? 1 : 0); }

    if (!updates.length) return;
    params.push(id);
    await query(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

export const servicesRepository = new ServicesRepository();
