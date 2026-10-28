import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { connectAdmin, databaseRoot } from './lib/db.js';

const migrationsDir = path.join(databaseRoot, 'migrations');

async function run() {
  const connection = await connectAdmin();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [appliedRows] = await connection.query('SELECT filename, checksum FROM schema_migrations');
    const applied = new Map(appliedRows.map((r) => [r.filename, r.checksum]));

    const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    let count = 0;

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(`La migración ${file} ya aplicada fue modificada. Crear una nueva migración en su lugar.`);
        }
        console.log(`= ${file} (ya aplicada)`);
        continue;
      }

      if (/ADD\s+CONSTRAINT\s+\w+\s+CHECK/i.test(sql)) {
        const [vars] = await connection.query("SHOW VARIABLES LIKE 'tidb_enable_check_constraint'");
        if (vars.length && String(vars[0].Value).toUpperCase() !== 'ON') {
          throw new Error(
            `${file} define CHECK pero tidb_enable_check_constraint está en ${vars[0].Value}: TiDB los ignoraría. ` +
            'Ejecutar: SET GLOBAL tidb_enable_check_constraint = ON'
          );
        }
      }

      console.log(`> Aplicando ${file}...`);
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)', [file, checksum]);
      count += 1;
    }

    console.log(`Listo. Migraciones nuevas aplicadas: ${count}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Error en migración:', error.message);
  process.exit(1);
});
