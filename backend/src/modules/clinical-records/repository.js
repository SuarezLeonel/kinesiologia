import { query, executeTransaction } from '../../config/database.js';

export class ClinicalRecordsRepository {
  async searchByPatient({ patientId, search, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT cr.id, cr.patient_id, cr.author_id, u.name as author_name, u.last_name as author_last_name,
             p.first_name as patient_first_name, p.last_name as patient_last_name, p.dni as patient_dni,
             cr.consultation_reason, cr.diagnosis, cr.reported_pain_level, cr.created_at, cr.updated_at
      FROM clinical_records cr
      JOIN users u ON cr.author_id = u.id
      JOIN patients p ON cr.patient_id = p.id
    `;
    const params = [];
    const where = [];
    if (patientId) {
      where.push('cr.patient_id = ?');
      params.push(patientId);
    }
    if (search && search.trim()) {
      where.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.dni LIKE ? OR cr.diagnosis LIKE ? OR cr.consultation_reason LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }
    sql += ' ORDER BY cr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT cr.*,
             u.name as author_name, u.last_name as author_last_name, u.email as author_email,
             u.phone as author_phone, u.license_number as author_license, u.specialty as author_specialty,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.dni as patient_dni, p.birth_date as patient_birth_date,
             p.phone as patient_phone, p.email as patient_email, p.address as patient_address
      FROM clinical_records cr
      JOIN users u ON cr.author_id = u.id
      JOIN patients p ON cr.patient_id = p.id
      WHERE cr.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findSessionsByClinicalRecordId(clinicalRecordId) {
    return await query(`
      SELECT ts.id, ts.session_number, ts.session_date, ts.performed_procedures,
             ts.patient_evolution, ts.pain_level_reported, ts.observations,
             u.name as kinesio_name, u.last_name as kinesio_last_name
      FROM treatment_sessions ts
      JOIN treatments t ON ts.treatment_id = t.id
      JOIN users u ON ts.kinesiologist_id = u.id
      WHERE t.clinical_record_id = ?
      ORDER BY ts.session_number ASC
    `, [clinicalRecordId]);
  }

  async create(data) {
    const result = await query(`
      INSERT INTO clinical_records (
        patient_id, author_id, consultation_reason, medical_history, initial_evaluation,
        diagnosis, reported_pain_level, mobility_evaluation, functional_limitations,
        treatment_goals, general_observations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.patientId,
      data.authorId,
      data.consultationReason,
      data.medicalHistory || null,
      data.initialEvaluation,
      data.diagnosis,
      data.reportedPainLevel ?? null,
      data.mobilityEvaluation || null,
      data.functionalLimitations || null,
      data.treatmentGoals || null,
      data.generalObservations || null
    ]);
    return result.insertId;
  }

  async updateWithVersion(id, fields, authorId) {
    return await executeTransaction(async (conn) => {
      // 1. Obtener registro previo para snapshot
      const [previous] = await conn.execute('SELECT diagnosis, initial_evaluation FROM clinical_records WHERE id = ?', [id]);
      if (previous.length > 0) {
        await conn.execute(`
          INSERT INTO clinical_record_versions (clinical_record_id, edited_by, diagnosis_snapshot, evaluation_snapshot, change_reason)
          VALUES (?, ?, ?, ?, ?)
        `, [id, authorId, previous[0].diagnosis, previous[0].initial_evaluation, fields.changeReason]);
      }

      // 2. Actualizar registro principal
      const updates = [];
      const params = [];
      if (fields.consultationReason) { updates.push('consultation_reason = ?'); params.push(fields.consultationReason); }
      if (fields.diagnosis) { updates.push('diagnosis = ?'); params.push(fields.diagnosis); }
      if (fields.initialEvaluation) { updates.push('initial_evaluation = ?'); params.push(fields.initialEvaluation); }
      if (fields.reportedPainLevel !== undefined) { updates.push('reported_pain_level = ?'); params.push(fields.reportedPainLevel); }
      if (fields.generalObservations) { updates.push('general_observations = ?'); params.push(fields.generalObservations); }

      if (updates.length > 0) {
        params.push(id);
        await conn.execute(`UPDATE clinical_records SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    });
  }
}

export const clinicalRecordsRepository = new ClinicalRecordsRepository();
