import { query } from '../../config/database.js';

export class NotificationsRepository {
  async create({ userId, patientId, type, title, message, channel = 'in_app', status = 'sent', metadata = null }) {
    const result = await query(`
      INSERT INTO notifications (user_id, patient_id, type, title, message, channel, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId || null,
      patientId || null,
      type,
      title,
      message,
      channel,
      status,
      metadata ? JSON.stringify(metadata) : null
    ]);
    return result.insertId;
  }

  async findByUserId(userId, limit = 20) {
    return await query(`
      SELECT id, user_id, patient_id, type, title, message, channel, status, metadata, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, limit]);
  }

  async findByPatientId(patientId, limit = 20) {
    return await query(`
      SELECT id, user_id, patient_id, type, title, message, channel, status, metadata, created_at
      FROM notifications
      WHERE patient_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [patientId, limit]);
  }

  async markAsRead(id, userId) {
    await query(`
      UPDATE notifications
      SET status = 'read'
      WHERE id = ? AND user_id = ?
    `, [id, userId]);
  }
}

export const notificationsRepository = new NotificationsRepository();
