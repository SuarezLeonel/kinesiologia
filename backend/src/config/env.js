/**
 * @file env.js
 * @description Configuración centralizada y validación de variables de entorno para el backend.
 * Garantiza que claves criptográficas JWT, conexión a base de datos y servicios de correo
 * cumplan con los requerimientos mínimos de longitud y seguridad antes de iniciar la API.
 */

import dotenv from 'dotenv';
dotenv.config();

/**
 * Valida que una variable de entorno secreta esté definida y posea al menos 32 caracteres.
 * @param {string} name - Nombre de la variable de entorno.
 * @returns {string} Valor de la variable validada.
 * @throws {Error} Si la variable no existe o tiene menos de 32 caracteres.
 */
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

import crypto from 'crypto';

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
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    resetSecret: (process.env.JWT_RESET_SECRET && process.env.JWT_RESET_SECRET.length >= 32)
      ? process.env.JWT_RESET_SECRET
      : crypto.createHash('sha256').update((process.env.JWT_ACCESS_SECRET || '') + ':reset:dedicated').digest('hex'),
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN || '15m'
  },
  email: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || '"KinesioGestión" <no-reply@kinesiologia.com>',
    appUrl: process.env.APP_URL || 'http://localhost:8081',
    resendApiKey: process.env.RESEND_API_KEY || null,
    resendFrom: process.env.RESEND_FROM || null,
    brevoApiKey: process.env.BREVO_API_KEY || null
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || null
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || null,
      clientSecret: process.env.GITHUB_CLIENT_SECRET || null
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID || null,
      appSecret: process.env.FACEBOOK_APP_SECRET || null
    }
  }
};
