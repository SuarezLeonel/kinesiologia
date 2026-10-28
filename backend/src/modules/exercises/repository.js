import { query } from '../../config/database.js';

export class ExercisesRepository {
  async search({ category, search, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = ['is_active = 1'];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR instructions LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    return await query(`
      SELECT id, name, category, description, instructions, default_sets, default_repetitions, media_url, is_active, created_at
      FROM exercises
      ${where}
      ORDER BY category ASC, name ASC
      LIMIT ? OFFSET ?
    `, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT id, name, category, description, instructions, default_sets, default_repetitions, media_url, is_active, created_at, updated_at
      FROM exercises
      WHERE id = ?
      LIMIT 1
    `, [id]);

    return rows[0] || null;
  }

  async create(data) {
    const result = await query(`
      INSERT INTO exercises (name, category, description, instructions, default_sets, default_repetitions, media_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      data.name,
      data.category,
      data.description,
      data.instructions,
      data.defaultSets || null,
      data.defaultRepetitions || null,
      data.mediaUrl || null
    ]);

    return result.insertId;
  }

  async update(id, fields) {
    const updates = [];
    const params = [];

    if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
    if (fields.category !== undefined) { updates.push('category = ?'); params.push(fields.category); }
    if (fields.description !== undefined) { updates.push('description = ?'); params.push(fields.description); }
    if (fields.instructions !== undefined) { updates.push('instructions = ?'); params.push(fields.instructions); }
    if (fields.defaultSets !== undefined) { updates.push('default_sets = ?'); params.push(fields.defaultSets); }
    if (fields.defaultRepetitions !== undefined) { updates.push('default_repetitions = ?'); params.push(fields.defaultRepetitions); }
    if (fields.mediaUrl !== undefined) { updates.push('media_url = ?'); params.push(fields.mediaUrl); }
    if (fields.isActive !== undefined) { updates.push('is_active = ?'); params.push(fields.isActive ? 1 : 0); }

    if (!updates.length) return;
    params.push(id);
    await query(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async softDelete(id) {
    await query('UPDATE exercises SET is_active = 0 WHERE id = ?', [id]);
  }
}

export const exercisesRepository = new ExercisesRepository();
