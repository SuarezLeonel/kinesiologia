/**
 * @file repository.js
 * @module exercises
 * @description Acceso a datos para el catálogo clínico de ejercicios, categorías y parámetros por defecto.
 */
import { query } from '../../config/database.js';

function mapExerciseRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    description: row.description,
    instructions: row.instructions,
    bodyZone: row.body_zone || null,
    body_zone: row.body_zone || null,
    muscleGroup: row.muscle_group || null,
    muscle_group: row.muscle_group || null,
    therapeuticObjective: row.therapeutic_objective || null,
    therapeutic_objective: row.therapeutic_objective || null,
    equipmentNeeded: row.equipment_needed || null,
    equipment_needed: row.equipment_needed || null,
    difficultyLevel: row.difficulty_level || 'Bajo',
    difficulty_level: row.difficulty_level || 'Bajo',
    contraindications: row.contraindications || null,
    defaultSets: row.default_sets !== null && row.default_sets !== undefined ? Number(row.default_sets) : 3,
    default_sets: row.default_sets !== null && row.default_sets !== undefined ? Number(row.default_sets) : 3,
    defaultRepetitions: row.default_repetitions !== null && row.default_repetitions !== undefined ? Number(row.default_repetitions) : 10,
    default_repetitions: row.default_repetitions !== null && row.default_repetitions !== undefined ? Number(row.default_repetitions) : 10,
    mediaUrl: row.media_url || null,
    media_url: row.media_url || null,
    isActive: Boolean(row.is_active),
    is_active: Number(row.is_active),
    inUseCount: row.in_use_count !== undefined ? Number(row.in_use_count) : 0,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

export class ExercisesRepository {
  async search({
    category,
    search,
    bodyZone,
    muscleGroup,
    therapeuticObjective,
    difficultyLevel,
    equipmentNeeded,
    isActive,
    page = 1,
    limit = 20
  }) {
    const conditions = [];
    const params = [];

    if (isActive !== undefined && isActive !== null) {
      conditions.push('e.is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (category) {
      conditions.push('e.category = ?');
      params.push(category);
    }

    if (bodyZone) {
      conditions.push('e.body_zone = ?');
      params.push(bodyZone);
    }

    if (muscleGroup) {
      conditions.push('e.muscle_group LIKE ?');
      params.push(`%${muscleGroup}%`);
    }

    if (therapeuticObjective) {
      conditions.push('e.therapeutic_objective = ?');
      params.push(therapeuticObjective);
    }

    if (difficultyLevel) {
      conditions.push('e.difficulty_level = ?');
      params.push(difficultyLevel);
    }

    if (equipmentNeeded) {
      conditions.push('e.equipment_needed = ?');
      params.push(equipmentNeeded);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        '(e.name LIKE ? OR e.description LIKE ? OR e.instructions LIKE ? OR e.body_zone LIKE ? OR e.muscle_group LIKE ? OR e.therapeutic_objective LIKE ? OR e.equipment_needed LIKE ?)'
      );
      params.push(term, term, term, term, term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Consulta total para paginación
    const countSql = `SELECT COUNT(*) as total FROM exercises e ${where}`;
    const countRows = await query(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    // Consulta paginada de registros
    const offset = Math.max(0, (page - 1) * limit);
    const dataParams = [...params, Number(limit), Number(offset)];
    const dataSql = `
      SELECT e.id, e.name, e.category, e.description, e.instructions,
             e.body_zone, e.muscle_group, e.therapeutic_objective, e.equipment_needed,
             e.difficulty_level, e.contraindications, e.default_sets, e.default_repetitions,
             e.media_url, e.is_active, e.created_at, e.updated_at,
             (SELECT COUNT(*) FROM treatment_exercises te WHERE te.exercise_id = e.id) as in_use_count
      FROM exercises e
      ${where}
      ORDER BY e.is_active DESC, e.category ASC, e.name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(dataSql, dataParams);

    return {
      items: rows.map(mapExerciseRow),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async findById(id) {
    const rows = await query(`
      SELECT e.id, e.name, e.category, e.description, e.instructions,
             e.body_zone, e.muscle_group, e.therapeutic_objective, e.equipment_needed,
             e.difficulty_level, e.contraindications, e.default_sets, e.default_repetitions,
             e.media_url, e.is_active, e.created_at, e.updated_at,
             (SELECT COUNT(*) FROM treatment_exercises te WHERE te.exercise_id = e.id) as in_use_count
      FROM exercises e
      WHERE e.id = ?
      LIMIT 1
    `, [id]);

    return rows[0] ? mapExerciseRow(rows[0]) : null;
  }

  async create(data) {
    const result = await query(`
      INSERT INTO exercises (
        name, category, description, instructions,
        body_zone, muscle_group, therapeutic_objective, equipment_needed,
        difficulty_level, contraindications, default_sets, default_repetitions,
        media_url, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.category,
      data.description,
      data.instructions,
      data.bodyZone || data.body_zone || null,
      data.muscleGroup || data.muscle_group || null,
      data.therapeuticObjective || data.therapeutic_objective || null,
      data.equipmentNeeded || data.equipment_needed || null,
      data.difficultyLevel || data.difficulty_level || 'Bajo',
      data.contraindications || null,
      data.defaultSets ?? data.default_sets ?? null,
      data.defaultRepetitions ?? data.default_repetitions ?? null,
      data.mediaUrl || data.media_url || null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : (data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1)
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
    
    const bodyZone = fields.bodyZone !== undefined ? fields.bodyZone : fields.body_zone;
    if (bodyZone !== undefined) { updates.push('body_zone = ?'); params.push(bodyZone || null); }

    const muscleGroup = fields.muscleGroup !== undefined ? fields.muscleGroup : fields.muscle_group;
    if (muscleGroup !== undefined) { updates.push('muscle_group = ?'); params.push(muscleGroup || null); }

    const therapeuticObjective = fields.therapeuticObjective !== undefined ? fields.therapeuticObjective : fields.therapeutic_objective;
    if (therapeuticObjective !== undefined) { updates.push('therapeutic_objective = ?'); params.push(therapeuticObjective || null); }

    const equipmentNeeded = fields.equipmentNeeded !== undefined ? fields.equipmentNeeded : fields.equipment_needed;
    if (equipmentNeeded !== undefined) { updates.push('equipment_needed = ?'); params.push(equipmentNeeded || null); }

    const difficultyLevel = fields.difficultyLevel !== undefined ? fields.difficultyLevel : fields.difficulty_level;
    if (difficultyLevel !== undefined) { updates.push('difficulty_level = ?'); params.push(difficultyLevel); }

    if (fields.contraindications !== undefined) { updates.push('contraindications = ?'); params.push(fields.contraindications || null); }

    const defaultSets = fields.defaultSets !== undefined ? fields.defaultSets : fields.default_sets;
    if (defaultSets !== undefined) { updates.push('default_sets = ?'); params.push(defaultSets !== null ? Number(defaultSets) : null); }

    const defaultRepetitions = fields.defaultRepetitions !== undefined ? fields.defaultRepetitions : fields.default_repetitions;
    if (defaultRepetitions !== undefined) { updates.push('default_repetitions = ?'); params.push(defaultRepetitions !== null ? Number(defaultRepetitions) : null); }

    const mediaUrl = fields.mediaUrl !== undefined ? fields.mediaUrl : fields.media_url;
    if (mediaUrl !== undefined) { updates.push('media_url = ?'); params.push(mediaUrl || null); }

    const isActive = fields.isActive !== undefined ? fields.isActive : fields.is_active;
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (!updates.length) return;
    params.push(id);
    await query(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async toggleActive(id, newStatus) {
    await query('UPDATE exercises SET is_active = ? WHERE id = ?', [newStatus ? 1 : 0, id]);
  }

  async softDelete(id) {
    await query('UPDATE exercises SET is_active = 0 WHERE id = ?', [id]);
  }

  async getInUseCount(id) {
    const rows = await query('SELECT COUNT(*) as count FROM treatment_exercises WHERE exercise_id = ?', [id]);
    return Number(rows[0]?.count || 0);
  }

  async getFilterOptions() {
    const [bodyZonesRows, objectivesRows, equipmentRows, categoriesRows] = await Promise.all([
      query(`SELECT DISTINCT body_zone FROM exercises WHERE body_zone IS NOT NULL AND body_zone != '' ORDER BY body_zone ASC`),
      query(`SELECT DISTINCT therapeutic_objective FROM exercises WHERE therapeutic_objective IS NOT NULL AND therapeutic_objective != '' ORDER BY therapeutic_objective ASC`),
      query(`SELECT DISTINCT equipment_needed FROM exercises WHERE equipment_needed IS NOT NULL AND equipment_needed != '' ORDER BY equipment_needed ASC`),
      query(`SELECT DISTINCT category FROM exercises WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`)
    ]);

    // Opciones base clínicas estándar
    const defaultZones = ['Hombro', 'Columna Lumbar', 'Columna Cervical', 'Pelvis / Cadera', 'Rodilla', 'Tobillo / Pie', 'Core / Tronco'];
    const defaultObjectives = ['Movilidad Articular', 'Fortalecimiento', 'Control Motor', 'Estabilidad del Core', 'Propiocepción', 'Flexibilidad', 'Reeducación de la Marcha'];
    const defaultEquipment = ['Sin equipamiento', 'Banda elástica', 'Mancuernas', 'BOSU / Inestable', 'Fitball', 'Colchoneta', 'Tobilleras'];
    const defaultCategories = ['Movilidad', 'Fortalecimiento', 'Estiramiento', 'Propiocepción', 'Rehabilitación Funcional', 'Isométrico'];

    const mergeUnique = (defaults, dbRows, field) => {
      const dbValues = dbRows.map(r => r[field]).filter(Boolean);
      return Array.from(new Set([...defaults, ...dbValues]));
    };

    return {
      bodyZones: mergeUnique(defaultZones, bodyZonesRows, 'body_zone'),
      therapeuticObjectives: mergeUnique(defaultObjectives, objectivesRows, 'therapeutic_objective'),
      equipmentOptions: mergeUnique(defaultEquipment, equipmentRows, 'equipment_needed'),
      categories: mergeUnique(defaultCategories, categoriesRows, 'category'),
      difficultyLevels: ['Bajo', 'Medio', 'Alto']
    };
  }
}

export const exercisesRepository = new ExercisesRepository();
