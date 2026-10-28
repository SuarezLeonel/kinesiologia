import dotenv from 'dotenv';
dotenv.config();

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`Variable de entorno ${name} obligatoria (mínimo 32 caracteres). Ver backend/.env.example.`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production' && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
  throw new Error('En producción CORS_ORIGIN debe definirse con los orígenes permitidos (no se admite "*").');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kinesiologia_db',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
  },
  jwt: {
    accessSecret: requireSecret('JWT_ACCESS_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
};
