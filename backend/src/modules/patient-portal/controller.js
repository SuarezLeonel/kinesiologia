import { patientPortalService } from './service.js';
import { sendSuccess } from '../../utils/response.js';

export class PatientPortalController {
  async dashboard(req, res, next) {
    try {
      const data = await patientPortalService.dashboard(req.user.id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async myAppointments(req, res, next) {
    try {
      const appointments = await patientPortalService.myAppointments(req.user.id, req.body);
      return sendSuccess(res, appointments);
    } catch (error) {
      next(error);
    }
  }

  async catalog(req, res, next) {
    try {
      const data = await patientPortalService.catalog();
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  async availableSlots(req, res, next) {
    try {
      const slots = await patientPortalService.availableSlots(req.body);
      return sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  }

  async bookAppointment(req, res, next) {
    try {
      const created = await patientPortalService.bookAppointment(req.body, req.user.id);
      return sendSuccess(res, created, 'Turno reservado con éxito', 201);
    } catch (error) {
      next(error);
    }
  }

  async cancelAppointment(req, res, next) {
    try {
      const result = await patientPortalService.cancelAppointment(req.body, req.user.id);
      return sendSuccess(res, result, 'Turno cancelado correctamente');
    } catch (error) {
      next(error);
    }
  }

  async requestReschedule(req, res, next) {
    try {
      const result = await patientPortalService.requestReschedule(req.body, req.user.id);
      return sendSuccess(res, result, 'Solicitud de reprogramación enviada al consultorio', 201);
    } catch (error) {
      next(error);
    }
  }

  async myRescheduleRequests(req, res, next) {
    try {
      const requests = await patientPortalService.myRescheduleRequests(req.user.id);
      return sendSuccess(res, requests);
    } catch (error) {
      next(error);
    }
  }

  async myProfile(req, res, next) {
    try {
      const profile = await patientPortalService.myProfile(req.user.id);
      return sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await patientPortalService.updateProfile(req.user.id, req.body);
      return sendSuccess(res, updated, 'Perfil actualizado con éxito');
    } catch (error) {
      next(error);
    }
  }

  async myNotifications(req, res, next) {
    try {
      const notifs = await patientPortalService.myNotifications(req.user.id);
      return sendSuccess(res, notifs);
    } catch (error) {
      next(error);
    }
  }
}

export const patientPortalController = new PatientPortalController();
