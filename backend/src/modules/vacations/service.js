/**
 * @file service.js
 * @module vacations
 * @description Lógica de negocio para las vacaciones de los kinesiólogos, cancelación automática de turnos
 * afectados, bloqueo de disponibilidad y notificaciones de seguimiento para recepción.
 */
import { vacationsRepository } from './repository.js';
import { usersRepository } from '../users/repository.js';
import { notificationsService } from '../notifications/service.js';
import { query } from '../../config/database.js';
import { getClinicDateString, getClinicDateTimeString, addCalendarDays } from '../../utils/date.js';
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

    const today = this._getTodayStr();
    // Sincronizar estados del ciclo de vida (scheduled -> active -> completed) antes de filtrar
    await vacationsRepository.syncLifecycleStatuses(today);

    return await vacationsRepository.search(filters);
  }

  /**
   * Resuelve y autoriza el kinesiólogo destino según el rol del usuario autenticado.
   * El administrador debe indicar un kinesiólogo activo (nunca a sí mismo ni a otros roles);
   * el kinesiólogo solo puede operar sobre sus propios períodos.
   */
  async _resolveTargetKinesiologist(rawKinesiologistId, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;

    if (role === 'kinesiologist' || role === 'kinesiologo') {
      if (
        rawKinesiologistId !== undefined &&
        rawKinesiologistId !== null &&
        Number(rawKinesiologistId) !== Number(currentUser.id)
      ) {
        throw new ForbiddenError('No puede registrar ni consultar vacaciones de otro profesional');
      }
      const selfUser = await usersRepository.findById(currentUser.id);
      if (!selfUser || !selfUser.is_active) {
        throw new ForbiddenError('Su usuario profesional no se encuentra activo');
      }
      return selfUser;
    }

    if (role === 'admin') {
      if (!rawKinesiologistId) {
        throw new BadRequestError('Debe seleccionar un kinesiólogo para gestionar sus vacaciones');
      }
      if (Number(rawKinesiologistId) === Number(currentUser.id)) {
        throw new BadRequestError('El administrador no registra vacaciones propias; seleccione un kinesiólogo');
      }
      const targetUser = await usersRepository.findById(Number(rawKinesiologistId));
      if (!targetUser) {
        throw new NotFoundError('Kinesiólogo seleccionado no encontrado');
      }
      if (targetUser.role_name !== 'kinesiologist' && targetUser.role_name !== 'kinesiologo') {
        throw new BadRequestError('Solo se pueden registrar vacaciones para profesionales con rol kinesiólogo');
      }
      if (!targetUser.is_active) {
        throw new BadRequestError('El kinesiólogo seleccionado no se encuentra activo');
      }
      return targetUser;
    }

    throw new ForbiddenError('No posee permisos para registrar períodos de vacaciones');
  }

  async preview({ kinesiologistId, startDate, endDate }, currentUser) {
    const targetKine = await this._resolveTargetKinesiologist(kinesiologistId, currentUser);
    const targetKineId = targetKine.id;

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
    const kinesiologistFullName = `${targetKine.name} ${targetKine.last_name}`.trim();

    return {
      kinesiologistId: targetKineId,
      kinesiologistName: kinesiologistFullName,
      kinesiologistDisplayName: `Lic. ${targetKine.last_name}, ${targetKine.name}`,
      startDate,
      endDate,
      affectedCount: affected.length,
      hasConflicts: affected.length > 0,
      affectedAppointments: affected
    };
  }

  async create(data, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    const kine = await this._resolveTargetKinesiologist(data.kinesiologistId, currentUser);
    const targetKineId = kine.id;

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

    const initialStatus = data.startDate <= today ? 'active' : 'scheduled';
    const kineFullName = `${kine.name} ${kine.last_name}`.trim();
    const kineLabel = `Lic. ${kine.last_name}, ${kine.name}`;
    const isCreatedByAdmin = role === 'admin';

    const { vacationId: id, cancelledAppointments } = await vacationsRepository.createWithAutoCancellations({
      kinesiologistId: targetKineId,
      kineFullName,
      startDate: data.startDate,
      endDate: data.endDate,
      status: initialStatus,
      notes: data.notes || null,
      createdBy: currentUser.id,
      changedByUserId: currentUser.id
    });

    // Si se cancelaron turnos automáticamente, registrar un aviso por integrante de recepción/admin
    if (cancelledAppointments.length > 0) {
      const staffUsers = await query(`
        SELECT u.id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name IN ('receptionist', 'admin') AND u.is_active = 1
      `);

      const countText = cancelledAppointments.length === 1
        ? '1 turno asignado fue cancelado automáticamente'
        : `${cancelledAppointments.length} turnos asignados fueron cancelados automáticamente`;

      const notificationTitle = isCreatedByAdmin
        ? `Turnos cancelados por vacaciones (Admin) — ${kineFullName}`
        : `Turnos cancelados por vacaciones — ${kineFullName}`;
      const notificationMessage =
        `Se registraron vacaciones para ${kineFullName} (${data.startDate} al ${data.endDate}). ` +
        `${countText}. Por favor, contactá a los pacientes afectados desde la sección de notificaciones.`;

      for (const staff of staffUsers) {
        await notificationsService.notify({
          userId: staff.id,
          type: 'KINESIOLOGIST_VACATION_AFFECTED_APPOINTMENTS',
          title: notificationTitle,
          message: notificationMessage,
          metadata: {
            vacationId: id,
            kinesiologistId: targetKineId,
            kinesiologistName: kineLabel,
            kinesiologistFullName: kineFullName,
            createdBy: currentUser.id,
            createdByRole: role,
            startDate: data.startDate,
            endDate: data.endDate,
            cancelledAppointmentsCount: cancelledAppointments.length,
            affectedAppointmentIds: cancelledAppointments.map((a) => a.id)
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
        createdByRole: role,
        startDate: data.startDate,
        endDate: data.endDate,
        affectedAppointmentsCount: cancelledAppointments.length,
        cancelledAppointmentsCount: cancelledAppointments.length
      }
    });

    const created = await vacationsRepository.findById(id);
    return {
      ...created,
      cancelledAppointmentsCount: cancelledAppointments.length,
      cancelledAppointments
    };
  }

  async cancel(id, reason, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    const isAdmin = role === 'admin';
    const isKine = role === 'kinesiologist' || role === 'kinesiologo';

    if (!isAdmin && !isKine) {
      throw new ForbiddenError('No posee permisos para cancelar períodos de vacaciones');
    }

    const now = new Date();
    const today = getClinicDateString(now);
    const previousDay = addCalendarDays(today, -1);
    const cancelledAt = getClinicDateTimeString(now);
    const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

    const { previousRecord, previousStatus, wasInProgress, effectiveEndDate } =
      await vacationsRepository.cancelAtomic({
        id,
        cancelledBy: currentUser.id,
        cancelledAt,
        today,
        previousDay,
        reason: cleanReason,
        authorize: (row) => {
          if (isKine && Number(row.kinesiologist_id) !== Number(currentUser.id)) {
            throw new ForbiddenError('Solo puede cancelar sus propios períodos de vacaciones');
          }
        }
      });

    const freedFromDate = wasInProgress ? today : previousRecord.start_date;

    await logAudit({
      userId: currentUser.id,
      action: 'KINESIOLOGIST_VACATION_CANCELLED',
      entityType: 'kinesiologist_vacations',
      entityId: id,
      details: {
        kinesiologistId: previousRecord.kinesiologist_id,
        previousStatus,
        wasInProgress,
        originalStartDate: previousRecord.start_date,
        originalEndDate: previousRecord.end_date,
        effectiveEndDate,
        freedFromDate,
        cancelledAt,
        cancelledBy: currentUser.id,
        cancelledByRole: role,
        reason: cleanReason
      }
    });

    const updated = await vacationsRepository.findById(id);

    return {
      ...updated,
      id,
      status: 'cancelled',
      wasInProgress,
      previousStatus,
      freedFromDate,
      success: true,
      message: wasInProgress
        ? 'Vacaciones en curso canceladas; la disponibilidad quedó restablecida a partir de hoy'
        : 'Período de vacaciones cancelado con éxito'
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
    if (
      role !== 'admin' &&
      role !== 'receptionist' &&
      role !== 'recepcionista' &&
      role !== 'kinesiologist' &&
      role !== 'kinesiologo'
    ) {
      throw new ForbiddenError('No posee permisos para consultar turnos afectados');
    }
    if ((role === 'kinesiologist' || role === 'kinesiologo') && Number(kinesiologistId) !== Number(currentUser.id)) {
      throw new ForbiddenError('Solo puede consultar turnos de sus propias vacaciones');
    }

    if (vacationId) {
      return await vacationsRepository.findCancelledByVacation(vacationId);
    }

    const cleanStart = String(startDate).slice(0, 10);
    const cleanEnd = String(endDate).slice(0, 10);

    return await vacationsRepository.findAffectedAppointments(kinesiologistId, cleanStart, cleanEnd);
  }

  async reassignAppointment(_params, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    if (role !== 'admin' && role !== 'receptionist' && role !== 'recepcionista') {
      throw new ForbiddenError('Solo el personal de recepción o administración puede gestionar turnos afectados');
    }

    throw new BadRequestError(
      'Los turnos afectados por vacaciones se cancelan automáticamente y no se reprograman ni reasignan a otro profesional.'
    );
  }

  async getCancellationNotifications(filters, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    if (role !== 'admin' && role !== 'receptionist' && role !== 'recepcionista') {
      throw new ForbiddenError('No posee permisos para consultar notificaciones de turnos cancelados');
    }

    const [items, summary] = await Promise.all([
      vacationsRepository.findCancellationNotifications(filters || {}),
      vacationsRepository.getCancellationNotificationsSummary({
        vacationId: filters?.vacationId,
        kinesiologistId: filters?.kinesiologistId
      })
    ]);

    return { items, summary };
  }

  async markCancellationNotificationSent(notificationId, currentUser) {
    const role = currentUser?.role || currentUser?.role_name;
    if (role !== 'admin' && role !== 'receptionist' && role !== 'recepcionista') {
      throw new ForbiddenError('No posee permisos para marcar notificaciones de pacientes como enviadas');
    }

    const existing = await vacationsRepository.findCancellationNotificationById(notificationId);
    if (!existing) {
      throw new NotFoundError('Notificación de turno cancelado no encontrada');
    }

    const updated = await vacationsRepository.markCancellationNotificationAsSent(notificationId, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'VACATION_CANCELLATION_NOTIFICATION_SENT',
      entityType: 'vacation_cancellation_notifications',
      entityId: notificationId,
      details: {
        vacationId: existing.vacation_id,
        appointmentId: existing.appointment_id,
        patientId: existing.patient_id,
        alreadyNotified: existing.tracking_status === 'notified'
      }
    });

    return updated;
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
