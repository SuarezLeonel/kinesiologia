import { query } from '../../config/database.js';

export class TreatmentsRepository {
  async search({ patientId, status, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (patientId) {
      conditions.push('t.patient_id = ?');
      params.push(patientId);
    }
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT t.id, t.patient_id, t.kinesiologist_id, t.clinical_record_id, t.title,
             t.diagnosis_summary, t.objectives, t.total_planned_sessions, t.start_date,
             t.end_date, t.status, t.created_at, t.updated_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             (SELECT COUNT(*) FROM treatment_sessions ts WHERE ts.treatment_id = t.id) as sessions_completed_count
      FROM treatments t
      JOIN patients p ON t.patient_id = p.id
      JOIN users u ON t.kinesiologist_id = u.id
      ${where}
      ORDER BY t.start_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT t.id, t.patient_id, t.kinesiologist_id, t.clinical_record_id, t.title,
             t.diagnosis_summary, t.objectives, t.total_planned_sessions, t.start_date,
             t.end_date, t.status, t.created_at, t.updated_at,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM treatments t
      JOIN patients p ON t.patient_id = p.id
      JOIN users u ON t.kinesiologist_id = u.id
      WHERE t.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async create(data, kinesiologistId) {
    const result = await query(`
      INSERT INTO treatments (
        patient_id, kinesiologist_id, clinical_record_id, title,
        diagnosis_summary, objectives, total_planned_sessions, start_date, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      data.patientId,
      kinesiologistId,
      data.clinicalRecordId || null,
      data.title,
      data.diagnosisSummary,
      data.objectives,
      data.totalPlannedSessions || 10,
      data.startDate
    ]);
    return result.insertId;
  }

  async update(id, fields) {
    const updates = [];
    const params = [];

    if (fields.title !== undefined) { updates.push('title = ?'); params.push(fields.title); }
    if (fields.diagnosisSummary !== undefined) { updates.push('diagnosis_summary = ?'); params.push(fields.diagnosisSummary); }
    if (fields.objectives !== undefined) { updates.push('objectives = ?'); params.push(fields.objectives); }
    if (fields.totalPlannedSessions !== undefined) { updates.push('total_planned_sessions = ?'); params.push(fields.totalPlannedSessions); }
    if (fields.endDate !== undefined) { updates.push('end_date = ?'); params.push(fields.endDate); }
    if (fields.status !== undefined) { updates.push('status = ?'); params.push(fields.status); }

    if (!updates.length) return;
    params.push(id);
    await query(`UPDATE treatments SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // --- Sesiones de Tratamiento ---
  async addSession(data, kinesiologistId) {
    const result = await query(`
      INSERT INTO treatment_sessions (
        treatment_id, appointment_id, kinesiologist_id, session_number,
        session_date, performed_procedures, patient_evolution, pain_level_reported, observations
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.treatmentId,
      data.appointmentId || null,
      kinesiologistId,
      data.sessionNumber,
      data.sessionDate,
      data.performedProcedures,
      data.patientEvolution,
      data.painLevelReported ?? null,
      data.observations || null
    ]);
    return result.insertId;
  }

  async findSessionsByTreatment(treatmentId) {
    return await query(`
      SELECT ts.id, ts.treatment_id, ts.appointment_id, ts.kinesiologist_id, ts.session_number,
             ts.session_date, ts.performed_procedures, ts.patient_evolution, ts.pain_level_reported,
             ts.observations, ts.created_at,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM treatment_sessions ts
      JOIN users u ON ts.kinesiologist_id = u.id
      WHERE ts.treatment_id = ?
      ORDER BY ts.session_number ASC
    `, [treatmentId]);
  }

  // --- Ejercicios de Tratamiento ---
  async addExercise(data) {
    const result = await query(`
      INSERT INTO treatment_exercises (
        treatment_id, exercise_id, custom_sets, custom_repetitions, frequency_instructions, notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        custom_sets = VALUES(custom_sets),
        custom_repetitions = VALUES(custom_repetitions),
        frequency_instructions = VALUES(frequency_instructions),
        notes = VALUES(notes)
    `, [
      data.treatmentId,
      data.exerciseId,
      data.customSets || null,
      data.customRepetitions || null,
      data.frequencyInstructions || null,
      data.notes || null
    ]);
    return result.insertId;
  }

  async removeExercise(treatmentId, exerciseId) {
    await query('DELETE FROM treatment_exercises WHERE treatment_id = ? AND exercise_id = ?', [treatmentId, exerciseId]);
  }

  async findExercisesByTreatment(treatmentId) {
    return await query(`
      SELECT te.id, te.treatment_id, te.exercise_id, te.custom_sets, te.custom_repetitions,
             te.frequency_instructions, te.notes, te.created_at,
             e.name as exercise_name, e.category as exercise_category, e.instructions as exercise_instructions,
             e.media_url
      FROM treatment_exercises te
      JOIN exercises e ON te.exercise_id = e.id
      WHERE te.treatment_id = ?
      ORDER BY e.name ASC
    `, [treatmentId]);
  }

  // --- Mediciones / Evolución ---
  async addMeasurement(data, authorId) {
    const result = await query(`
      INSERT INTO measurements (
        patient_id, treatment_id, session_id, author_id, measurement_type,
        metric_name, value_numeric, unit, body_zone, measured_at, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.patientId,
      data.treatmentId || null,
      data.sessionId || null,
      authorId,
      data.measurementType,
      data.metricName,
      data.valueNumeric,
      data.unit,
      data.bodyZone || null,
      data.measuredAt,
      data.notes || null
    ]);
    return result.insertId;
  }

  async findMeasurements({ patientId, treatmentId }) {
    const conditions = ['m.patient_id = ?'];
    const params = [patientId];

    if (treatmentId) {
      conditions.push('m.treatment_id = ?');
      params.push(treatmentId);
    }

    return await query(`
      SELECT m.id, m.patient_id, m.treatment_id, m.session_id, m.author_id,
             m.measurement_type, m.metric_name, m.value_numeric, m.unit, m.body_zone,
             m.measured_at, m.notes, m.created_at,
             u.name as author_name, u.last_name as author_last_name
      FROM measurements m
      JOIN users u ON m.author_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.measured_at DESC
    `, params);
  }
}

export const treatmentsRepository = new TreatmentsRepository();
