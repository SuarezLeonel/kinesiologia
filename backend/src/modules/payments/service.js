/**
 * @file service.js
 * @module payments
 * @description Lógica financiera: control de saldos de paquetes, arqueo de caja y emisión de recibos únicos.
 */
import { paymentsRepository } from './repository.js';
import { patientsRepository } from '../patients/repository.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
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
    // Validar paciente
    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Paciente no encontrado');
    }

    // Idempotencia por número de recibo si se especifica
    if (data.receiptNumber) {
      const existing = await paymentsRepository.findByReceiptNumber(data.receiptNumber);
      if (existing) {
        throw new ConflictError(`Ya existe un comprobante registrado con el número ${data.receiptNumber}`);
      }
    }

    const result = await paymentsRepository.createPaymentAndPackage(data, currentUser.id);

    await logAudit({
      userId: currentUser.id,
      action: 'PAYMENT_RECORDED',
      entityType: 'payment',
      entityId: result.paymentId,
      details: {
        patientId: data.patientId,
        amount: data.amount,
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
