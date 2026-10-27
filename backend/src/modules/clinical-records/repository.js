import { query, executeTransaction } from '../../config/database.js';

export class ClinicalRecordsRepository {
  async searchByPatient({ patientId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const sql = `
      SELECT cr.id, cr.patient_id, cr.author_id, u.name as author_name, u.last_name as author_last_name,
             cr.consultation_reason, cr.diagnosis, cr.reported_pain_level, cr.created_at, cr.updated_at
      FROM clinical_records cr
      JOIN users u ON cr.author_id = u.id
      WHERE cr.patient_id = ?
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    return await query(sql, [patientId, limit, offset]);
  }

  async findById(id) {
    const rows = await query(`
      SELECT cr.*, u.name as author_name, u.last_name as author_last_name
      FROM clinical_records cr
      JOIN users u ON cr.author_id = u.id
      WHERE cr.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
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
