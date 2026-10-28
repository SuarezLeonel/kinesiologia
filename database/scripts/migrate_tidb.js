import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar directamente las dependencias del backend
import mysql from '../../backend/node_modules/mysql2/promise.js';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';

// Cargar .env de backend
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const host = process.env.DB_HOST;
const port = parseInt(process.env.DB_PORT || '4000', 10);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME || 'test';
const useSsl = process.env.DB_SSL === 'true';

async function runCloudMigration() {
  console.log(`\n==================================================`);
  console.log(`INICIANDO MIGRACIÓN REMOTA A TIDB CLOUD`);
  console.log(`Host: ${host}:${port}`);
  console.log(`User: ${user}`);
  console.log(`Base de datos: ${database}`);
  console.log(`SSL habilitado: ${useSsl}`);
  console.log(`==================================================\n`);

  if (!host || host === '127.0.0.1' || !password) {
    console.error('❌ Error: Asegúrate de configurar las credenciales de TiDB Cloud en backend/.env');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    ssl: { rejectUnauthorized: true },
    multipleStatements: true
  });

  try {
    console.log(`1. Creando / verificando base de datos '${database}'...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);
    console.log(`✅ Base de datos seleccionada: ${database}`);

    const migrationFile = path.resolve(__dirname, '../migrations/001_initial_schema.sql');
    const seedsFile = path.resolve(__dirname, '../seeds/001_demo_data.sql');

    console.log('\n2. Ejecutando migración de tablas (001_initial_schema.sql)...');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');
    await connection.query(migrationSql);
    console.log('✅ Esquema creado con éxito en TiDB Cloud.');

    console.log('\n2. Ejecutando seeds de demostración (001_demo_data.sql)...');
    const seedsSql = fs.readFileSync(seedsFile, 'utf8');
    await connection.query(seedsSql);
    console.log('✅ Datos iniciales sembrados con éxito.');

    console.log('\n🎉 ¡Base de datos en TiDB Cloud configurada y lista para usar!');
  } catch (error) {
    console.error('❌ Error durante la migración en TiDB Cloud:', error.message);
  } finally {
    await connection.end();
  }
}

runCloudMigration();
