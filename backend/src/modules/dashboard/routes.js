import { Router } from 'express';
import { query } from '../../config/database.js';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);

const dashboardSummarySchema = z.object({
  body: z.object({
    date: z.string().optional()
  })
});

// Regla HTTP: POST para obtener resumen del dashboard
dashboardRouter.post('/summary', validate(dashboardSummarySchema), async (req, res, next) => {
  try {
    const targetDate = req.body.date || new Date().toISOString().slice(0, 10);
    const userRole = req.user.role;

    // Métricas generales de turnos del día
    const appointmentsToday = await query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) as attended,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM appointments
      WHERE DATE(start_time) = ?
    `, [targetDate]);

    // Total de pacientes activos
    const totalPatients = await query('SELECT COUNT(*) as total FROM patients WHERE is_active = 1');

    // Tratamientos activos
    const activeTreatments = await query('SELECT COUNT(*) as total FROM treatments WHERE status = "active"');

    let financialSummary = null;
    // Ingresos solo para roles autorizados (Admin y Recepcionista para caja del día)
    if (userRole === 'admin' || userRole === 'receptionist') {
      const paymentsToday = await query(`
        SELECT COALESCE(SUM(amount), 0) as totalIncome, COUNT(*) as transactionsCount
        FROM payments
        WHERE DATE(payment_date) = ?
      `, [targetDate]);
      financialSummary = paymentsToday[0];
    }

    return sendSuccess(res, {
      date: targetDate,
      appointments: appointmentsToday[0],
      totalPatients: totalPatients[0].total,
      activeTreatments: activeTreatments[0].total,
      financial: financialSummary
    });
  } catch (error) {
    next(error);
  }
});
