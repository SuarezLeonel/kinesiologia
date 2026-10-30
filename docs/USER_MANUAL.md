# Manual de Usuario Integral — KinesioGestión

**Sistema Móvil y Web de Gestión para Consultorios de Kinesiología y Fisioterapia**  
Versión: 2.0 (Producción)

---

## Índice General
1. [Introducción y Arquitectura de Acceso](#1-introducción-y-arquitectura-de-acceso)
2. [Acceso al Sistema y Seguridad](#2-acceso-al-sistema-y-seguridad)
   - [Inicio de Sesión Tradicional](#inicio-de-sesión-tradicional)
   - [Inicio de Sesión Social (OAuth 2.0)](#inicio-de-sesión-social-oauth-20)
   - [Recuperación Segura de Contraseña](#recuperación-segura-de-contraseña)
   - [Ajustes y Personalización](#ajustes-y-personalización)
3. [Matriz de Roles y Permisos](#3-matriz-de-roles-y-permisos)
4. [Guía Operativa por Rol](#4-guía-operativa-por-rol)
   - [4.1 Perfil: Administrador (Admin)](#41-perfil-administrador-admin)
   - [4.2 Perfil: Kinesiólogo (Profesional Clínico)](#42-perfil-kinesiólogo-profesional-clínico)
   - [4.3 Perfil: Recepcionista (Personal Administrativo)](#43-perfil-recepcionista-personal-administrativo)
   - [4.4 Perfil: Paciente (Portal de Autogestión y Home Care)](#44-perfil-paciente-portal-de-autogestión-y-home-care)
5. [Módulos del Sistema en Detalle](#5-módulos-del-sistema-en-detalle)
   - [Dashboard Interactivo Modular](#dashboard-interactivo-modular)
   - [Gestión de Agenda y Turnos](#gestión-de-agenda-y-turnos)
   - [Padrón y Ficha de Pacientes](#padrón-y-ficha-de-pacientes)
   - [Historias Clínicas y Evaluación Kinésica](#historias-clínicas-y-evaluación-kinésica)
   - [Prescripción de Rutinas y Seguimiento de Ejercicios](#prescripción-de-rutinas-y-seguimiento-de-ejercicios)
   - [Módulo de Cobros, Paquetes de Sesiones y Caja Diaria](#módulo-de-cobros-paquetes-de-sesiones-y-caja-diaria)
   - [Exportación Médica a PDF](#exportación-médica-a-pdf)
6. [Credenciales de Demostración](#6-credenciales-de-demostración)
7. [Preguntas Frecuentes y Soporte](#7-preguntas-frecuentes-y-soporte)

---

## 1. Introducción y Arquitectura de Acceso

**KinesioGestión** es un sistema integral multiplataforma diseñado específicamente para clínicas y consultorios kinésicos. Combina agilidad administrativa con rigurosidad clínica bajo estándares médicos:

- **Seguridad y Privacidad Estricta:** Acceso basado en roles (RBAC). El personal administrativo no tiene acceso a historias clínicas ni diagnósticos confidenciales, y los profesionales de salud no acceden a los números financieros del consultorio.
- **Trazabilidad Médica Inmutable:** Toda modificación sobre un expediente clínico exige registrar el motivo del cambio y se conserva el historial con auditoría completa.
- **Continuidad Terapéutica (Home Care):** Los pacientes pueden registrar desde su celular el cumplimiento de los ejercicios terapéuticos prescriptos para el hogar, evaluando su nivel de dolor mediante la escala EVA.
- **Multiplataforma:** Totalmente operativo en dispositivos móviles (Android APK y Expo Go) y navegadores web.

---

## 2. Acceso al Sistema y Seguridad

### Inicio de Sesión Tradicional
1. Abra la aplicación en su dispositivo móvil o navegador.
2. Ingrese su **Correo Electrónico** registrado y su **Contraseña**.
3. Presione el botón **"Ingresar"**.
4. La aplicación guardará su sesión de forma encriptada en el llavero seguro del dispositivo (`Expo SecureStore`) y le dirigirá automáticamente a la pantalla correspondiente según su rol.

### Inicio de Sesión Social (OAuth 2.0)
El sistema permite el ingreso rápido mediante proveedores de identidad externos:
- **Google**
- **GitHub**
- **Facebook**

**Flujo:**
1. En la pantalla de inicio, presione el botón correspondiente al proveedor deseado.
2. Se abrirá la ventana de autenticación oficial del proveedor.
3. Si es su primera vez ingresando con esa red social y no posee cuenta previa, el sistema le solicitará completar datos básicos (nombre, apellido y teléfono) y creará de forma segura su cuenta con rol de **Paciente**.
4. **Protección Anti-Suplantación (Account Takeover):** Si ya existe una cuenta profesional creada previamente con ese mismo correo mediante contraseña, el sistema no la sobreescribe automáticamente, protegiendo las credenciales médicas y administrativas.

### Recuperación Segura de Contraseña
Si olvidó su contraseña:
1. En la pantalla de ingreso, presione **"¿Olvidó su contraseña?"**.
2. Escriba su correo electrónico registrado y presione **"Enviar código"**.
3. Recibirá en su casilla de correo un email oficial de **KinesioGestión** con un **código de verificación numérico de 6 dígitos** (válido por 15 minutos).
4. En la pantalla de la aplicación, ingrese el código de 6 dígitos junto con su **Nueva Contraseña** (mínimo 8 caracteres, con mayúsculas, minúsculas y números).
5. Presione **"Restablecer contraseña"**. La contraseña quedará actualizada mediante hash criptográfico (bcrypt) y se revocarán automáticamente sesiones antiguas en otros dispositivos por seguridad.

### Ajustes y Personalización
Desde el menú **Ajustes**:
- **Tema Visual:** Seleccione entre modo **Claro**, **Oscuro** o **Automático** (sincronizado con las preferencias del sistema operativo).
- **Cierre de Sesión:** Al presionar **"Cerrar Sesión"**, el token de autenticación se revoca en la base de datos y se limpia de forma segura el almacenamiento local.

---

## 3. Matriz de Roles y Permisos

| Módulo / Función | Administrador | Kinesiólogo | Recepcionista | Paciente |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard Administrativo / Caja** | Sí | No (Oculto) | Sí | No (Oculto) |
| **Agenda de Turnos (Gestión y Asistencia)** | Sí | Sí | Sí | Solo consulta |
| **Padrón de Pacientes (Alta y Edición)** | Sí | Sí | Sí | Solo su perfil |
| **Historias Clínicas y Diagnósticos** | Sí | Sí | No (Bloqueado) | No (Bloqueado) |
| **Exportación de PDF Médico** | Sí | Sí | No (Bloqueado) | No (Bloqueado) |
| **Catálogo de Ejercicios Kinésicos** | Sí (Edición) | Sí (Prescripción) | Solo lectura | No |
| **Prescripción de Rutinas Terapéuticas** | Sí | Sí | No (Bloqueado) | No (Bloqueado) |
| **Registro de Sesión en Consultorio** | Sí | Sí | No (Bloqueado) | No |
| **Portal Home Care (Cumplimiento de Ejercicios)** | No | No | No | Sí |
| **Cobros, Arqueo de Caja y Paquetes** | Sí | No (Bloqueado) | Sí | No |
| **Configuración de Usuarios y Roles** | Sí | No | No | No |

---

## 4. Guía Operativa por Rol

### 4.1 Perfil: Administrador (Admin)
El Administrador supervisa la gestión global de la clínica, los profesionales, las métricas financieras y la configuración.

1. **Dashboard Principal:**
   - Visualiza los turnos del día clasificados por estado (pendientes, presentes, ausentes, cancelados).
   - Accede al bloque de **Recaudación Diaria**: total facturado en la jornada, cantidad de cobros y medios de pago utilizados.
2. **Gestión de Agenda:**
   - Puede crear turnos asignando cualquiera de los kinesiólogos del equipo.
   - El sistema valida en tiempo real que no existan superposiciones horarias para el profesional ni para el paciente.
3. **Control de Usuarios y Tarifas:**
   - Alta y baja de profesionales, secretarias y catálogo de prestaciones (valor de consulta, RPG, kinesiología deportiva, etc.).
4. **Supervisión de Historias Clínicas y Auditoría:**
   - Acceso completo a consultar registros clínicos y auditoría de eventos sensibles.

---

### 4.2 Perfil: Kinesiólogo (Profesional Clínico)
Diseñado para la atención en el box/consultorio kinésico, con foco en el paciente y sin distracciones administrativas.

1. **Agenda Diaria Personalizada:**
   - Visualiza únicamente los turnos programados bajo su responsabilidad.
   - Puede cambiar el estado del turno con un toque: **"Asistió"**, **"Ausente"** o **"Cancelado"**.
2. **Historia Clínica y Ficha Médica:**
   - Creación de evaluaciones kinésicas iniciales: motivo de consulta, antecedentes médicos, evaluación postural y funcional.
   - Registro de la **Escala EVA (0-10)** para medir la intensidad del dolor percibido por el paciente.
   - Redacción de evoluciones sesión a sesión.
   - **Garantía de Inmutabilidad:** Si se edita una evolución anterior, el sistema exige escribir obligatoriamente el **motivo de la rectificación**.
3. **Prescripción de Rutinas y Sesiones Kinésicas:**
   - Acceso al catálogo de más de 90 ejercicios clasificados por articulación y objetivo terapéutico.
   - Creación de rutinas de tratamiento personalizadas (series, repeticiones, carga y descanso).
   - Versionado automático: al ajustar la rutina de un paciente, se genera la *Versión 2* archivando la anterior para comparar la progresión del tratamiento.
   - Registro de sesión clínica: anota qué ejercicios realizó el paciente en el consultorio, con qué peso y cómo toleró el esfuerzo.
4. **Exportación de Informes en PDF:**
   - Botón directo para generar la Historia Clínica en formato PDF con membrete profesional para presentar a obras sociales, médicos derivantes o al propio paciente.

---

### 4.3 Perfil: Recepcionista (Personal Administrativo)
Optimizado para el escritorio de entrada y sala de espera.

1. **Recepción y Sala de Espera:**
   - Registra la llegada de los pacientes marcando asistencia para que el kinesiólogo lo vea en su box.
   - Da de alta nuevos pacientes con validación de DNI, teléfono y cobertura de salud.
2. **Coordinación de Turnos:**
   - Asignación de turnos según los horarios disponibles de cada profesional.
   - Cancelaciones y reprogramaciones rápidas.
3. **Caja y Cobros:**
   - Registro de cobros de consultas individuales o venta de **Paquetes de Sesiones** (ej. "Pack 10 sesiones Traumatología").
   - Medios de pago: Efectivo, Tarjeta de Débito, Tarjeta de Crédito, Transferencia Bancaria u Obra Social.
   - Descuento automático de sesiones cuando el paciente asiste.
   - **Arqueo de Caja del Día:** Resumen en vivo de ingresos discriminado por método de pago.
4. **Seguridad y Confidencialidad:**
   - La recepcionista **no tiene acceso a historias clínicas, notas médicas ni diagnósticos**. La interfaz no muestra dichas pestañas y el servidor deniega cualquier consulta a esos datos.

---

### 4.4 Perfil: Paciente (Portal de Autogestión y Home Care)
El paciente accede a su portal para acompañar su proceso de rehabilitación.

1. **Mis Rutinas Asignadas:**
   - Lista clara de los ejercicios prescriptos por su kinesiólogo para realizar en casa.
   - Instrucciones claras paso a paso, series indicadas y repeticiones.
2. **Registro de Cumplimiento (Home Care):**
   - Al terminar de realizar un ejercicio en su hogar, presiona **"Marcar como completado"**.
   - Indica cuántas series completó, qué nivel de dolor sintió (escala 0 al 10) y puede dejarle una nota a su kinesiólogo (ej: *"Sentí tirantez al final de la 3era serie"*).
   - Su registro no altera la prescripción médica, pero queda reflejado en el expediente para que el profesional evalúe su adherencia y evolución en la próxima consulta.
3. **Historial de Sesiones:**
   - Consulta de fechas de sesiones realizadas y turnos próximos.

---

## 5. Módulos del Sistema en Detalle

### Dashboard Interactivo Modular
El panel principal se adapta dinámicamente al rol autenticado:
- **Tarjetas de métricas:** Turnos del día, Pacientes en tratamiento, Sesiones completadas.
- **Gráficos y estados:** Visualización rápida del flujo de pacientes de la jornada.
- **Aislamiento financiero:** Los bloques de facturación solo se renderizan para perfiles con privilegios de tesorería (Admin y Recepción).

### Gestión de Agenda y Turnos
- Verificación algorítmica de solapamientos: el sistema impide agendar dos turnos al mismo profesional o al mismo paciente en el mismo bloque horario.
- Estados de turno: `pending` (pendiente), `attended` (asistió), `absent` (ausente), `cancelled` (cancelado).

### Historias Clínicas y Evaluación Kinésica
- Motivo de consulta y diagnósticos estandarizados.
- Puntuación analógica de dolor (EVA 0 a 10) para cuantificar la mejoría entre sesiones.
- Exámenes físicos: balance articular, pruebas de movilidad, tono muscular y fuerza.
- Evolución longitudinal con sello de tiempo y firma digital del kinesiólogo tratante.

### Prescripción de Rutinas y Seguimiento de Ejercicios
- Catálogo de 90 ejercicios kinésicos con categorización:
  - Movilidad articular
  - Fortalecimiento muscular
  - Elongación y flexibilidad
  - Control motor y propiocepción
- Rutinas versionadas: historial de cambios terapéuticos sin pérdida de datos.
- Registro intra-sesión y registro extra-muros (hogar).

### Módulo de Cobros, Paquetes de Sesiones y Caja Diaria
- Emisión de recibos de pago con número único y fecha de operación.
- Gestión de paquetes de sesiones: seguimiento de sesiones totales, consumidas y saldo restante.
- Cierre diario de caja: balance inmediato entre efectivo y cobros digitales.

### Exportación Médica a PDF
- Generación de informes en PDF formal con membrete del consultorio.
- Soporte para visualización directa y descarga tanto en entorno Web como en dispositivos móviles (Android) mediante el visor integrado.

---

## 6. Credenciales de Demostración

Para probar y evaluar todas las funciones del sistema, se encuentran disponibles las siguientes cuentas de demostración:

| Rol | Correo Electrónico | Contraseña | Perfil y Acceso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@kinesiologia.com` | `Password123!` | Control global, finanzas, usuarios y clínica. |
| **Kinesiólogo** | `carlos.kine@kinesiologia.com` | `Password123!` | Box médico, agenda, historias clínicas y rutinas. |
| **Recepcionista** | `mariana.recep@kinesiologia.com` | `Password123!` | Recepción, turnos, pacientes y cobranzas. |
| **Paciente** | `esteban.perez@ejemplo.com` | `Password123!` | Portal paciente, rutinas de hogar y turnos. |

*(En la pantalla de inicio de sesión de la aplicación móvil se encuentran botones de acceso rápido para autocompletar estas credenciales en un toque)*.

---

## 7. Preguntas Frecuentes y Soporte

**¿Qué hago si no recuerdo mi contraseña?**  
Presione *"¿Olvidó su contraseña?"* en la pantalla de inicio, ingrese su correo y recibirá de inmediato un código de 6 dígitos para crear una nueva.

**¿Puedo utilizar la aplicación sin conexión a internet?**  
La aplicación requiere conexión a internet para sincronizar los datos en tiempo real con el servidor seguro y garantizar que las historias clínicas y la agenda estén siempre actualizadas.

**¿Mis datos médicos están protegidos?**  
Sí. Todas las comunicaciones viajan encriptadas mediante HTTPS/TLS, las contraseñas se almacenan con algoritmos de hashing seguro (bcrypt) y el acceso a la información médica está restringido por diseño exclusivamente a los profesionales de la salud.
