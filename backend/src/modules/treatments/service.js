import { treatmentsRepository } from './repository.js';
import { patientsRepository } from '../patients/repository.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
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

    // Cargar sesiones y ejercicios asignados
    const [sessions, exercises] = await Promise.all([
      treatmentsRepository.findSessionsByTreatment(id),
      treatmentsRepository.findExercisesByTreatment(id)
    ]);

    return {
      ...treatment,
      sessions,
      exercises
    };
  }

  async create(data, currentUser) {
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
      details: { treatmentId: data.treatmentId, sessionNumber: data.sessionNumber }
    });

    return { id: sessionId, ...data };
  }

  async getSessions(treatmentId, currentUser) {
    await this.getDetail(treatmentId, currentUser);
    return await treatmentsRepository.findSessionsByTreatment(treatmentId);
  }

  // --- Ejercicios ---
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
}

export const treatmentsService = new TreatmentsService();
