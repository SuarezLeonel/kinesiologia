import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectAdmin } from './lib/db.js';

const schema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12, 'La contraseña del admin debe tener al menos 12 caracteres'),
  ADMIN_NAME: z.string().min(1).default('Administrador'),
  ADMIN_LAST_NAME: z.string().min(1).default('Principal')
});

async function run() {
  const env = schema.parse(process.env);
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  const connection = await connectAdmin();
  try {
    const [roles] = await connection.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (!roles.length) {
      throw new Error('Falta el rol admin. Ejecutar primero: npm run migrate');
    }
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [env.ADMIN_EMAIL]);
    if (existing.length) {
      throw new Error('Ya existe un usuario con ese correo; no se modificó nada');
    }
    await connection.query(
      `INSERT INTO users (role_id, name, last_name, email, password_hash, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [roles[0].id, env.ADMIN_NAME, env.ADMIN_LAST_NAME, env.ADMIN_EMAIL, passwordHash]
    );
    console.log(`Administrador creado: ${env.ADMIN_EMAIL}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Error al crear administrador:', error.message);
  process.exit(1);
});
