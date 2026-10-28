import { Router } from 'express';
import { query, executeTransaction } from '../../config/database.js';
import { authenticateToken, authorizeRoles, authorizePermission } from '../../middlewares/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';
import { z } from 'zod';

export const paymentsRouter = Router();
paymentsRouter.use(authenticateToken);
// Cobros y paquetes autorizados para Admin y Recepcionista
paymentsRouter.use(authorizeRoles('admin', 'receptionist'));
paymentsRouter.use(authorizePermission('payments:manage'));

const paymentSearchSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(50)
  })
});

const paymentCreateSchema = z.object({
  body: z.object({
    patientId: z.number().int().positive(),
    amount: z.number().positive(),
    paymentMethod: z.enum(['cash', 'transfer', 'debit_card', 'credit_card', 'insurance']),
    currency: z.string().default('ARS'),
    receiptNumber: z.string().optional(),
    notes: z.string().optional(),
    serviceId: z.number().int().positive().optional(),
    packageSessions: z.number().int().positive().optional() // Si compra paquete de N sesiones
  })
});

const sessionConsumeSchema = z.object({
  body: z.object({
    packageId: z.number().int().positive(),
    sessionId: z.number().int().positive().optional(),
    reason: z.string().default('Consumo de sesión')
  })
});

// REGLA HTTP ESTRICTA: Solo POST para consultas de pagos
paymentsRouter.post('/search', validate(paymentSearchSchema), asyncHandler(async (req, res) => {
  const { patientId, page, limit } = req.body;
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (patientId) { conditions.push('p.patient_id = ?'); params.push(patientId); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT p.*, pt.first_name as patient_first_name, pt.last_name as patient_last_name,
           u.name as recorded_by_name, u.last_name as recorded_by_last_name
    FROM payments p
    JOIN patients pt ON p.patient_id = pt.id
    JOIN users u ON p.recorded_by = u.id
    ${where}
    ORDER BY p.payment_date DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);
  const rows = await query(sql, params);
  return sendSuccess(res, rows);
}));

// Registrar pago y opcionalmente crear paquete de sesiones (transaccional contra duplicados)
paymentsRouter.post('/', validate(paymentCreateSchema), asyncHandler(async (req, res) => {
  const data = req.body;
  const result = await executeTransaction(async (conn) => {
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
      `, [packageId, data.packageSessions, data.packageSessions, req.user.id]);
    }

    const [payResult] = await conn.execute(`
      INSERT INTO payments (patient_id, package_id, service_id, recorded_by, amount, currency, payment_method, payment_date, receipt_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `, [data.patientId, packageId, data.serviceId || null, req.user.id, data.amount, data.currency, data.paymentMethod, data.receiptNumber || null, data.notes || null]);

    return { paymentId: payResult.insertId, packageId };
  });

  await logAudit({
    userId: req.user.id,
    action: 'PAYMENT_RECORDED',
    entityType: 'payment',
    entityId: result.paymentId,
    details: { patientId: data.patientId, amount: data.amount, method: data.paymentMethod }
  });

  return sendSuccess(res, result, 'Pago registrado con éxito', 201);
}));

// Consumir sesión de paquete (previene duplicaciones y saldos negativos)
paymentsRouter.post('/consume-session', validate(sessionConsumeSchema), asyncHandler(async (req, res) => {
  const { packageId, sessionId, reason } = req.body;
  const result = await executeTransaction(async (conn) => {
    // Bloqueo con FOR UPDATE para evitar condiciones de carrera concurrentes
    const [pkgs] = await conn.execute('SELECT total_sessions, used_sessions, status FROM payment_packages WHERE id = ? FOR UPDATE', [packageId]);
    if (pkgs.length === 0) {
      throw new AppError('Paquete no encontrado', 404, 'NOT_FOUND');
    }

    const pkg = pkgs[0];
    const balance = pkg.total_sessions - pkg.used_sessions;
    if (balance <= 0 || pkg.status !== 'active') {
      throw new AppError('El paquete no dispone de sesiones disponibles', 400, 'INSUFFICIENT_SESSIONS');
    }

    const newUsed = pkg.used_sessions + 1;
    const newStatus = newUsed >= pkg.total_sessions ? 'exhausted' : 'active';

    await conn.execute('UPDATE payment_packages SET used_sessions = ?, status = ? WHERE id = ?', [newUsed, newStatus, packageId]);

    await conn.execute(`
      INSERT INTO package_session_transactions (package_id, session_id, change_amount, balance_after, reason, recorded_by)
      VALUES (?, ?, -1, ?, ?, ?)
    `, [packageId, sessionId || null, pkg.total_sessions - newUsed, reason, req.user.id]);

    return { balanceRemaining: pkg.total_sessions - newUsed, status: newStatus };
  });

  await logAudit({
    userId: req.user.id,
    action: 'SESSION_CONSUMED',
    entityType: 'payment_package',
    entityId: packageId,
    details: { sessionId, balanceRemaining: result.balanceRemaining }
  });

  return sendSuccess(res, result, 'Sesión descontada correctamente');
}));
