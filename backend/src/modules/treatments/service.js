/**
 * @file service.js
 * @module treatments
 * @description Lógica médica de tratamientos: versionado automático de rutinas (V1 -> V2 inmutable) y seguimiento.
 */
import { treatmentsRepository } from './repository.js';
import { patientsRepository } from '../patients/repository.js';
import { exercisesRepository } from '../exercises/repository.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class TreatmentsService {
  async search(filters, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a planes de tratamiento clínicos');
    }
    return await treatmentsRepository.search(filters);
  }

  async getDetail(id, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a planes de tratamiento clínicos');
    }

    const treatment = await treatmentsRepository.findById(id);
    if (!treatment) {
      throw new NotFoundError('Tratamiento no encontrado');
    }

    // Cargar sesiones, ejercicios y rutinas asignadas
    const [sessions, exercises, routines] = await Promise.all([
      treatmentsRepository.findSessionsByTreatment(id),
      treatmentsRepository.findExercisesByTreatment(id),
      treatmentsRepository.findRoutines({ treatmentId: id, includeHistory: true })
    ]);

    return {
      ...treatment,
      sessions,
      exercises,
      routines
    };
  }

  async create(data, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a crear tratamientos');
    }

    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }

    const id = await treatmentsRepository.create(data, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'TREATMENT_CREATED',
      entityType: 'treatment',
      entityId: id,
      details: { patientId: data.patientId, title: data.title }
    });

    return await this.getDetail(id, currentUser);
  }

  async update(id, fields, currentUser) {
    const treatment = await treatmentsRepository.findById(id);
    if (!treatment) {
      throw new NotFoundError('Tratamiento no encontrado');
    }

    if (currentUser.role === 'kinesiologist' && treatment.kinesiologist_id !== currentUser.id) {
      throw new ForbiddenError('Solo el kinesiólogo responsable o un administrador pueden modificar este plan');
    }

    await treatmentsRepository.update(id, fields);

    await logAudit({
      userId: currentUser.id,
      action: 'TREATMENT_UPDATED',
      entityType: 'treatment',
      entityId: id,
      details: fields
    });

    return await this.getDetail(id, currentUser);
  }

  // --- Sesiones ---
  async addSession(data, currentUser) {
    const treatment = await treatmentsRepository.findById(data.treatmentId);
    if (!treatment) {
      throw new NotFoundError('Tratamiento no encontrado');
    }

    const sessionId = await treatmentsRepository.addSession(data, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'TREATMENT_SESSION_RECORDED',
      entityType: 'treatment_session',
      entityId: sessionId,
      details: {
        treatmentId: data.treatmentId,
        sessionNumber: data.sessionNumber,
        exercisesCount: data.exercises?.length || 0
      }
    });

    return { id: sessionId, ...data };
  }

  async getSessions(treatmentId, currentUser) {
    await this.getDetail(treatmentId, currentUser);
    return await treatmentsRepository.findSessionsByTreatment(treatmentId);
  }

  async getPatientTracking(patientId, treatmentId, currentUser) {
    const tracking = await treatmentsRepository.getPatientExerciseEvolutionTracking(patientId, treatmentId);
    if (!tracking) {
      throw new NotFoundError('Paciente no encontrado');
    }
    return tracking;
  }

  // --- Ejercicios (Asignación directa legada) ---
  async addExercise(data, currentUser) {
    await this.getDetail(data.treatmentId, currentUser);
    const id = await treatmentsRepository.addExercise(data);

    await logAudit({
      userId: currentUser.id,
      action: 'TREATMENT_EXERCISE_ASSIGNED',
      entityType: 'treatment_exercise',
      entityId: id,
      details: { treatmentId: data.treatmentId, exerciseId: data.exerciseId }
    });

    return { id, ...data };
  }

  async removeExercise(treatmentId, exerciseId, currentUser) {
    await this.getDetail(treatmentId, currentUser);
    await treatmentsRepository.removeExercise(treatmentId, exerciseId);

    await logAudit({
      userId: currentUser.id,
      action: 'TREATMENT_EXERCISE_REMOVED',
      entityType: 'treatment_exercise',
      entityId: `${treatmentId}-${exerciseId}`
    });

    return { success: true };
  }

  // --- Mediciones ---
  async addMeasurement(data, currentUser) {
    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }

    const id = await treatmentsRepository.addMeasurement(data, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'MEASUREMENT_RECORDED',
      entityType: 'measurement',
      entityId: id,
      details: { patientId: data.patientId, metric: data.metricName, value: data.valueNumeric }
    });

    return { id, ...data };
  }

  async getMeasurements(filters, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a mediciones clínicas');
    }
    return await treatmentsRepository.findMeasurements(filters);
  }

  // ========================================================
  // --- RUTINAS TERAPÉUTICAS Y PRESCRIPCIÓN DE EJERCICIOS ---
  // ========================================================

  async searchRoutines(filters, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a rutinas de rehabilitación');
    }
    return await treatmentsRepository.findRoutines(filters);
  }

  async getRoutineDetail(id, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no tiene acceso a rutinas terapéuticas');
    }

    const routine = await treatmentsRepository.findRoutineById(id);
    if (!routine) {
      throw new NotFoundError('Rutina terapéutica no encontrada');
    }

    const [exercises, versions] = await Promise.all([
      treatmentsRepository.findRoutineExercises(id),
      treatmentsRepository.findRoutineVersionHistory(id)
    ]);

    return {
      ...routine,
      exercises,
      versions
    };
  }

  async createRoutine(data, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no puede prescribir rutinas');
    }

    const treatment = await treatmentsRepository.findById(data.treatmentId);
    if (!treatment) {
      throw new NotFoundError('Plan de tratamiento no encontrado');
    }

    // Verificar que los ejercicios referenciados existan en el catálogo
    for (const item of data.exercises) {
      const exercise = await exercisesRepository.findById(item.exerciseId);
      if (!exercise) {
        throw new ValidationError(`El ejercicio con ID ${item.exerciseId} no existe en el catálogo.`);
      }
    }

    const routineId = await treatmentsRepository.createRoutineWithExercises(data, data.exercises, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'ROUTINE_CREATED',
      entityType: 'treatment_routine',
      entityId: routineId,
      details: {
        treatmentId: data.treatmentId,
        routineName: data.name,
        exercisesCount: data.exercises.length,
        status: data.status || 'active'
      }
    });

    return await this.getRoutineDetail(routineId, currentUser);
  }

  async updateRoutine(data, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no puede modificar prescripciones terapéuticas');
    }

    const routine = await treatmentsRepository.findRoutineById(data.id);
    if (!routine) {
      throw new NotFoundError('Rutina terapéutica no encontrada');
    }

    // Verificar autorización sobre el tratamiento
    const treatment = await treatmentsRepository.findById(routine.treatment_id);
    if (!treatment) {
      throw new NotFoundError('Plan de tratamiento no encontrado');
    }

    if (currentUser.role === 'kinesiologist' && treatment.kinesiologist_id !== currentUser.id && routine.kinesiologist_id !== currentUser.id) {
      throw new ForbiddenError('Solo el kinesiólogo responsable o un administrador pueden modificar esta prescripción');
    }

    // Validar ejercicios
    for (const item of data.exercises) {
      const exercise = await exercisesRepository.findById(item.exerciseId);
      if (!exercise) {
        throw new ValidationError(`El ejercicio con ID ${item.exerciseId} no existe en el catálogo.`);
      }
    }

    const resultingId = await treatmentsRepository.updateRoutineWithVersioning(
      data.id,
      data,
      data.exercises,
      currentUser.id
    );

    await logAudit({
      userId: currentUser.id,
      action: resultingId !== data.id ? 'ROUTINE_VERSION_CREATED' : 'ROUTINE_UPDATED',
      entityType: 'treatment_routine',
      entityId: resultingId,
      details: {
        originalRoutineId: data.id,
        resultingRoutineId: resultingId,
        changeReason: data.changeReason || 'Actualización de ejercicios'
      }
    });

    return await this.getRoutineDetail(resultingId, currentUser);
  }

  async updateRoutineStatus(id, status, currentUser) {
    if (currentUser.role === 'receptionist') {
      throw new ForbiddenError('El rol de recepcionista no puede modificar el estado de rutinas clínicas');
    }

    const routine = await treatmentsRepository.findRoutineById(id);
    if (!routine) {
      throw new NotFoundError('Rutina terapéutica no encontrada');
    }

    await treatmentsRepository.updateRoutineStatus(id, status);

    await logAudit({
      userId: currentUser.id,
      action: 'ROUTINE_STATUS_CHANGED',
      entityType: 'treatment_routine',
      entityId: id,
      details: { previousStatus: routine.status, newStatus: status }
    });

    return await this.getRoutineDetail(id, currentUser);
  }
}

export const treatmentsService = new TreatmentsService();
