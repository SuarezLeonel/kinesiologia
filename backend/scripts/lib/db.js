import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const databaseRoot = path.resolve(__dirname, '../../../database');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Abre una conexión de administración (con multipleStatements) usando las variables DB_*.
 * Crea la base de datos si no existe.
 */
export async function connectAdmin() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('Faltan DB_HOST, DB_USER o DB_NAME en backend/.env');
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: parseInt(DB_PORT || '3306', 10),
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${DB_NAME}\``);
  return connection;
}
