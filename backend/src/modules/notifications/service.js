import { notificationsRepository } from './repository.js';

export class NotificationsService {
  /**
   * Envia y almacena una notificacion en el sistema sin datos clinicos sensibles
   */
  async notify({ userId, patientId, type, title, message, channel = 'in_app', metadata = null }) {
    try {
      const id = await notificationsRepository.create({
        userId,
        patientId,
        type,
        title,
        message,
        channel,
        status: 'sent',
        metadata
      });
      return { id, success: true };
    } catch (err) {
      console.error('Error registrando notificación:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getMyNotifications(userId, limit = 20) {
    const list = await notificationsRepository.findByUserId(userId, limit);
    return list.map((item) => ({
      ...item,
      metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata
    }));
  }

  async markRead(id, userId) {
    await notificationsRepository.markAsRead(id, userId);
    return { success: true };
  }
}

export const notificationsService = new NotificationsService();
