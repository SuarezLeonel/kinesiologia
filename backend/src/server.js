import { app } from './app.js';
import { config } from './config/env.js';
import { getPool } from './config/database.js';

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err);
});

async function startServer() {
  try {
    // Probar conexión a MySQL
    try {
      const pool = getPool();
      const connection = await pool.getConnection();
      connection.release();
      console.log('✅ Conexión a la base de datos MySQL establecida correctamente.');
    } catch (dbErr) {
      console.warn('⚠️ Alerta: No se pudo conectar a MySQL inmediatamente:', dbErr.message);
      console.warn('El servidor Express iniciará pero las consultas a la base de datos fallarán hasta que MySQL esté activo.');
    }

    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Servidor ejecutándose en http://0.0.0.0:${config.port}`);
      console.log(`📚 Documentación Swagger disponible en http://localhost:${config.port}/api/docs`);
      console.log(`🔒 Regla HTTP activa: Endpoints de negocio no permiten GET.`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();
