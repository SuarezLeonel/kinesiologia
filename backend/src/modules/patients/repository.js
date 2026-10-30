/**
 * @file repository.js
 * @module patients
 * @description Acceso a datos para pacientes: búsqueda por DNI/nombre, creación y actualización en MySQL.
 */
import { query } from '../../config/database.js';

export class PatientsRepository {
  async search({ search, assignedKinesiologistId, isActive, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (assignedKinesiologistId) {
      conditions.push('p.assigned_kinesiologist_id = ?');
      params.push(assignedKinesiologistId);
    }
    if (isActive !== undefined) {
      conditions.push('p.is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (search) {
      conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.dni LIKE ? OR p.email LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT p.id, p.first_name, p.last_name, p.dni, p.birth_date, p.phone, p.email, p.address,
             p.assigned_kinesiologist_id, u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             p.user_id, p.is_active, p.created_at
      FROM patients p
      LEFT JOIN users u ON p.assigned_kinesiologist_id = u.id
      ${whereClause}
      ORDER BY p.last_name ASC, p.first_name ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT p.id, p.first_name, p.last_name, p.dni, p.birth_date, p.phone, p.email, p.address,
             p.assigned_kinesiologist_id, u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             p.user_id, p.is_active, p.created_at, p.updated_at
      FROM patients p
      LEFT JOIN users u ON p.assigned_kinesiologist_id = u.id
      WHERE p.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findByDni(dni) {
    const rows = await query('SELECT id, first_name, last_name, dni, email, phone, user_id FROM patients WHERE dni = ? AND is_active = 1 LIMIT 1', [dni]);
    return rows[0] || null;
  }

  async findByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const rows = await query('SELECT id, first_name, last_name, dni, email, phone, user_id FROM patients WHERE LOWER(TRIM(email)) = ? AND is_active = 1 LIMIT 1', [normalized]);
    return rows[0] || null;
  }

  async findPatientUserByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    const rows = await query(`
      SELECT u.id, u.email, u.name, u.last_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(TRIM(u.email)) = ? AND r.name = 'patient' AND u.is_active = 1
      LIMIT 1
    `, [normalized]);
    return rows[0] || null;
  }

  async findByUserId(userId) {
    const rows = await query('SELECT id, first_name, last_name, dni, birth_date, phone, email, address, assigned_kinesiologist_id, user_id, is_active FROM patients WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId]);
    return rows[0] || null;
  }

  async linkUser(patientId, userId) {
    await query('UPDATE patients SET user_id = ? WHERE id = ?', [userId, patientId]);
  }

  async create(data) {
    const result = await query(`
      INSERT INTO patients (first_name, last_name, dni, birth_date, phone, email, address, assigned_kinesiologist_id, user_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      data.firstName,
      data.lastName,
      data.dni,
      data.birthDate,
      data.phone,
      data.email ? String(data.email).trim().toLowerCase() : null,
      data.address || null,
      data.assignedKinesiologistId || null,
      data.userId || null
    ]);
    return result.insertId;
  }

  async update(id, fields) {
    const updates = [];
    const params = [];

    if (fields.firstName !== undefined) { updates.push('first_name = ?'); params.push(fields.firstName); }
    if (fields.lastName !== undefined) { updates.push('last_name = ?'); params.push(fields.lastName); }
    if (fields.dni !== undefined) { updates.push('dni = ?'); params.push(fields.dni); }
    if (fields.birthDate !== undefined) { updates.push('birth_date = ?'); params.push(fields.birthDate); }
    if (fields.phone !== undefined) { updates.push('phone = ?'); params.push(fields.phone); }
    if (fields.email !== undefined) { updates.push('email = ?'); params.push(fields.email ? String(fields.email).trim().toLowerCase() : null); }
    if (fields.address !== undefined) { updates.push('address = ?'); params.push(fields.address); }
    if (fields.assignedKinesiologistId !== undefined) { updates.push('assigned_kinesiologist_id = ?'); params.push(fields.assignedKinesiologistId); }
    if (fields.userId !== undefined) { updates.push('user_id = ?'); params.push(fields.userId); }
    if (fields.isActive !== undefined) { updates.push('is_active = ?'); params.push(fields.isActive ? 1 : 0); }

    if (updates.length === 0) return;
    params.push(id);
    await query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async softDelete(id) {
    await query('UPDATE patients SET is_active = 0 WHERE id = ?', [id]);
  }
}

export const patientsRepository = new PatientsRepository();
