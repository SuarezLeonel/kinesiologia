import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationFile = path.resolve(__dirname, '../migrations/001_initial_schema.sql');
const seedsFile = path.resolve(__dirname, '../seeds/001_demo_data.sql');

function validateSqlFile(filePath) {
  console.log(`\nValidando: ${path.basename(filePath)}`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Verificar tablas creadas
  const tableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi)];
  console.log(`- Tablas detectadas (${tableMatches.length}):`, tableMatches.map(m => m[1]).join(', '));

  // Verificar foreign keys
  const fkMatches = [...content.matchAll(/CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY/gi)];
  console.log(`- Claves Foráneas detectadas: ${fkMatches.length}`);

  // Verificar que no haya campos de listas serializadas de IDs (ej: VARCHAR con comentarios o nombres sospechosos como id_list o ids)
  const suspiciousCommaList = /ids\s+varchar|id_list|comma_separated/i.test(content);
  if (suspiciousCommaList) {
    console.warn('⚠️ Alerta: se detectaron posibles listas serializadas de IDs.');
  } else {
    console.log('- Verificación de normalización: Sin listas de IDs por comas.');
  }

  // Verificar balance de paréntesis
  let parenBalance = 0;
  for (const char of content) {
    if (char === '(') parenBalance++;
    if (char === ')') parenBalance--;
  }
  if (parenBalance !== 0) {
    throw new Error(`Paréntesis desbalanceados en ${filePath}: balance=${parenBalance}`);
  } else {
    console.log('- Sintaxis básica: Paréntesis balanceados.');
  }
}

try {
  validateSqlFile(migrationFile);
  validateSqlFile(seedsFile);
  console.log('\n✅ Todos los scripts SQL fueron analizados y validados correctamente.');
} catch (error) {
  console.error('\n❌ Error de validación:', error.message);
  process.exit(1);
}
