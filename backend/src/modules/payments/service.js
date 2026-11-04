/**
 * @file service.js
 * @module payments
 * @description Lógica financiera: control de saldos de paquetes, arqueo de caja y emisión de recibos únicos.
 * Garantiza reutilización estricta de prestaciones existentes e inmutabilidad de importes.
 */
import { paymentsRepository } from './repository.js';
import { patientsRepository } from '../patients/repository.js';
import { appointmentsRepository } from '../appointments/repository.js';
import { servicesRepository } from '../services/repository.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { logAudit } from '../../utils/auditLogger.js';

export class PaymentsService {
  async search(filters) {
    return await paymentsRepository.search(filters);
  }

  async getCajaSummary(date) {
    return await paymentsRepository.getCajaSummary(date);
  }

  async getDetail(id) {
    const payment = await paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('Pago no encontrado');
    }
    return payment;
  }

  async create(data, currentUser) {
    // 1. Validar paciente
    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }

    let finalAmount = data.amount;
    let serviceId = data.serviceId || null;

    // 2. Si se asocia a un turno / consulta realizada:
    if (data.appointmentId) {
      const appointment = await appointmentsRepository.findById(data.appointmentId);
      if (!appointment) {
        throw new NotFoundError('Turno no encontrado');
      }

      // Validar que el turno pertenezca al paciente seleccionado
      if (Number(appointment.patient_id) !== Number(data.patientId)) {
        throw new BadRequestError('El turno seleccionado no pertenece al paciente indicado');
      }

      // Comprobar que el turno esté realizado/asistido ('attended') y habilitado para cobrar
      if (appointment.status !== 'attended') {
        throw new BadRequestError('Solo se pueden cobrar turnos que hayan sido realizados/asistidos (estado atendido)');
      }

      // Evitar que un mismo turno pueda cobrarse más de una vez
      const alreadyPaid = await paymentsRepository.findByAppointmentId(data.appointmentId);
      if (alreadyPaid) {
        throw new ConflictError('La consulta o turno ya fue cobrado previamente');
      }

      // Recuperar el tipo de prestación y consultar su precio vigente
      serviceId = appointment.service_id;
      let effectivePrice = 0;

      if (appointment.agreed_price && Number(appointment.agreed_price) > 0) {
        effectivePrice = Number(appointment.agreed_price);
      } else if (serviceId) {
        const srv = await servicesRepository.findById(serviceId);
        effectivePrice = srv ? Number(srv.default_price) : 0;
      }

      if (effectivePrice <= 0) {
        throw new BadRequestError('No se pudo determinar el precio vigente de la consulta');
      }

      // SEGURIDAD BACKEND: Ignorar cualquier monto enviado o manipulado desde el frontend.
      // Se fija automáticamente con el precio determinado de la prestación existente.
      finalAmount = effectivePrice;
    } else {
      // Sin turno vinculado (ej. venta directa de paquete o adelanto libre)
      if (!finalAmount || Number(finalAmount) <= 0) {
        throw new BadRequestError('El importe a cobrar debe ser mayor a 0');
      }
    }

    // Idempotencia por número de recibo si se especifica
    if (data.receiptNumber) {
      const existing = await paymentsRepository.findByReceiptNumber(data.receiptNumber);
      if (existing) {
        throw new ConflictError(`Ya existe un comprobante registrado con el número ${data.receiptNumber}`);
      }
    }

    const payload = {
      ...data,
      amount: finalAmount,
      serviceId,
      appointmentId: data.appointmentId || null
    };

    const result = await paymentsRepository.createPaymentAndPackage(payload, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'PAYMENT_RECORDED',
      entityType: 'payment',
      entityId: result.paymentId,
      details: {
        patientId: data.patientId,
        appointmentId: data.appointmentId || null,
        amount: finalAmount,
        paymentMethod: data.paymentMethod,
        packageId: result.packageId
      }
    });

    return await paymentsRepository.findById(result.paymentId);
  }

  async consumeSession(data, currentUser) {
    const result = await paymentsRepository.consumePackageSession({
      ...data,
      recordedById: currentUser.id
    });

    await logAudit({
      userId: currentUser.id,
      action: 'SESSION_CONSUMED',
      entityType: 'payment_package',
      entityId: data.packageId,
      details: {
        sessionId: data.sessionId,
        reason: data.reason,
        balanceRemaining: result.balanceRemaining
      }
    });

    return result;
  }

  async searchPackages(filters) {
    const patient = await patientsRepository.findById(filters.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }
    return await paymentsRepository.searchPackages(filters);
  }
}

export const paymentsService = new PaymentsService();
