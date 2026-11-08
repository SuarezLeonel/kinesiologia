import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config/env.js';
import { getPool } from '../src/config/database.js';
import {
  holidayService,
  extractDateISO,
  addCalendarDays,
  getDayOfWeek
} from '../src/services/holidayService.js';

function makeToken(payload) {
  return jwt.sign({ type: 'access', ...payload }, config.jwt.accessSecret, {
    expiresIn: '15m'
  });
}

const adminToken = makeToken({ userId: 1, role: 'admin', email: 'admin@kinesiologia.com' });
const receptionistToken = makeToken({ userId: 3, role: 'receptionist', email: 'mariana.recep@kinesiologia.com' });

const todayStr = extractDateISO(new Date());
const maxAllowedDateStr = addCalendarDays(todayStr, 14);
const exceedsWindowDateStr = addCalendarDays(todayStr, 15);
const pastDateStr = addCalendarDays(todayStr, -1);

// Buscar dentro de la ventana [hoy + 1, hoy + 14] fechas concretas para cada escenario
const windowDates = [];
for (let i = 1; i <= 14; i++) {
  windowDates.push(addCalendarDays(todayStr, i));
}

const saturdayInWindow = windowDates.find((d) => getDayOfWeek(d) === 6);
const sundayInWindow = windowDates.find((d) => getDayOfWeek(d) === 0);
const weekdaysInWindow = windowDates.filter((d) => {
  const dow = getDayOfWeek(d);
  return dow >= 1 && dow <= 5;
});

// Elegimos días de semana distintos dentro de la ventana de 14 días para probar cada caso en endpoints reales
let normalWeekday = weekdaysInWindow[0];
let testProvincialHolidayDate = weekdaysInWindow[weekdaysInWindow.length - 1];
let testOptionalDayDate = weekdaysInWindow[1];
let validPatientId = 1;

const createdAppointmentIds = [];
const temporaryHolidayDates = [];

async function ensureTestFixtures() {
  const pool = getPool();
  const [patients] = await pool.execute('SELECT id FROM patients ORDER BY id ASC LIMIT 1');
  if (patients.length > 0) {
    validPatientId = patients[0].id;
  }
  const [holidaysInWindow] = await pool.execute(
    'SELECT DATE_FORMAT(holiday_date, "%Y-%m-%d") as d FROM clinic_holidays WHERE holiday_date BETWEEN ? AND ?',
    [todayStr, maxAllowedDateStr]
  );
  const holidaySet = new Set(holidaysInWindow.map((r) => r.d));
  const cleanWeekdays = weekdaysInWindow.filter((d) => !holidaySet.has(d));
  if (cleanWeekdays.length >= 3) {
    normalWeekday = cleanWeekdays[0];
    testOptionalDayDate = cleanWeekdays[1];
    testProvincialHolidayDate = cleanWeekdays[2];
  }
}

test.after(async () => {
  const pool = getPool();
  for (const apptId of createdAppointmentIds) {
    await pool.execute('DELETE FROM appointment_reschedule_requests WHERE appointment_id = ?', [apptId]);
    await pool.execute('DELETE FROM appointments WHERE id = ?', [apptId]);
  }
  for (const hDate of temporaryHolidayDates) {
    await pool.execute('DELETE FROM clinic_holidays WHERE holiday_date = ? AND source = "test_suite"', [hDate]);
  }
  holidayService.invalidateCache();
  await pool.end();
});

test('1. Integración con ArgentinaDatos API y almacenamiento en caché de feriados nacionales', async () => {
  const currentYear = Number(todayStr.slice(0, 4));
  const holidays = await holidayService.listHolidays({ year: currentYear });

  assert.ok(Array.isArray(holidays));
  assert.ok(holidays.length >= 10, 'Debe contener los feriados nacionales y jurisdiccionales del año');

  // Verificar que existen feriados nacionales inamovibles (ej. 25 de mayo / 9 de julio / 25 de diciembre)
  const hasMayo = holidays.some((h) => h.date === `${currentYear}-05-25` && h.scope === 'national');
  const hasJulio = holidays.some((h) => h.date === `${currentYear}-07-09` && h.scope === 'national');
  assert.ok(hasMayo && hasJulio, 'Debe incluir feriados nacionales oficiales de Argentina');

  // Verificar endpoint POST /api/v1/appointments/holidays/search
  const res = await request(app)
    .post('/api/v1/appointments/holidays/search')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ year: currentYear });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 10);
});

test('2. Día hábil normal dentro de los 14 días: ofrece horarios y permite reservar y reprogramar', async () => {
  await ensureTestFixtures();
  const pool = getPool();
  const targetNormalDay = normalWeekday;

  // Limpiar cualquier turno existente de pruebas para el kinesiólogo 2 en esa fecha
  await pool.execute(
    'DELETE FROM appointments WHERE kinesiologist_id = 2 AND start_time LIKE ?',
    [`${targetNormalDay}%`]
  );

  // 2.a Consultar horarios disponibles
  const slotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: targetNormalDay
    });

  assert.strictEqual(slotsRes.status, 200);
  assert.strictEqual(slotsRes.body.success, true);
  assert.ok(Array.isArray(slotsRes.body.data));
  assert.ok(slotsRes.body.data.length > 0, 'Un día hábil normal debe ofrecer horarios disponibles');

  const chosenSlot = slotsRes.body.data[0];

  // 2.b Crear turno en día hábil normal
  const createRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: validPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: chosenSlot.startTime,
      endTime: chosenSlot.endTime || `${targetNormalDay} 09:00:00`,
      notes: 'Prueba día hábil normal'
    });

  assert.strictEqual(createRes.status, 201, 'Debe permitir crear turno en día hábil normal');
  assert.strictEqual(createRes.body.success, true);
  createdAppointmentIds.push(createRes.body.data.id);
});

test('3. Sábado: deshabilitado, sin horarios disponibles y rechazado en backend al crear o modificar', async () => {
  assert.ok(saturdayInWindow, 'Siempre existe al menos un sábado en una ventana de 14 días');

  // 3.a available-slots no ofrece horarios en sábado
  const slotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: saturdayInWindow
    });

  assert.strictEqual(slotsRes.status, 200);
  assert.deepStrictEqual(slotsRes.body.data, [], 'No debe ofrecer horarios un sábado');

  // 3.b Intentar crear turno un sábado por API debe ser rechazado con 400
  const createRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: 1,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${saturdayInWindow} 10:00:00`,
      endTime: `${saturdayInWindow} 10:45:00`
    });

  assert.strictEqual(createRes.status, 400, 'Debe rechazar reserva en sábado con HTTP 400');
  assert.strictEqual(createRes.body.error.details.reasonCode, 'WEEKEND_SATURDAY');

  // 3.c Intentar reprogramar un turno existente a un sábado debe ser rechazado con 400
  if (createdAppointmentIds.length > 0) {
    const patchRes = await request(app)
      .patch(`/api/v1/appointments/${createdAppointmentIds[0]}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        startTime: `${saturdayInWindow} 11:00:00`,
        endTime: `${saturdayInWindow} 11:45:00`
      });

    assert.strictEqual(patchRes.status, 400, 'Debe rechazar reprogramación a sábado con HTTP 400');
    assert.strictEqual(patchRes.body.error.details.reasonCode, 'WEEKEND_SATURDAY');
  }
});

test('4. Domingo: deshabilitado, sin horarios disponibles y rechazado en backend', async () => {
  assert.ok(sundayInWindow, 'Siempre existe al menos un domingo en una ventana de 14 días');

  // 4.a available-slots devuelve []
  const slotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: sundayInWindow
    });

  assert.strictEqual(slotsRes.status, 200);
  assert.deepStrictEqual(slotsRes.body.data, [], 'No debe ofrecer horarios un domingo');

  // 4.b Crear turno en domingo rechazado con 400 WEEKEND_SUNDAY
  const createRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: 1,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${sundayInWindow} 10:00:00`,
      endTime: `${sundayInWindow} 10:45:00`
    });

  assert.strictEqual(createRes.status, 400, 'Debe rechazar reserva en domingo con HTTP 400');
  assert.strictEqual(createRes.body.error.details.reasonCode, 'WEEKEND_SUNDAY');
});

test('5. Feriado nacional: evaluación de cierre obligatorio, sin horarios y rechazo en backend', async () => {
  const currentYear = Number(todayStr.slice(0, 4));
  // Evaluamos el 25 de Mayo con fecha de referencia 20 de Mayo para que esté dentro de los 14 días
  const evalMayo = await holidayService.evaluateDate(`${currentYear}-05-25`, {
    referenceDate: new Date(currentYear, 4, 20, 12, 0, 0)
  });

  assert.strictEqual(evalMayo.available, false);
  assert.strictEqual(evalMayo.reasonCode, 'NATIONAL_HOLIDAY');
  assert.ok(evalMayo.reason.includes('Revolución de Mayo'));

  // Además, verificamos que un feriado nacional oficial NO puede ser abierto como opcional
  await assert.rejects(
    async () => {
      await holidayService.updateOptionalDayStatus({
        date: `${currentYear}-05-25`,
        isClosed: false
      });
    },
    (err) => err.statusCode === 400 && err.message.includes('cierre obligatorio')
  );
});

test('6. Feriado provincial o municipal aplicable dentro de la ventana: sin horarios y rechazado en backend', async () => {
  const pool = getPool();
  // Insertamos un feriado provincial de prueba en testProvincialHolidayDate si no es ya un feriado oficial
  const [prevRows] = await pool.execute(
    'SELECT * FROM clinic_holidays WHERE holiday_date = ?',
    [testProvincialHolidayDate]
  );

  if (prevRows.length === 0) {
    temporaryHolidayDates.push(testProvincialHolidayDate);
    await pool.execute(
      `INSERT INTO clinic_holidays
       (holiday_date, year, name, holiday_type, scope, jurisdiction, is_optional, is_closed, source)
       VALUES (?, ?, 'Feriado Provincial Patronal de Prueba', 'provincial', 'provincial', 'PBA', 0, 1, 'test_suite')`,
      [testProvincialHolidayDate, Number(testProvincialHolidayDate.slice(0, 4))]
    );
    holidayService.invalidateCache();
  }

  // 6.a available-slots debe devolver []
  const slotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: testProvincialHolidayDate
    });

  assert.strictEqual(slotsRes.status, 200);
  assert.deepStrictEqual(slotsRes.body.data, [], 'No debe ofrecer horarios en un feriado provincial/municipal');

  // 6.b Crear turno en esa fecha debe ser rechazado con 400
  const createRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: 1,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${testProvincialHolidayDate} 10:00:00`,
      endTime: `${testProvincialHolidayDate} 10:45:00`
    });

  assert.strictEqual(createRes.status, 400, 'Debe rechazar turno en feriado provincial/municipal');
  assert.ok(
    ['PROVINCIAL_HOLIDAY', 'MUNICIPAL_HOLIDAY', 'NATIONAL_HOLIDAY'].includes(
      createRes.body.error.details?.reasonCode
    ),
    `Código esperado de feriado, recibido: ${createRes.body.error.details?.reasonCode}`
  );
});

test('7. Día no laborable opcional configurado como cerrado vs. configurado como laborable', async () => {
  await ensureTestFixtures();
  const pool = getPool();
  const [prevRows] = await pool.execute(
    'SELECT * FROM clinic_holidays WHERE holiday_date = ?',
    [testOptionalDayDate]
  );

  // Si ya había un registro en esa fecha lo respaldamos, si no creamos uno de prueba
  if (prevRows.length === 0) {
    temporaryHolidayDates.push(testOptionalDayDate);
  }

  // 7.a Configurar el día no laborable opcional como CERRADO (isClosed: true) desde el endpoint
  const configClosedRes = await request(app)
    .post('/api/v1/appointments/holidays/configure')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      date: testOptionalDayDate,
      name: 'Día No Laborable Opcional de Prueba',
      scope: 'national',
      isOptional: true,
      isClosed: true
    });

  assert.strictEqual(configClosedRes.status, 201);
  assert.strictEqual(configClosedRes.body.data.isOptional, true);
  assert.strictEqual(configClosedRes.body.data.isClosed, true);

  // Cuando está configurado como CERRADO: no ofrece horarios y rechaza reservas con OPTIONAL_NON_WORKING_CLOSED
  const closedSlotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: testOptionalDayDate
    });
  assert.deepStrictEqual(closedSlotsRes.body.data, [], 'Día opcional cerrado no debe ofrecer horarios');

  const closedBookRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: validPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${testOptionalDayDate} 12:00:00`,
      endTime: `${testOptionalDayDate} 12:45:00`
    });
  assert.strictEqual(closedBookRes.status, 400);
  assert.strictEqual(closedBookRes.body.error.details.reasonCode, 'OPTIONAL_NON_WORKING_CLOSED');

  // 7.b Cambiar el día no laborable opcional a LABORABLE (isClosed: false) mediante toggle-optional
  const toggleOpenRes = await request(app)
    .post('/api/v1/appointments/holidays/toggle-optional')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      date: testOptionalDayDate,
      isClosed: false
    });

  assert.strictEqual(toggleOpenRes.status, 200);
  assert.strictEqual(toggleOpenRes.body.data.isClosed, false);

  // Cuando está configurado como LABORABLE: ofrece horarios y permite reservar turno
  await pool.execute(
    'DELETE FROM appointments WHERE kinesiologist_id = 2 AND start_time LIKE ?',
    [`${testOptionalDayDate}%`]
  );

  const openSlotsRes = await request(app)
    .post('/api/v1/appointments/available-slots')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      kinesiologistId: 2,
      serviceId: 1,
      date: testOptionalDayDate
    });
  assert.strictEqual(openSlotsRes.status, 200);
  assert.ok(openSlotsRes.body.data.length > 0, 'Día no laborable opcional abierto debe ofrecer horarios');

  const openSlot = openSlotsRes.body.data[0];

  const openBookRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: validPatientId,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: openSlot.startTime,
      endTime: openSlot.endTime || `${testOptionalDayDate} 09:00:00`,
      notes: 'Reserva en día no laborable opcional habilitado'
    });
  assert.strictEqual(openBookRes.status, 201, 'Debe permitir reservar en día opcional configurado como laborable');
  createdAppointmentIds.push(openBookRes.body.data.id);

  // Restaurar si existía previamente o eliminar si fue temporal
  if (prevRows.length > 0) {
    const prev = prevRows[0];
    await pool.execute(
      `UPDATE clinic_holidays
       SET name = ?, holiday_type = ?, scope = ?, is_optional = ?, is_closed = ?, source = ?
       WHERE holiday_date = ?`,
      [prev.name, prev.holiday_type, prev.scope, prev.is_optional, prev.is_closed, prev.source, testOptionalDayDate]
    );
  } else {
    await pool.execute('DELETE FROM clinic_holidays WHERE holiday_date = ?', [testOptionalDayDate]);
  }
  holidayService.invalidateCache();
});

test('8. Fechas fuera del rango permitido (pasadas o que superan los 14 días calendario): rechazadas en backend', async () => {
  // 8.a Fecha que supera los 14 días corridos (hoy + 15 días)
  const overMaxRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: 1,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${exceedsWindowDateStr} 10:00:00`,
      endTime: `${exceedsWindowDateStr} 10:45:00`
    });

  assert.strictEqual(overMaxRes.status, 400, 'Debe rechazar fechas mayores a hoy + 14 días calendario');
  assert.strictEqual(overMaxRes.body.error.details.reasonCode, 'EXCEEDS_MAX_WINDOW');

  // 8.b Fecha pasada (ayer)
  const pastRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({
      patientId: 1,
      kinesiologistId: 2,
      serviceId: 1,
      startTime: `${pastDateStr} 10:00:00`,
      endTime: `${pastDateStr} 10:45:00`
    });

  assert.strictEqual(pastRes.status, 400, 'Debe rechazar fechas pasadas');
  assert.strictEqual(pastRes.body.error.details.reasonCode, 'PAST_DATE');

  // 8.c Verificar que el calendario devuelve exactamente minDate = hoy y maxDate = hoy + 14 días corridos (sin extender por feriados/fines de semana)
  const calRes = await request(app)
    .post('/api/v1/appointments/calendar-availability')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({});

  assert.strictEqual(calRes.status, 200);
  assert.strictEqual(calRes.body.data.minDate, todayStr);
  assert.strictEqual(calRes.body.data.maxDate, maxAllowedDateStr);
  assert.strictEqual(calRes.body.data.maxDays, 14);
});

test('9. Cambio de año (Diciembre -> Enero) y resiliencia ante caída de API (caché vs fail-closed)', async () => {
  // 9.a Ventana de 14 días que cruza de 2026-12-24 a 2027-01-07
  const dec24Ref = new Date(2026, 11, 24, 12, 0, 0);
  const crossYearCal = await holidayService.getCalendarAvailability({
    fromDate: '2026-12-24',
    toDate: '2027-01-07',
    referenceDate: dec24Ref
  });

  assert.deepStrictEqual(crossYearCal.yearsChecked, [2026, 2027], 'Debe consultar y validar ambos años (2026 y 2027)');
  assert.strictEqual(crossYearCal.minDate, '2026-12-24');
  assert.strictEqual(crossYearCal.maxDate, '2027-01-07');

  const byDate = Object.fromEntries(crossYearCal.days.map((d) => [d.date, d]));

  // 2026-12-25 (Navidad) -> cerrado por feriado nacional
  assert.strictEqual(byDate['2026-12-25'].available, false);
  assert.strictEqual(byDate['2026-12-25'].reasonCode, 'NATIONAL_HOLIDAY');

  // 2026-12-26 (Sábado) y 2026-12-27 (Domingo) -> cerrados por fin de semana
  assert.strictEqual(byDate['2026-12-26'].available, false);
  assert.strictEqual(byDate['2026-12-26'].reasonCode, 'WEEKEND_SATURDAY');
  assert.strictEqual(byDate['2026-12-27'].available, false);
  assert.strictEqual(byDate['2026-12-27'].reasonCode, 'WEEKEND_SUNDAY');

  // 2027-01-01 (Año Nuevo) -> cerrado por feriado nacional del nuevo año
  assert.strictEqual(byDate['2027-01-01'].available, false);
  assert.strictEqual(byDate['2027-01-01'].reasonCode, 'NATIONAL_HOLIDAY');

  // 2027-01-04 (Lunes hábil en el nuevo año) -> habilitado
  assert.strictEqual(byDate['2027-01-04'].available, true);
  assert.strictEqual(byDate['2027-01-04'].reasonCode, 'WORKING_DAY');

  // 9.b Si la API no está disponible y NO existen datos almacenados para un año futuro (ej. 2099),
  // el sistema evita habilitar fechas cuya condición de feriado no pudo verificarse (UNVERIFIED_HOLIDAYS)
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw new Error('Simulated network outage');
    };
    holidayService.invalidateCache();

    // Año 2026 tiene datos almacenados en MySQL -> sigue funcionando con el almacenamiento local
    const cachedYearEval = await holidayService.evaluateDate('2026-12-28', {
      referenceDate: dec24Ref
    });
    assert.strictEqual(cachedYearEval.available, true, 'Con datos previamente almacenados debe funcionar aunque la API caiga');

    // Año 2099 NO tiene datos almacenados y la API está caída -> debe bloquear preventivamente la fecha
    const unverifiedRef = new Date(2099, 5, 1, 12, 0, 0);
    const unverifiedEval = await holidayService.evaluateDate('2099-06-02', {
      referenceDate: unverifiedRef
    });
    assert.strictEqual(
      unverifiedEval.available,
      false,
      'No debe habilitar fechas cuya condición de feriado no pudo verificarse'
    );
    assert.strictEqual(unverifiedEval.reasonCode, 'UNVERIFIED_HOLIDAYS');
  } finally {
    global.fetch = originalFetch;
    holidayService.invalidateCache();
  }
});
