/**
 * @file database.js
 * @description Configuración del pool de conexiones MySQL / TiDB mediante mysql2/promise.
 * Ofrece métodos utilitarios para ejecución de consultas SQL parametrizadas,
 * soporte de reconexión transparente y transaccionalidad ACID.
 */

import mysql from 'mysql2/promise';
import { config } from './env.js';

let pool;

/**
 * Obtiene o inicializa el pool único de conexiones a la base de datos MySQL.
 * Configura límites de conexión, keep-alive y soporte TLS/SSL para conexiones cloud.
 * @returns {import('mysql2/promise').Pool} Instancia activa del pool de mysql2.
 */
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

/**
 * Ejecuta una consulta SQL parametrizada con reintento automático ante caídas de conexión.
 * Garantiza mitigación contra inyecciones SQL al utilizar sentencias preparadas (placeholders '?').
 * @param {string} sql - Sentencia SQL a ejecutar.
 * @param {Array<*>} [params=[]] - Parámetros a sustituir en los placeholders '?'.
 * @returns {Promise<Array<Object>|Object>} Filas resultantes o metadatos de inserción/actualización.
 * @throws {Error} Si la consulta falla o la conexión es irrecuperable.
 */
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

/**
 * Ejecuta una serie de operaciones dentro de una transacción ACID aislada.
 * Hace commit si el callback finaliza con éxito o rollback automático ante cualquier excepción.
 * @template T
 * @param {function(import('mysql2/promise').PoolConnection): Promise<T>} callback - Función con las operaciones SQL.
 * @returns {Promise<T>} Resultado devuelto por el callback.
 * @throws {Error} Re-lanza cualquier error producido dentro de la transacción tras ejecutar el rollback.
 */
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
