/**
 * @file reset-db.js
 * @description Resetea la base de datos de KinesioGestión desde 0.
 * Elimina todas las tablas existentes de forma segura, ejecuta todas las migraciones
 * en orden (001 a 015) y aplica los seeds iniciales con el Administrador configurado.
 *
 * Uso:
 *   node backend/scripts/reset-db.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectAdmin, databaseRoot } from './lib/db.js';

const migrationsDir = path.join(databaseRoot, 'migrations');

async function dropAllTables(connection) {
  console.log('1. Eliminando todas las tablas existentes...');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    const [tables] = await connection.query('SHOW TABLES');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      console.log(`   - Eliminando tabla: ${tableName}`);
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
    console.log('✔ Todas las tablas fueron eliminadas exitosamente.');
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function runMigrations(connection) {
  console.log('\n2. Ejecutando migraciones versionadas desde 0...');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  let count = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    if (/ADD\s+CONSTRAINT\s+\w+\s+CHECK/i.test(sql)) {
      const [vars] = await connection.query("SHOW VARIABLES LIKE 'tidb_enable_check_constraint'");
      if (vars.length && String(vars[0].Value).toUpperCase() !== 'ON') {
        throw new Error(
          `${file} define CHECK pero tidb_enable_check_constraint está en ${vars[0].Value}: TiDB los ignoraría. ` +
          'Ejecutar: SET GLOBAL tidb_enable_check_constraint = ON'
        );
      }
    }

    console.log(`   > Aplicando migración ${file}...`);
    await connection.query(sql);
    await connection.query('INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)', [file, checksum]);
    count += 1;
  }

  console.log(`✔ Migraciones aplicadas correctamente: ${count}`);
}

async function runSeeds(connection) {
  console.log('\n3. Sembrando datos iniciales y cuenta de Administrador...');

  const adminEmail = process.env.ADMIN_EMAIL || 'kinesiogestion58@gmail.com';
  const defaultPassword = process.env.DEMO_USER_PASSWORD || 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const demoUsers = [
    { roleName: 'admin', name: 'Laura', lastName: 'Admin', email: adminEmail, phone: '+5491100010001' },
    { roleName: 'kinesiologist', name: 'Carlos', lastName: 'Kinesio', email: 'carlos.kine@kinesiologia.com', phone: '+5491100020002' },
    { roleName: 'receptionist', name: 'Mariana', lastName: 'Recep', email: 'mariana.recep@kinesiologia.com', phone: '+5491100030003' }
  ];

  const [roles] = await connection.query('SELECT id, name FROM roles');
  const roleIds = new Map(roles.map((r) => [r.name, r.id]));

  for (const u of demoUsers) {
    await connection.query(
      `INSERT INTO users (role_id, name, last_name, email, password_hash, phone, is_active, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email_verified_at = CURRENT_TIMESTAMP`,
      [roleIds.get(u.roleName), u.name, u.lastName, u.email, passwordHash, u.phone]
    );
    console.log(`   ✔ Usuario creado: [${u.roleName.toUpperCase()}] ${u.email}`);
  }

  const demoDataSqlPath = path.join(databaseRoot, 'seeds', '001_demo_data.sql');
  if (fs.existsSync(demoDataSqlPath)) {
    const sql = fs.readFileSync(demoDataSqlPath, 'utf8');
    await connection.query(sql);
    console.log('   ✔ Datos de demostración (servicios, pacientes demo) insertados.');
  }

  const exercisesSqlPath = path.join(databaseRoot, 'seeds', '002_exercises_catalog.sql');
  if (fs.existsSync(exercisesSqlPath)) {
    const exercisesSql = fs.readFileSync(exercisesSqlPath, 'utf8');
    await connection.query(exercisesSql);
    console.log('   ✔ Catálogo clínico de ejercicios sembrado con éxito.');
  }
}

async function verifyFinalState(connection) {
  console.log('\n4. Verificando estado final...');
  const [users] = await connection.query(`
    SELECT u.id, u.email, u.name, u.last_name, r.name AS role, u.is_active, u.email_verified_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.id ASC
  `);
  console.log('\nUsuarios en base de datos:');
  console.table(users);

  const [tables] = await connection.query('SHOW TABLES');
  console.log(`\nTotal de tablas creadas: ${tables.length}`);
}

async function main() {
  console.log('========================================================');
  console.log(' KinesioGestión — Reset Integral de Base de Datos desde 0');
  console.log('========================================================\n');

  const connection = await connectAdmin();
  try {
    await dropAllTables(connection);
    await runMigrations(connection);
    await runSeeds(connection);
    await verifyFinalState(connection);
    console.log('\n========================================================');
    console.log(' 🎉 ¡BASE DE DATOS RESETEADA DESDE 0 EXITOSAMENTE!');
    console.log('========================================================');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('\n❌ ERROR al resetear la base de datos:', err);
  process.exit(1);
});

