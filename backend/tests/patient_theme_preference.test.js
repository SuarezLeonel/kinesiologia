import test from 'node:test';
import assert from 'node:assert/strict';

// Lógica pura de generación de claves y persistencia aislada de temas
const GLOBAL_THEME_KEY = 'kine_theme_mode_v2';

const getUserStorageKey = (userId, email) => {
  if (userId) return `kine_theme_mode_user_${userId}`;
  if (email) return `kine_theme_mode_user_${String(email).trim().toLowerCase()}`;
  return null;
};

// Mock del almacenamiento multiplataforma (SecureStore en móvil / localStorage en web)
class MockThemeStorage {
  constructor() {
    this.store = new Map();
  }
  async getItem(key) {
    return this.store.get(key) || null;
  }
  async setItem(key, value) {
    this.store.set(key, String(value));
  }
  async clear() {
    this.store.clear();
  }
}

// Simulador de ThemeContext con soporte por usuario
class ThemeContextSimulator {
  constructor(storage) {
    this.storage = storage;
    this.mode = 'system';
    this.currentUser = null;
  }

  async setUser(user) {
    this.currentUser = user;
    const userKey = getUserStorageKey(user?.id, user?.email);
    if (userKey) {
      const saved = await this.storage.getItem(userKey);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.mode = saved;
      } else {
        // Si el usuario todavía no configuró una preferencia, se utiliza el tema automático
        this.mode = 'system';
      }
    } else {
      const general = await this.storage.getItem(GLOBAL_THEME_KEY);
      this.mode = (general === 'light' || general === 'dark' || general === 'system') ? general : 'system';
    }
  }

  async setMode(newMode) {
    this.mode = newMode;
    const userKey = getUserStorageKey(this.currentUser?.id, this.currentUser?.email);
    if (userKey) {
      await this.storage.setItem(userKey, newMode);
    }
    await this.storage.setItem(GLOBAL_THEME_KEY, newMode);
  }

  computeIsDark(systemTheme) {
    if (this.mode === 'system') {
      return systemTheme === 'dark';
    }
    return this.mode === 'dark';
  }
}

test('Theme 1. Generación de claves de almacenamiento individuales por usuario', () => {
  assert.equal(getUserStorageKey(42, 'paciente1@test.com'), 'kine_theme_mode_user_42');
  assert.equal(getUserStorageKey(99, 'paciente2@test.com'), 'kine_theme_mode_user_99');
  assert.equal(getUserStorageKey(null, 'ADMIN@CLINICA.COM'), 'kine_theme_mode_user_admin@clinica.com');
  assert.equal(getUserStorageKey(null, null), null);
});

test('Theme 2. Paciente nuevo sin preferencia previa utiliza por defecto el tema "system"', async () => {
  const storage = new MockThemeStorage();
  const themeCtx = new ThemeContextSimulator(storage);

  const newPatient = { id: 101, email: 'nuevo.paciente@example.com', role: 'paciente' };
  await themeCtx.setUser(newPatient);

  assert.equal(themeCtx.mode, 'system');
  assert.equal(themeCtx.computeIsDark('light'), false);
  assert.equal(themeCtx.computeIsDark('dark'), true);
});

test('Theme 3. Paciente A selecciona tema "dark" y la preferencia se aplica de inmediato', async () => {
  const storage = new MockThemeStorage();
  const themeCtx = new ThemeContextSimulator(storage);

  const patientA = { id: 201, email: 'paciente.a@example.com', role: 'paciente' };
  await themeCtx.setUser(patientA);

  await themeCtx.setMode('dark');
  assert.equal(themeCtx.mode, 'dark');
  assert.equal(themeCtx.computeIsDark('light'), true); // Debe ser oscuro incluso si el sistema está claro

  const savedInStorage = await storage.getItem('kine_theme_mode_user_201');
  assert.equal(savedInStorage, 'dark');
});

test('Theme 4. Aislamiento total: Dos pacientes pueden utilizar temas diferentes en el mismo dispositivo', async () => {
  const storage = new MockThemeStorage();
  const themeCtx = new ThemeContextSimulator(storage);

  const patientA = { id: 301, email: 'ana@example.com', role: 'paciente' };
  const patientB = { id: 302, email: 'bernardo@example.com', role: 'paciente' };

  // Paciente A inicia sesión y elige 'dark'
  await themeCtx.setUser(patientA);
  await themeCtx.setMode('dark');
  assert.equal(themeCtx.mode, 'dark');

  // Paciente A cierra sesión
  await themeCtx.setUser(null);

  // Paciente B inicia sesión y elige 'light'
  await themeCtx.setUser(patientB);
  assert.equal(themeCtx.mode, 'system', 'Paciente B no debe heredar el modo oscuro de Paciente A');
  await themeCtx.setMode('light');
  assert.equal(themeCtx.mode, 'light');

  // Paciente B cierra sesión
  await themeCtx.setUser(null);

  // Paciente A vuelve a ingresar y recupera su tema 'dark'
  await themeCtx.setUser(patientA);
  assert.equal(themeCtx.mode, 'dark', 'Paciente A debe recuperar su preferencia oscura');

  // Paciente B vuelve a ingresar y recupera su tema 'light'
  await themeCtx.setUser(patientB);
  assert.equal(themeCtx.mode, 'light', 'Paciente B debe recuperar su preferencia clara');
});

test('Theme 5. El administrador conserva su funcionamiento y configuración independiente', async () => {
  const storage = new MockThemeStorage();
  const themeCtx = new ThemeContextSimulator(storage);

  const admin = { id: 1, email: 'admin@clinica.com', role: 'admin' };
  const patient = { id: 505, email: 'paciente@test.com', role: 'paciente' };

  // Admin configura tema 'light'
  await themeCtx.setUser(admin);
  await themeCtx.setMode('light');
  assert.equal(themeCtx.mode, 'light');

  // Paciente configura tema 'dark'
  await themeCtx.setUser(patient);
  await themeCtx.setMode('dark');
  assert.equal(themeCtx.mode, 'dark');

  // Admin vuelve a entrar y conserva 'light'
  await themeCtx.setUser(admin);
  assert.equal(themeCtx.mode, 'light');
});

test('Theme 6. Modo "system" responde dinámicamente al cambio de apariencia del SO', async () => {
  const storage = new MockThemeStorage();
  const themeCtx = new ThemeContextSimulator(storage);

  const patient = { id: 601, email: 'carlos@example.com', role: 'paciente' };
  await themeCtx.setUser(patient);
  await themeCtx.setMode('system');

  // Simulación de cambio de SO de claro a oscuro
  assert.equal(themeCtx.computeIsDark('light'), false);
  assert.equal(themeCtx.computeIsDark('dark'), true);
});

