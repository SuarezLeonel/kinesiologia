import { query } from '../../config/database.js';

export class AuthRepository {
  async findUserByEmail(email) {
    const rows = await query(`
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.email, u.password_hash, u.is_active
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
      LIMIT 1
    `, [email]);
    return rows[0] || null;
  }

  async findUserById(id) {
    const rows = await query(`
      SELECT u.id, u.role_id, r.name as role_name, u.name, u.last_name, u.email, u.is_active
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async findRoleByName(name) {
    const rows = await query('SELECT id, name FROM roles WHERE name = ? LIMIT 1', [name]);
    return rows[0] || null;
  }

  async createUser({ name, lastName, email, passwordHash, phone, roleId, isActive = true }) {
    const result = await query(`
      INSERT INTO users (role_id, name, last_name, email, password_hash, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [roleId, name, lastName, email, passwordHash, phone || null, isActive ? 1 : 0]);
    return result.insertId;
  }

  async saveRefreshToken({ userId, tokenHash, expiresAt, ipAddress, userAgent }) {
    await query(`
      INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, tokenHash, expiresAt, ipAddress || null, userAgent || null]);
  }

  async findRefreshToken(tokenHash) {
    const rows = await query(`
      SELECT id, user_id, token_hash, expires_at, revoked_at
      FROM auth_refresh_tokens
      WHERE token_hash = ?
      LIMIT 1
    `, [tokenHash]);
    return rows[0] || null;
  }

  async revokeRefreshToken(tokenHash) {
    await query(`
      UPDATE auth_refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
    `, [tokenHash]);
  }

  async revokeAllUserRefreshTokens(userId) {
    await query(`
      UPDATE auth_refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND revoked_at IS NULL
    `, [userId]);
  }
}

export const authRepository = new AuthRepository();
