import { dashboardRepository } from './repository.js';

export class DashboardService {
  async getSummary({ date, currentUser }) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const isKine = currentUser.role === 'kinesiologist';
    const kineId = isKine ? currentUser.id : null;

    const [appointments, totalPatients, activeTreatments] = await Promise.all([
      dashboardRepository.getAppointmentsMetrics(targetDate, kineId),
      dashboardRepository.getActivePatientsCount(kineId),
      dashboardRepository.getActiveTreatmentsCount(kineId)
    ]);

    let financial = null;
    // La información financiera y de cobros solo es accesible para Admin y Recepcionista
    if (currentUser.role === 'admin' || currentUser.role === 'receptionist') {
      financial = await dashboardRepository.getFinancialMetrics(targetDate);
    }

    return {
      date: targetDate,
      appointments,
      totalPatients,
      activeTreatments,
      financial
    };
  }
}

export const dashboardService = new DashboardService();
