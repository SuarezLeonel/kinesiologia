import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { clinicalExercisesCatalog } from './seed-exercises.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.resolve(__dirname, '../../database');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

let sql = '-- 014_seed_clinical_exercises_catalog.sql\n';
sql += '-- Catálogo inicial de 90 ejercicios de kinesiología y rehabilitación musculoesquelética\n';
sql += '-- Contenido de referencia demostrativo que requiere revisión profesional antes de utilizarse clínicamente.\n\n';

for (const ex of clinicalExercisesCatalog) {
  sql += 'INSERT INTO exercises (\n';
  sql += '  name, category, description, instructions, default_sets, default_repetitions,\n';
  sql += '  media_url, is_active, body_zone, muscle_group, therapeutic_objective,\n';
  sql += '  equipment_needed, difficulty_level, contraindications\n';
  sql += ') SELECT\n';
  sql += '  ' + escapeSql(ex.name) + ',\n';
  sql += '  ' + escapeSql(ex.category) + ',\n';
  sql += '  ' + escapeSql(ex.description) + ',\n';
  sql += '  ' + escapeSql(ex.instructions) + ',\n';
  sql += '  ' + ex.default_sets + ',\n';
  sql += '  ' + ex.default_repetitions + ',\n';
  sql += '  NULL,\n';
  sql += '  1,\n';
  sql += '  ' + escapeSql(ex.body_zone) + ',\n';
  sql += '  ' + escapeSql(ex.muscle_group) + ',\n';
  sql += '  ' + escapeSql(ex.therapeutic_objective) + ',\n';
  sql += '  ' + escapeSql(ex.equipment_needed) + ',\n';
  sql += '  ' + escapeSql(ex.difficulty_level) + ',\n';
  sql += '  ' + escapeSql(ex.contraindications) + '\n';
  sql += 'WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = ' + escapeSql(ex.name) + ');\n\n';
}

fs.writeFileSync(path.join(dbRoot, 'migrations', '014_seed_clinical_exercises_catalog.sql'), sql, 'utf8');
fs.writeFileSync(path.join(dbRoot, 'seeds', '002_exercises_catalog.sql'), sql, 'utf8');
console.log('SQL files generated successfully with', clinicalExercisesCatalog.length, 'exercises.');

