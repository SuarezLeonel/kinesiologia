import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { connectAdmin, databaseRoot } from './lib/db.js';

const demoUsers = [
  { roleName: 'admin', name: 'Laura', lastName: 'Admin', email: 'admin@kinesiologia.com', phone: '+5491100010001' },
  { roleName: 'kinesiologist', name: 'Carlos', lastName: 'Kinesio', email: 'carlos.kine@kinesiologia.com', phone: '+5491100020002' },
  { roleName: 'receptionist', name: 'Mariana', lastName: 'Recep', email: 'mariana.recep@kinesiologia.com', phone: '+5491100030003' }
];

async function run() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Los seeds de demostración no se ejecutan con NODE_ENV=production');
  }
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Definir DEMO_USER_PASSWORD (mínimo 8 caracteres) en el entorno para crear usuarios demo');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const connection = await connectAdmin();
  try {
    const [roles] = await connection.query('SELECT id, name FROM roles');
    const roleIds = new Map(roles.map((r) => [r.name, r.id]));
    if (roleIds.size < 3) {
      throw new Error('Faltan roles. Ejecutar primero: npm run migrate');
    }

    // Usuarios demo: no se pisa la contraseña de usuarios que ya existen.
    for (const u of demoUsers) {
      await connection.query(
        `INSERT INTO users (role_id, name, last_name, email, password_hash, phone, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [roleIds.get(u.roleName), u.name, u.lastName, u.email, passwordHash, u.phone]
      );
    }

    const sql = fs.readFileSync(path.join(databaseRoot, 'seeds', '001_demo_data.sql'), 'utf8');
    await connection.query(sql);

    const exercisesSqlPath = path.join(databaseRoot, 'seeds', '002_exercises_catalog.sql');
    if (fs.existsSync(exercisesSqlPath)) {
      const exercisesSql = fs.readFileSync(exercisesSqlPath, 'utf8');
      await connection.query(exercisesSql);
      console.log('Catálogo clínico inicial de 90 ejercicios de kinesiología sembrado con éxito.');
    }

    console.log('Seeds de demostración aplicados (usuarios demo, servicios, pacientes, ejercicios).');

  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Error en seed:', error.message);
  process.exit(1);
});
