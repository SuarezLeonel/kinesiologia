/**
 * @file repository.js
 * @module treatments
 * @description Acceso a datos para planes de tratamiento, versiones de rutinas y ejercicios ejecutados en box.
 */
import { query, executeTransaction } from '../../config/database.js';

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
             (SELECT COUNT(*) FROM treatment_sessions ts WHERE ts.treatment_id = t.id) as sessions_completed_count,
             (SELECT COUNT(*) FROM treatment_routines tr WHERE tr.treatment_id = t.id AND tr.is_current = 1) as active_routines_count
      FROM treatments t
      JOIN patients p ON t.patient_id = p.id
      JOIN users u ON t.kinesiologist_id = u.id
      ${where}
      ORDER BY t.start_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(Number(limit), Number(offset));
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
    return await executeTransaction(async (conn) => {
      const [res] = await conn.execute(`
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

      const sessionId = res.insertId;

      if (Array.isArray(data.exercises) && data.exercises.length > 0) {
        for (const ex of data.exercises) {
          await conn.execute(`
            INSERT INTO session_exercise_executions (
              session_id, treatment_id, routine_id, routine_exercise_id, exercise_id,
              kinesiologist_id, sets_completed, reps_completed, resistance_load,
              tolerance_level, pain_level_reported, clinical_observations, future_modifications_suggested
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            sessionId,
            data.treatmentId,
            data.routineId || null,
            ex.routineExerciseId || null,
            ex.exerciseId,
            kinesiologistId,
            ex.setsCompleted,
            ex.repsCompleted,
            ex.resistanceLoad || null,
            ex.toleranceLevel || 'Buena',
            ex.painLevelReported ?? null,
            ex.clinicalObservations || null,
            ex.futureModificationsSuggested || null
          ]);
        }
      }

      return sessionId;
    });
  }

  async findSessionsByTreatment(treatmentId) {
    const sessions = await query(`
      SELECT ts.id, ts.treatment_id, ts.appointment_id, ts.kinesiologist_id, ts.session_number,
             ts.session_date, ts.performed_procedures, ts.patient_evolution, ts.pain_level_reported,
             ts.observations, ts.created_at,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM treatment_sessions ts
      JOIN users u ON ts.kinesiologist_id = u.id
      WHERE ts.treatment_id = ?
      ORDER BY ts.session_number ASC
    `, [treatmentId]);

    for (const session of sessions) {
      session.exercises = await query(`
        SELECT see.id, see.session_id, see.treatment_id, see.routine_id, see.routine_exercise_id,
               see.exercise_id, see.sets_completed, see.reps_completed, see.resistance_load,
               see.tolerance_level, see.pain_level_reported, see.clinical_observations,
               see.future_modifications_suggested, see.created_at,
               e.name as exercise_name, e.category as exercise_category, e.body_zone as exercise_body_zone
        FROM session_exercise_executions see
        JOIN exercises e ON see.exercise_id = e.id
        WHERE see.session_id = ?
        ORDER BY see.id ASC
      `, [session.id]);
    }

    return sessions;
  }

  async getPatientExerciseEvolutionTracking(patientId, treatmentId = null) {
    // 1. Obtener datos del paciente
    const patientRows = await query(`
      SELECT id, first_name, last_name, dni, email, phone
      FROM patients
      WHERE id = ?
      LIMIT 1
    `, [patientId]);
    if (!patientRows.length) return null;

    // 2. Rutinas vigentes y anteriores con versiones e historial
    const routineParams = [patientId];
    let routineCondition = 'tr.patient_id = ?';
    if (treatmentId) {
      routineCondition += ' AND tr.treatment_id = ?';
      routineParams.push(treatmentId);
    }

    const routines = await query(`
      SELECT tr.id, tr.treatment_id, tr.patient_id, tr.kinesiologist_id,
             tr.name, tr.description, tr.status, tr.version, tr.parent_routine_id,
             tr.is_current, tr.valid_from, tr.valid_until, tr.change_reason,
             tr.notes, tr.created_at, tr.updated_at,
             t.title as treatment_title,
             u.name as author_name, u.last_name as author_last_name
      FROM treatment_routines tr
      LEFT JOIN treatments t ON tr.treatment_id = t.id
      JOIN users u ON tr.kinesiologist_id = u.id
      WHERE ${routineCondition}
      ORDER BY tr.treatment_id ASC, tr.version DESC, tr.created_at DESC
    `, routineParams);

    for (const r of routines) {
      r.exercises = await query(`
        SELECT re.id, re.routine_id, re.exercise_id, re.sets, re.repetitions,
               re.duration_seconds, re.rest_seconds, re.weekly_frequency,
               re.body_side, re.resistance_load, re.custom_instructions, re.execution_order,
               e.name, e.category, e.body_zone, e.difficulty_level
        FROM routine_exercises re
        JOIN exercises e ON re.exercise_id = e.id
        WHERE re.routine_id = ?
        ORDER BY re.execution_order ASC, re.id ASC
      `, [r.id]);
    }

    // 3. Cumplimiento informado por el paciente (autónomo / hogar)
    const logParams = [patientId];
    let logCondition = 'pel.patient_id = ?';
    if (treatmentId) {
      logCondition += ' AND tr.treatment_id = ?';
      logParams.push(treatmentId);
    }

    const patientReportedLogs = await query(`
      SELECT pel.id, pel.patient_id, pel.routine_id, pel.routine_exercise_id, pel.exercise_id,
             pel.completed_date, pel.completed_at, pel.sets_completed, pel.reps_completed,
             pel.perceived_pain_level, pel.patient_notes,
             e.name as exercise_name, e.category as exercise_category,
             tr.name as routine_name, tr.version as routine_version
      FROM patient_exercise_logs pel
      JOIN exercises e ON pel.exercise_id = e.id
      JOIN treatment_routines tr ON pel.routine_id = tr.id
      WHERE ${logCondition}
      ORDER BY pel.completed_at DESC
      LIMIT 100
    `, logParams);

    // 4. Sesiones profesionales y ejercicios ejecutados en consultorio
    const sessionParams = [patientId];
    let sessionCondition = 't.patient_id = ?';
    if (treatmentId) {
      sessionCondition += ' AND t.id = ?';
      sessionParams.push(treatmentId);
    }

    const sessions = await query(`
      SELECT ts.id, ts.treatment_id, ts.session_number, ts.session_date,
             ts.performed_procedures, ts.patient_evolution, ts.pain_level_reported,
             ts.observations, ts.created_at,
             t.title as treatment_title,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM treatment_sessions ts
      JOIN treatments t ON ts.treatment_id = t.id
      JOIN users u ON ts.kinesiologist_id = u.id
      WHERE ${sessionCondition}
      ORDER BY ts.session_date DESC, ts.session_number DESC
    `, sessionParams);

    for (const s of sessions) {
      s.executedExercises = await query(`
        SELECT see.id, see.session_id, see.treatment_id, see.routine_id, see.routine_exercise_id,
               see.exercise_id, see.sets_completed, see.reps_completed, see.resistance_load,
               see.tolerance_level, see.pain_level_reported, see.clinical_observations,
               see.future_modifications_suggested, see.created_at,
               e.name as exercise_name, e.category as exercise_category
        FROM session_exercise_executions see
        JOIN exercises e ON see.exercise_id = e.id
        WHERE see.session_id = ?
        ORDER BY see.id ASC
      `, [s.id]);
    }

    // 5. Comparativa clara entre prescripción, cumplimiento del paciente y evolución profesional
    // (Métricas factuales sin diagnósticos inventados ni IA especulativa)
    return {
      patient: patientRows[0],
      routines,
      patientReportedLogs,
      professionalSessions: sessions,
      summaryMetrics: {
        totalRoutinesPrescribed: routines.length,
        currentRoutinesCount: routines.filter(r => r.is_current === 1).length,
        totalPatientLogsReported: patientReportedLogs.length,
        totalProfessionalSessionsConducted: sessions.length,
        totalExercisesExecutedInClinic: sessions.reduce((acc, s) => acc + (s.executedExercises?.length || 0), 0)
      }
    };
  }

  // --- Ejercicios de Tratamiento (Directo) ---
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
             e.media_url, e.body_zone, e.difficulty_level
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

  // ========================================================
  // --- RUTINAS TERAPÉUTICAS Y PRESCRIPCIÓN DE EJERCICIOS ---
  // ========================================================

  async findRoutines({ treatmentId, patientId, status, includeHistory = true }) {
    const conditions = [];
    const params = [];

    if (treatmentId) {
      conditions.push('r.treatment_id = ?');
      params.push(treatmentId);
    }
    if (patientId) {
      conditions.push('r.patient_id = ?');
      params.push(patientId);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (!includeHistory) {
      conditions.push('r.is_current = 1');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT r.id, r.treatment_id, r.patient_id, r.kinesiologist_id, r.name,
             r.description, r.status, r.version, r.parent_routine_id, r.is_current,
             r.valid_from, r.valid_until, r.change_reason, r.notes, r.created_at, r.updated_at,
             t.title as treatment_title,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) as exercises_count
      FROM treatment_routines r
      JOIN treatments t ON r.treatment_id = t.id
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON r.kinesiologist_id = u.id
      ${where}
      ORDER BY r.is_current DESC, r.created_at DESC
    `;
    return await query(sql, params);
  }

  async findRoutineById(id) {
    const rows = await query(`
      SELECT r.id, r.treatment_id, r.patient_id, r.kinesiologist_id, r.name,
             r.description, r.status, r.version, r.parent_routine_id, r.is_current,
             r.valid_from, r.valid_until, r.change_reason, r.notes, r.created_at, r.updated_at,
             t.title as treatment_title,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name
      FROM treatment_routines r
      JOIN treatments t ON r.treatment_id = t.id
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON r.kinesiologist_id = u.id
      WHERE r.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findRoutineExercises(routineId) {
    return await query(`
      SELECT re.id, re.routine_id, re.exercise_id, re.sets, re.repetitions,
             re.duration_seconds, re.rest_seconds, re.weekly_frequency,
             re.body_side, re.resistance_load, re.custom_instructions,
             re.execution_order, re.created_at,
             e.name as exercise_name, e.category as exercise_category,
             e.body_zone, e.muscle_group, e.therapeutic_objective,
             e.equipment_needed, e.difficulty_level, e.instructions as exercise_instructions,
             e.contraindications, e.media_url, e.is_active as exercise_is_active
      FROM routine_exercises re
      JOIN exercises e ON re.exercise_id = e.id
      WHERE re.routine_id = ?
      ORDER BY re.execution_order ASC, re.id ASC
    `, [routineId]);
  }

  async findRoutineVersionHistory(routineId) {
    const target = await this.findRoutineById(routineId);
    if (!target) return [];

    return await query(`
      SELECT r.id, r.treatment_id, r.name, r.version, r.status, r.is_current,
             r.change_reason, r.created_at, r.updated_at,
             u.name as kinesiologist_name, u.last_name as kinesiologist_last_name,
             (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) as exercises_count
      FROM treatment_routines r
      JOIN users u ON r.kinesiologist_id = u.id
      WHERE r.treatment_id = ? AND (r.id = ? OR r.parent_routine_id = ? OR r.id = ?)
      ORDER BY r.version DESC
    `, [target.treatment_id, target.id, target.id, target.parent_routine_id || 0]);
  }

  async createRoutineWithExercises(routineData, exercisesList, authorId) {
    return await executeTransaction(async (conn) => {
      // 1. Obtener datos del plan y paciente
      const [tRows] = await conn.query('SELECT patient_id FROM treatments WHERE id = ?', [routineData.treatmentId]);
      if (!tRows.length) throw new Error('Tratamiento no encontrado');
      const patientId = tRows[0].patient_id;

      const isCurrent = (routineData.status || 'active') === 'active' ? 1 : 0;

      // Si la nueva rutina nace como activa, desmarcar is_current de cualquier otra rutina activa del plan
      if (isCurrent) {
        await conn.query('UPDATE treatment_routines SET is_current = 0 WHERE treatment_id = ?', [routineData.treatmentId]);
      }

      // 2. Insertar cabecera de la rutina
      const [rResult] = await conn.query(`
        INSERT INTO treatment_routines (
          treatment_id, patient_id, kinesiologist_id, name, description,
          status, version, parent_routine_id, is_current, valid_from,
          valid_until, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?)
      `, [
        routineData.treatmentId,
        patientId,
        authorId,
        routineData.name,
        routineData.description || null,
        routineData.status || 'active',
        isCurrent,
        routineData.validFrom || null,
        routineData.validUntil || null,
        routineData.notes || null
      ]);

      const routineId = rResult.insertId;

      // 3. Insertar ejercicios asociados con sus parámetros clínicos
      for (let i = 0; i < exercisesList.length; i++) {
        const ex = exercisesList[i];
        await conn.query(`
          INSERT INTO routine_exercises (
            routine_id, exercise_id, sets, repetitions, duration_seconds,
            rest_seconds, weekly_frequency, body_side, resistance_load,
            custom_instructions, execution_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          routineId,
          ex.exerciseId,
          ex.sets ?? 3,
          ex.repetitions ?? 10,
          ex.durationSeconds ?? null,
          ex.restSeconds ?? 60,
          ex.weeklyFrequency ?? '3 veces por semana',
          ex.bodySide ?? 'Bilateral',
          ex.resistanceLoad ?? null,
          ex.customInstructions ?? null,
          ex.executionOrder ?? (i + 1)
        ]);

        // Sincronizar hacia treatment_exercises para compatibilidad relacional
        await conn.query(`
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
          routineData.treatmentId,
          ex.exerciseId,
          ex.sets ?? 3,
          ex.repetitions ?? 10,
          ex.weeklyFrequency ?? '3 veces por semana',
          ex.customInstructions ?? null
        ]);
      }

      return routineId;
    });
  }

  async updateRoutineWithVersioning(routineId, routineData, exercisesList, authorId) {
    return await executeTransaction(async (conn) => {
      const [rRows] = await conn.query('SELECT * FROM treatment_routines WHERE id = ?', [routineId]);
      if (!rRows.length) throw new Error('Rutina terapéutica no encontrada');
      const existing = rRows[0];

      // Caso A: Si es un borrador (draft), se modifica in-situ sin versionar
      if (existing.status === 'draft') {
        const isCurrent = (routineData.status || existing.status) === 'active' ? 1 : 0;
        if (isCurrent) {
          await conn.query('UPDATE treatment_routines SET is_current = 0 WHERE treatment_id = ? AND id != ?', [existing.treatment_id, routineId]);
        }

        await conn.query(`
          UPDATE treatment_routines
          SET name = COALESCE(?, name),
              description = COALESCE(?, description),
              status = COALESCE(?, status),
              is_current = ?,
              valid_from = COALESCE(?, valid_from),
              valid_until = COALESCE(?, valid_until),
              notes = COALESCE(?, notes)
          WHERE id = ?
        `, [
          routineData.name || null,
          routineData.description || null,
          routineData.status || null,
          isCurrent,
          routineData.validFrom || null,
          routineData.validUntil || null,
          routineData.notes || null,
          routineId
        ]);

        // Reemplazar ejercicios del borrador
        await conn.query('DELETE FROM routine_exercises WHERE routine_id = ?', [routineId]);
        for (let i = 0; i < exercisesList.length; i++) {
          const ex = exercisesList[i];
          await conn.query(`
            INSERT INTO routine_exercises (
              routine_id, exercise_id, sets, repetitions, duration_seconds,
              rest_seconds, weekly_frequency, body_side, resistance_load,
              custom_instructions, execution_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            routineId,
            ex.exerciseId,
            ex.sets ?? 3,
            ex.repetitions ?? 10,
            ex.durationSeconds ?? null,
            ex.restSeconds ?? 60,
            ex.weeklyFrequency ?? '3 veces por semana',
            ex.bodySide ?? 'Bilateral',
            ex.resistanceLoad ?? null,
            ex.customInstructions ?? null,
            ex.executionOrder ?? (i + 1)
          ]);
        }

        return routineId;
      }

      // Caso B: Si la rutina ya estaba activa o completada, crear NUEVA VERSIÓN CLÍNICA AUDITABLE
      // 1. Archivar la versión anterior preservando su histórico exacto
      await conn.query(`
        UPDATE treatment_routines
        SET is_current = 0,
            status = 'archived'
        WHERE id = ?
      `, [routineId]);

      // 2. Insertar nueva versión
      const nextVersion = Number(existing.version) + 1;
      const targetStatus = routineData.status || 'active';
      const isCurrent = targetStatus === 'active' ? 1 : 0;

      if (isCurrent) {
        await conn.query('UPDATE treatment_routines SET is_current = 0 WHERE treatment_id = ?', [existing.treatment_id]);
      }

      const [newRResult] = await conn.query(`
        INSERT INTO treatment_routines (
          treatment_id, patient_id, kinesiologist_id, name, description,
          status, version, parent_routine_id, is_current, valid_from,
          valid_until, change_reason, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        existing.treatment_id,
        existing.patient_id,
        authorId,
        routineData.name || existing.name,
        routineData.description !== undefined ? routineData.description : existing.description,
        targetStatus,
        nextVersion,
        existing.id,
        isCurrent,
        routineData.validFrom || existing.valid_from,
        routineData.validUntil || existing.valid_until,
        routineData.changeReason || 'Evolución de parámetros clínicos',
        routineData.notes !== undefined ? routineData.notes : existing.notes
      ]);

      const newRoutineId = newRResult.insertId;

      // 3. Insertar ejercicios de la nueva versión
      for (let i = 0; i < exercisesList.length; i++) {
        const ex = exercisesList[i];
        await conn.query(`
          INSERT INTO routine_exercises (
            routine_id, exercise_id, sets, repetitions, duration_seconds,
            rest_seconds, weekly_frequency, body_side, resistance_load,
            custom_instructions, execution_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newRoutineId,
          ex.exerciseId,
          ex.sets ?? 3,
          ex.repetitions ?? 10,
          ex.durationSeconds ?? null,
          ex.restSeconds ?? 60,
          ex.weeklyFrequency ?? '3 veces por semana',
          ex.bodySide ?? 'Bilateral',
          ex.resistanceLoad ?? null,
          ex.customInstructions ?? null,
          ex.executionOrder ?? (i + 1)
        ]);

        // Sync a treatment_exercises
        await conn.query(`
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
          existing.treatment_id,
          ex.exerciseId,
          ex.sets ?? 3,
          ex.repetitions ?? 10,
          ex.weeklyFrequency ?? '3 veces por semana',
          ex.customInstructions ?? null
        ]);
      }

      return newRoutineId;
    });
  }

  async updateRoutineStatus(routineId, status) {
    return await executeTransaction(async (conn) => {
      const [rRows] = await conn.query('SELECT treatment_id, status FROM treatment_routines WHERE id = ?', [routineId]);
      if (!rRows.length) throw new Error('Rutina no encontrada');
      const routine = rRows[0];

      if (status === 'active') {
        // Desmarcar otras rutinas activas del tratamiento
        await conn.query('UPDATE treatment_routines SET is_current = 0 WHERE treatment_id = ?', [routine.treatment_id]);
        await conn.query('UPDATE treatment_routines SET status = "active", is_current = 1 WHERE id = ?', [routineId]);
      } else {
        await conn.query('UPDATE treatment_routines SET status = ?, is_current = 0 WHERE id = ?', [status, routineId]);
      }
    });
  }
}

export const treatmentsRepository = new TreatmentsRepository();
