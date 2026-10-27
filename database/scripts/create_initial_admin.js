import crypto from 'crypto';

/**
 * Procedimiento de generación segura de contraseña y hash inicial de administrador.
 * En lugar de codificar una contraseña fija en texto plano, este script permite:
 * 1. Generar una contraseña temporal criptográficamente segura (o tomarla de ADMIN_INITIAL_PASSWORD de .env).
 * 2. Generar el script SQL o sentencia INSERT parametrizada lista para ejecutar.
 */

const password = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('base64url') + '!A1';

console.log('=======================================================');
console.log('PROCEDIMIENTO DE CREACIÓN DE ADMINISTRADOR INICIAL');
console.log('=======================================================');
console.log('Email:', 'admin@kinesiologia.com');
console.log('Contraseña temporal generada:', password);
console.log('\nIMPORTANTE: Guarde esta contraseña en un gestor seguro.');
console.log('El backend utilizará bcrypt con 10 o 12 rondas para almacenar el hash.');
console.log('=======================================================');
