import { query, executeTransaction } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';

export class PaymentsRepository {
  async search({ patientId, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (patientId) {
      conditions.push('p.patient_id = ?');
      params.push(patientId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT p.id, p.patient_id, p.package_id, p.service_id, p.recorded_by, p.amount, p.currency,
             p.payment_method, p.payment_date, p.receipt_number, p.notes, p.created_at,
             pt.first_name as patient_first_name, pt.last_name as patient_last_name,
             u.name as recorded_by_name, u.last_name as recorded_by_last_name,
             s.name as service_name
      FROM payments p
      JOIN patients pt ON p.patient_id = pt.id
      JOIN users u ON p.recorded_by = u.id
      LEFT JOIN services s ON p.service_id = s.id
      ${where}
      ORDER BY p.payment_date DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    return await query(sql, params);
  }

  async findById(id) {
    const rows = await query(`
      SELECT p.id, p.patient_id, p.package_id, p.service_id, p.recorded_by, p.amount, p.currency,
             p.payment_method, p.payment_date, p.receipt_number, p.notes, p.created_at,
             pt.first_name as patient_first_name, pt.last_name as patient_last_name,
             u.name as recorded_by_name, u.last_name as recorded_by_last_name,
             s.name as service_name
      FROM payments p
      JOIN patients pt ON p.patient_id = pt.id
      JOIN users u ON p.recorded_by = u.id
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findByReceiptNumber(receiptNumber) {
    if (!receiptNumber) return null;
    const rows = await query('SELECT id FROM payments WHERE receipt_number = ? LIMIT 1', [receiptNumber]);
    return rows[0] || null;
  }

  async createPaymentAndPackage(data, recordedById) {
    return await executeTransaction(async (conn) => {
      let packageId = null;

      if (data.packageSessions && data.serviceId) {
        const [pkgResult] = await conn.execute(`
          INSERT INTO payment_packages (patient_id, service_id, total_sessions, used_sessions, price_total, status)
          VALUES (?, ?, ?, 0, ?, 'active')
        `, [data.patientId, data.serviceId, data.packageSessions, data.amount]);
        packageId = pkgResult.insertId;

        // Registrar movimiento inicial de saldo
        await conn.execute(`
          INSERT INTO package_session_transactions (package_id, change_amount, balance_after, reason, recorded_by)
          VALUES (?, ?, ?, 'Alta de paquete', ?)
        `, [packageId, data.packageSessions, data.packageSessions, recordedById]);
      }

      const [payResult] = await conn.execute(`
        INSERT INTO payments (patient_id, package_id, service_id, recorded_by, amount, currency, payment_method, payment_date, receipt_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `, [
        data.patientId,
        packageId,
        data.serviceId || null,
        recordedById,
        data.amount,
        data.currency || 'ARS',
        data.paymentMethod,
        data.receiptNumber || null,
        data.notes || null
      ]);

      return { paymentId: payResult.insertId, packageId };
    });
  }

  async consumePackageSession({ packageId, sessionId, reason, recordedById }) {
    return await executeTransaction(async (conn) => {
      // Bloqueo con FOR UPDATE para evitar condiciones de carrera concurrentes
      const [pkgs] = await conn.execute(
        'SELECT total_sessions, used_sessions, status FROM payment_packages WHERE id = ? FOR UPDATE',
        [packageId]
      );

      if (pkgs.length === 0) {
        throw new AppError('Paquete de sesiones no encontrado', 404, 'NOT_FOUND');
      }

      const pkg = pkgs[0];
      const balance = pkg.total_sessions - pkg.used_sessions;
      if (balance <= 0 || pkg.status !== 'active') {
        throw new AppError('El paquete no dispone de sesiones disponibles', 400, 'INSUFFICIENT_SESSIONS');
      }

      const newUsed = pkg.used_sessions + 1;
      const newStatus = newUsed >= pkg.total_sessions ? 'exhausted' : 'active';

      await conn.execute(
        'UPDATE payment_packages SET used_sessions = ?, status = ? WHERE id = ?',
        [newUsed, newStatus, packageId]
      );

      await conn.execute(`
        INSERT INTO package_session_transactions (package_id, session_id, change_amount, balance_after, reason, recorded_by)
        VALUES (?, ?, -1, ?, ?, ?)
      `, [packageId, sessionId || null, pkg.total_sessions - newUsed, reason || 'Consumo de sesión', recordedById]);

      return {
        balanceRemaining: pkg.total_sessions - newUsed,
        status: newStatus
      };
    });
  }

  async searchPackages({ patientId, status }) {
    const conditions = ['p.patient_id = ?'];
    const params = [patientId];

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    return await query(`
      SELECT p.id, p.patient_id, p.service_id, s.name as service_name,
             p.total_sessions, p.used_sessions, (p.total_sessions - p.used_sessions) as remaining_sessions,
             p.price_total, p.status, p.created_at, p.updated_at
      FROM payment_packages p
      JOIN services s ON p.service_id = s.id
      ${where}
      ORDER BY p.created_at DESC
    `, params);
  }
}

export const paymentsRepository = new PaymentsRepository();
