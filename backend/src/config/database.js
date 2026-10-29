import mysql from 'mysql2/promise';
import { config } from './env.js';

let pool;

export function getPool() {
  if (!pool || pool._closed) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      decimalNumbers: true,
      ssl: config.db.ssl,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const p = getPool();
  try {
    const [rows] = await p.query(sql, params);
    return rows;
  } catch (err) {
    // Si la conexión se reinició en TiDB (ECONNRESET o PROTOCOL_CONNECTION_LOST), reintentar una vez
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
      const [retryRows] = await p.query(sql, params);
      return retryRows;
    }
    throw err;
  }
}

export async function executeTransaction(callback) {
  const p = getPool();
  const connection = await p.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
