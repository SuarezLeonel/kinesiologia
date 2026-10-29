import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { patientsRouter } from './modules/patients/routes.js';
import { appointmentsRouter } from './modules/appointments/routes.js';
import { clinicalRecordsRouter } from './modules/clinical-records/routes.js';
import { treatmentsRouter } from './modules/treatments/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { exercisesRouter } from './modules/exercises/routes.js';
import { paymentsRouter } from './modules/payments/routes.js';
import { servicesRouter } from './modules/services/routes.js';
import { patientPortalRouter } from './modules/patient-portal/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Configuración de proxy para despliegues detrás de reverse proxies (Vercel, Render, AWS, Nginx)
app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);

// Seguridad base con Helmet
app.use(helmet());

// CORS restringido
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente en 15 minutos'
    }
  }
});
app.use(limiter);

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware global para bloquear cualquier petición GET a endpoints de negocio
app.use(`${config.apiPrefix}`, (req, res, next) => {
  if (req.method === 'GET') {
    // Permitir exclusivamente el callback de redirección externa para navegadores de OAuth (Google, GitHub, Facebook)
    if (req.path === '/auth/oauth/callback') {
      return next();
    }
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Las consultas de negocio se realizan únicamente mediante solicitudes POST con identificadores y filtros en el cuerpo'
      }
    });
  }
  next();
});

// Documentación técnica Swagger UI (única excepción de visualización de docs)
try {
  const swaggerDocument = yaml.load(path.join(__dirname, 'docs/openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.warn('Documento Swagger no cargado:', e.message);
}

// ==========================================
// Módulos de Negocio (Prefijo /api/v1)
// Cero uso de GET en endpoints de negocio
// ==========================================
app.use(`${config.apiPrefix}/auth`, authRouter);
app.use(`${config.apiPrefix}/users`, usersRouter);
app.use(`${config.apiPrefix}/patients`, patientsRouter);
app.use(`${config.apiPrefix}/appointments`, appointmentsRouter);
app.use(`${config.apiPrefix}/clinical-records`, clinicalRecordsRouter);
app.use(`${config.apiPrefix}/treatments`, treatmentsRouter);
app.use(`${config.apiPrefix}/dashboard`, dashboardRouter);
app.use(`${config.apiPrefix}/exercises`, exercisesRouter);
app.use(`${config.apiPrefix}/payments`, paymentsRouter);
app.use(`${config.apiPrefix}/services`, servicesRouter);
app.use(`${config.apiPrefix}/patient-portal`, patientPortalRouter);

// Manejo centralizado de 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `La ruta ${req.method} ${req.originalUrl} no existe`
    }
  });
});

// Manejo centralizado de Errores
app.use(errorHandler);
