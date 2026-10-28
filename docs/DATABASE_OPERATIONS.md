# Guía de Operaciones de Base de Datos MySQL

Este documento detalla las instrucciones completas para crear, migrar, sembrar y respaldar la base de datos MySQL del sistema de kinesiología.

---

## 1. Requisitos Previos

- MySQL Server 8.0 o superior (instalado localmente o accesible vía red).
- En Windows con instalación estándar, las utilidades de MySQL suelen ubicarse en:
  `C:\Program Files\MySQL\MySQL Server 8.0\bin`

Si el comando `mysql` o `mysqldump` no está en tu `PATH`, puedes invocarlo con la ruta completa o agregarlo a tus variables de entorno.

---

## 2. Crear la Base de Datos

Ejecutar en PowerShell o CMD (solicitará la contraseña de root de MySQL):

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "CREATE DATABASE IF NOT EXISTS kinesiologia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## 3. Ejecutar Migraciones Versionadas
 
El sistema cuenta con un runner de migraciones versionadas que registra cada archivo SQL aplicado en la tabla `schema_migrations` con su checksum SHA-256:

```powershell
cd backend
npm run migrate
```

Aplica en orden:
- `001_initial_schema.sql`: 21 tablas normalizadas (1FN, 2FN, 3FN), 38 FKs e índices.
- `002_reference_data.sql`: Datos de referencia indispensables (roles `admin`, `kinesiologist`, `receptionist`, permisos y su mapeo).
- `003_constraints.sql`: Unicidad de turnos, recibos, sesiones e índices compuestos.
- `004_check_constraints.sql`: Restricciones CHECK de negocio (rangos de dolor 0–10, importes > 0, sesiones, etc.).

---

## 4. Sembrar Datos Ficticios (Seeds)

Para entornos de desarrollo y pruebas, carga usuarios de demostración con hashes bcrypt reales (`$env:DEMO_USER_PASSWORD`), servicios, pacientes y ejercicios:

```powershell
cd backend
$env:DEMO_USER_PASSWORD="Password123!"
npm run seed
```

> [!NOTE]
> Este script se niega a ejecutarse en entornos con `NODE_ENV=production` para evitar inyectar credenciales o pacientes ficticios en bases de datos productivas.

---

## 5. Procedimiento Seguro para el Administrador Inicial

Para dar de alta el primer usuario administrador con validación de entradas por Zod y cifrado seguro bcrypt (12 rondas):

```powershell
cd backend
$env:ADMIN_EMAIL="admin@kinesiologia.com"
$env:ADMIN_PASSWORD="TuPasswordSeguroDe12CaracteresMinimo!"
$env:ADMIN_NAME="Laura"
$env:ADMIN_LAST_NAME="Admin"
npm run create-admin
```

---

## 6. Respaldo (Backup) y Restauración

### Exportar copia de seguridad completa:
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p --single-transaction --routines --triggers kinesiologia_db > backup_kinesiologia_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

### Restaurar copia de seguridad:
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p kinesiologia_db < backup_kinesiologia_YYYYMMDD_HHMMSS.sql
```

---

## 7. Verificación Offline de Scripts SQL

Para auditar y validar la sintaxis de las migraciones sin necesidad de conexión activa a MySQL:

```powershell
node database/scripts/validate_sql.js
```
