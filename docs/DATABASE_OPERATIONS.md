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

## 3. Ejecutar Migraciones (Crear Tablas e Índices)

Aplica el esquema completo en 3FN con sus 21 tablas, claves foráneas e índices:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p kinesiologia_db < database/migrations/001_initial_schema.sql
```

---

## 4. Sembrar Datos Ficticios (Seeds)

Carga los roles del sistema, permisos granulares, usuarios con hash seguro y datos de prueba:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p kinesiologia_db < database/seeds/001_demo_data.sql
```

---

## 5. Procedimiento Seguro para el Administrador Inicial

Para generar una clave inicial segura de administrador sin dejar contraseñas codificadas en texto plano en el repositorio:

```powershell
node database/scripts/create_initial_admin.js
```
El script generará una contraseña aleatoria con alta entropía y las indicaciones para el backend.

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
