/**
 * @file service.js
 * @module vacations
 * @description Lógica de negocio para las vacaciones de los kinesiólogos, detección de turnos
 * afectados, bloqueo de disponibilidad y reasignación por parte de recepción.
 */
import { vacationsRepository } from './repository.js';
import { usersRepository } from '../users/repository.js';
import { appointmentsRepository } from '../appointments/repository.js';
import { patientsRepository } from '../patients/repository.js';
import { notificationsService } from '../notifications/service.js';
import { query } from '../../config/database.js';
import { getClinicDateString } from '../../utils/date.js';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class VacationsService {
  _getTodayStr() {
    return getClinicDateString(new Date());
  }

  async search(filters, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;

    // RBAC: Kinesiólogo solo puede consultar sus propias vacaciones
    if (role === 'kinesiologist' || role === 'kinesiologo') {
      filters.kinesiologistId = currentUser.id;
    } else if (role === 'admin' || role === 'receptionist' || role === 'recepcionista') {
      if (filters.kinesiologistId === 'all') {
        delete filters.kinesiologistId;
      }
    }

    const vacations = await vacationsRepository.search(filters);
    const today = this._getTodayStr();

    // Actualización de estado dinámica (scheduled -> active -> completed)
    for (const v of vacations) {
      if (v.status === 'scheduled' && v.start_date <= today && v.end_date >= today) {
        await vacationsRepository.updateStatus(v.id, 'active');
        v.status = 'active';
      } else if ((v.status === 'scheduled' || v.status === 'active') && v.end_date < today) {
        await vacationsRepository.updateStatus(v.id, 'completed');
        v.status = 'completed';
      }
    }

    return vacations;
  }

  async preview({ kinesiologistId, startDate, endDate }, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    const targetKineId = (role === 'kinesiologist' || role === 'kinesiologo')
      ? currentUser.id
      : (kinesiologistId || currentUser.id);

    const today = this._getTodayStr();
    if (startDate < today) {
      throw new BadRequestError('No se pueden registrar vacaciones en fechas pasadas');
    }
    if (endDate < startDate) {
      throw new BadRequestError('La fecha de finalización debe ser igual o posterior a la fecha de inicio');
    }

    const overlap = await vacationsRepository.findOverlapping(targetKineId, startDate, endDate);
    if (overlap) {
      throw new ConflictError('Ya existe un período de vacaciones registrado que se superpone con las fechas seleccionadas');
    }

    const affected = await vacationsRepository.findAffectedAppointments(targetKineId, startDate, endDate);

    return {
      kinesiologistId: targetKineId,
      startDate,
      endDate,
      affectedCount: affected.length,
      hasConflicts: affected.length > 0,
      affectedAppointments: affected
    };
  }

  async create(data, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    const targetKineId = (role === 'kinesiologist' || role === 'kinesiologo')
      ? currentUser.id
      : (data.kinesiologistId || currentUser.id);

    // Solo kinesiólogos para sí mismos o administradores pueden registrar vacaciones
    if (role !== 'admin' && role !== 'kinesiologist' && role !== 'kinesiologo') {
      throw new ForbiddenError('No posee permisos para registrar períodos de vacaciones');
    }

    const today = this._getTodayStr();
    if (data.startDate < today) {
      throw new BadRequestError('No se pueden registrar vacaciones en fechas pasadas');
    }
    if (data.endDate < data.startDate) {
      throw new BadRequestError('La fecha de finalización debe ser posterior o igual a la de inicio');
    }

    const overlap = await vacationsRepository.findOverlapping(targetKineId, data.startDate, data.endDate);
    if (overlap) {
      throw new ConflictError('Ya existe un período de vacaciones registrado que se superpone con las fechas seleccionadas');
    }

    // Identificar turnos afectados sin eliminarlos ni cancelarlos
    const affected = await vacationsRepository.findAffectedAppointments(targetKineId, data.startDate, data.endDate);
    const initialStatus = data.startDate <= today ? 'active' : 'scheduled';

    const id = await vacationsRepository.create({
      kinesiologistId: targetKineId,
      startDate: data.startDate,
      endDate: data.endDate,
      status: initialStatus,
      notes: data.notes || null,
      affectedAppointmentsCount: affected.length,
      createdBy: currentUser.id
    });

    const kine = await usersRepository.findById(targetKineId);
    const kineName = kine ? `Lic. ${kine.last_name}, ${kine.name}` : `Kinesiólogo #${targetKineId}`;

    // Si existen turnos asignados durante ese período, notificar a recepción y administración
    if (affected.length > 0) {
      const staffUsers = await query(`
        SELECT u.id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name IN ('receptionist', 'admin') AND u.is_active = 1
      `);

      const notificationMessage = `El kinesiólogo ${kineName} estará de vacaciones desde el ${data.startDate} hasta el ${data.endDate}. Tiene turnos asignados durante este período que necesitan ser reorganizados. Por favor, seleccioná nuevamente el horario y profesional correspondiente.`;

      for (const staff of staffUsers) {
        await notificationsService.notify({
          userId: staff.id,
          type: 'KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS',
          title: 'Turnos afectados por vacaciones',
          message: notificationMessage,
          metadata: {
            vacationId: id,
            kinesiologistId: targetKineId,
            kinesiologistName: kineName,
            startDate: data.startDate,
            endDate: data.endDate,
            affectedAppointmentsCount: affected.length
          }
        });
      }
    }

    await logAudit({
      userId: currentUser.id,
      action: 'KINESIOLOGIST_VACATION_CREATED',
      entityType: 'kinesiologist_vacations',
      entityId: id,
      details: {
        kinesiologistId: targetKineId,
        startDate: data.startDate,
        endDate: data.endDate,
        affectedAppointmentsCount: affected.length
      }
    });

    return await vacationsRepository.findById(id);
  }

  async cancel(id, reason, currentUser) {
    const vacation = await vacationsRepository.findById(id);
    if (!vacation) {
      throw new NotFoundError('Período de vacaciones no encontrado');
    }

    const role = currentUser?.role || currentUser?.role_name;
    if (role === 'kinesiologist' || role === 'kinesiologo') {
      if (vacation.kinesiologist_id !== currentUser.id) {
        throw new ForbiddenError('Solo puede cancelar sus propios períodos de vacaciones');
      }
    }

    if (vacation.status === 'cancelled') {
      throw new BadRequestError('El período de vacaciones ya se encuentra cancelado');
    }

    const today = this._getTodayStr();
    if (vacation.end_date < today) {
      throw new BadRequestError('No se pueden cancelar períodos de vacaciones pasados');
    }

    await vacationsRepository.updateStatus(id, 'cancelled', reason || 'Cancelado por el usuario');

    await logAudit({
      userId: currentUser.id,
      action: 'KINESIOLOGIST_VACATION_CANCELLED',
      entityType: 'kinesiologist_vacations',
      entityId: id,
      details: { reason }
    });

    return {
      id,
      status: 'cancelled',
      success: true,
      message: 'Período de vacaciones cancelado con éxito'
    };
  }

  async getAffectedAppointments(params, currentUser) {
    let { vacationId, kinesiologistId, startDate, endDate } = params;

    if (vacationId) {
      const v = await vacationsRepository.findById(vacationId);
      if (!v) throw new NotFoundError('Período de vacaciones no encontrado');
      kinesiologistId = v.kinesiologist_id;
      startDate = v.start_date;
      endDate = v.end_date;
    }

    if (!kinesiologistId || !startDate || !endDate) {
      throw new BadRequestError('Identificador de vacaciones o profesional y fechas son requeridos');
    }

    const role = currentUser?.role || currentUser?.role_name;
    if ((role === 'kinesiologist' || role === 'kinesiologo') && kinesiologistId !== currentUser.id) {
      throw new ForbiddenError('Solo puede consultar turnos de sus propias vacaciones');
    }

    const cleanStart = String(startDate).slice(0, 10);
    const cleanEnd = String(endDate).slice(0, 10);

    return await vacationsRepository.findAffectedAppointments(kinesiologistId, cleanStart, cleanEnd);
  }

  async reassignAppointment({ appointmentId, targetKinesiologistId, newStartTime, notes, notifyPatient = true }, currentUser) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Turno no encontrado');
    }

    const role = currentUser?.role || currentUser?.role_name;
    if (role !== 'admin' && role !== 'receptionist' && role !== 'recepcionista') {
      throw new ForbiddenError('Solo el personal de recepción o administración puede reasignar turnos afectados');
    }

    const targetDate = newStartTime ? String(newStartTime).slice(0, 10) : String(appointment.start_time).slice(0, 10);

    // Validar que el nuevo profesional no esté de vacaciones en esa fecha
    if (targetKinesiologistId) {
      const kineOnVacation = await vacationsRepository.isKinesiologistOnVacation(targetKinesiologistId, targetDate);
      if (kineOnVacation) {
        throw new ConflictError('El profesional seleccionado se encuentra de vacaciones en la fecha requerida');
      }
    }

    const updateFields = {
      notes: notes !== undefined ? notes : appointment.notes
    };

    if (targetKinesiologistId !== undefined) {
      updateFields.kinesiologistId = targetKinesiologistId;
    }

    if (newStartTime) {
      updateFields.startTime = newStartTime;
      const startD = new Date(newStartTime.replace(' ', 'T'));
      if (!isNaN(startD.getTime())) {
        let durationMinutes = 45;
        if (appointment.start_time && appointment.end_time) {
          const origStart = new Date(appointment.start_time);
          const origEnd = new Date(appointment.end_time);
          const diffMinutes = Math.round((origEnd.getTime() - origStart.getTime()) / 60000);
          if (diffMinutes > 0) durationMinutes = diffMinutes;
        }
        const endD = new Date(startD.getTime() + durationMinutes * 60000);
        const pad = (n) => String(n).padStart(2, '0');
        updateFields.endTime = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())} ${pad(endD.getHours())}:${pad(endD.getMinutes())}:${pad(endD.getSeconds())}`;
      }
    }

    await appointmentsRepository.updateWithHistory(appointmentId, updateFields, currentUser.id);

    // Notificar al paciente si corresponde
    if (notifyPatient && appointment.patient_id) {
      const patient = await patientsRepository.findById(appointment.patient_id);
      if (patient && patient.user_id) {
        let profName = 'un nuevo profesional';
        if (targetKinesiologistId) {
          const kine = await usersRepository.findById(targetKinesiologistId);
          if (kine) profName = `Lic. ${kine.last_name}, ${kine.name}`;
        }

        await notificationsService.notify({
          userId: patient.user_id,
          patientId: patient.id,
          type: 'APPOINTMENT_REASSIGNED',
          title: 'Turno reorganizado',
          message: `Tu turno ha sido reorganizado para ser atendido por ${profName} el ${targetDate}.`,
          metadata: { appointmentId, newStartTime: newStartTime || appointment.start_time, targetKinesiologistId }
        });
      }
    }

    await logAudit({
      userId: currentUser.id,
      action: 'VACATION_APPOINTMENT_REASSIGNED',
      entityType: 'appointment',
      entityId: appointmentId,
      details: {
        originalKinesiologistId: appointment.kinesiologist_id,
        targetKinesiologistId,
        newStartTime
      }
    });

    return await appointmentsRepository.findById(appointmentId);
  }

  async getActiveAlerts(currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    if (role !== 'admin' && role !== 'receptionist' && role !== 'recepcionista') {
      return [];
    }

    return await vacationsRepository.findActiveAlerts();
  }

  async isKinesiologistAvailableOnDate(kinesiologistId, dateInput) {
    if (!kinesiologistId || !dateInput) return true;
    const dateStr = String(dateInput).slice(0, 10);
    const vacation = await vacationsRepository.isKinesiologistOnVacation(kinesiologistId, dateStr);
    return !vacation;
  }
}

export const vacationsService = new VacationsService();
