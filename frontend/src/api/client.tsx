/**
 * @file client.tsx
 * @description Cliente Axios centralizado para comunicación HTTP con el backend de KinesioGestión.
 * Implementa interceptores de solicitud para inyección de token JWT (Bearer),
 * renovación preventiva y atómica con Refresh Token vía Expo SecureStore / localStorage,
 * y notificación reactiva de mutaciones para actualización instantánea sin bucles ni peticiones redundantes.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export type MutationScope =
  | 'all'
  | 'patients'
  | 'users'
  | 'appointments'
  | 'vacations'
  | 'clinicalRecords'
  | 'treatments'
  | 'exercises'
  | 'services'
  | 'payments'
  | 'dashboard'
  | 'patientPortal';

type ApiMutationListener = (scopes: MutationScope[]) => void;
const mutationListeners = new Set<ApiMutationListener>();

export const subscribeToApiMutations = (listener: ApiMutationListener): (() => void) => {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
};

export const emitApiMutation = (scopes: MutationScope[] = ['all']): void => {
  mutationListeners.forEach((listener) => {
    try {
      listener(scopes);
    } catch {}
  });
};

// Endpoints POST que son estrictamente de lectura (no mutan datos y jamás deben emitir invalidaciones)
const READ_ONLY_POST_PATTERNS = [
  '/search',
  '/detail',
  '/summary',
  '/caja-summary',
  '/available-slots',
  '/professionals',
  '/check-duplicate',
  '/filter-options',
  '/export-pdf',
  '/patient-tracking',
  '/my-appointments',
  '/my-profile',
  '/my-routines',
  '/my-exercise-logs',
  '/catalog',
  '/patient-portal/dashboard',
  '/calendar-availability',
  '/vacations/alerts',
  '/vacations/active-alerts',
  '/vacations/cancellation-notifications',
  '/vacations/affected-appointments',
  '/vacations/preview'
];

const AUTH_SESSION_PATTERNS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/oauth-config',
  '/auth/social',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification-email'
];

function detectMutationScopes(url?: string, method?: string): MutationScope[] | null {
  const m = String(method || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  if (!u || !['post', 'patch', 'put', 'delete'].includes(m)) {
    return null;
  }
  if (AUTH_SESSION_PATTERNS.some((pattern) => u.includes(pattern))) {
    return null;
  }
  if (m === 'post' && READ_ONLY_POST_PATTERNS.some((pattern) => u.includes(pattern))) {
    return null;
  }
  if (u.includes('/vacations')) {
    return ['vacations', 'appointments', 'dashboard', 'patientPortal'];
  }
  if (u.includes('/patients') || u.includes('/register-patient')) {
    return ['patients', 'appointments', 'clinicalRecords', 'payments', 'dashboard'];
  }
  if (u.includes('/users')) {
    return ['users', 'patients', 'appointments', 'vacations', 'dashboard'];
  }
  if (u.includes('/appointments') || u.includes('/book-appointment') || u.includes('/cancel-appointment')) {
    return ['appointments', 'payments', 'dashboard', 'patientPortal', 'patients'];
  }
  if (u.includes('/clinical-records')) {
    return ['clinicalRecords', 'patients', 'dashboard'];
  }
  if (u.includes('/treatments') || u.includes('/log-exercise')) {
    return ['treatments', 'clinicalRecords', 'patients', 'dashboard', 'patientPortal', 'exercises'];
  }
  if (u.includes('/exercises')) {
    return ['exercises', 'treatments', 'patientPortal'];
  }
  if (u.includes('/services')) {
    return ['services', 'appointments', 'payments', 'patients', 'patientPortal'];
  }
  if (u.includes('/payments')) {
    return ['payments', 'appointments', 'dashboard'];
  }
  if (u.includes('/patient-portal/update-profile')) {
    return ['patientPortal', 'patients'];
  }
  if (u.includes('/patient-portal/change-password')) {
    return null;
  }
  return ['all'];
}

export const ACCESS_TOKEN_KEY = 'kine_access_token';
export const REFRESH_TOKEN_KEY = 'kine_refresh_token';
export const USER_STORAGE_KEY = 'kine_current_user';

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export const subscribeToSessionExpired = (listener: SessionExpiredListener): (() => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const emitSessionExpired = (): void => {
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
};

export const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async deleteItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
};

export function isTokenExpired(token: string | null, bufferMs = 30_000): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let decoded = '';
    if (typeof atob === 'function') {
      decoded = atob(base64);
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      const str = base64.replace(/=+$/, '');
      let bs = 0;
      let bc = 0;
      for (let idx = 0; idx < str.length; idx++) {
        const buffer = chars.indexOf(str.charAt(idx));
        if (buffer === -1) continue;
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) {
          decoded += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
      }
    }
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - bufferMs;
  } catch {
    return true;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

const clearStoredSession = async (): Promise<void> => {
  await tokenStorage.deleteItem(ACCESS_TOKEN_KEY);
  await tokenStorage.deleteItem(REFRESH_TOKEN_KEY);
  await tokenStorage.deleteItem(USER_STORAGE_KEY);
  emitSessionExpired();
};

const setRequestAuthHeader = (headers: any, token: string) => {
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.Authorization = `Bearer ${token}`;
  delete headers['authorization'];
};

const extractRequestAuthHeader = (headers: any): string | undefined => {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') {
    return headers.get('Authorization') || headers.get('authorization');
  }
  return headers.Authorization || headers.authorization;
};

// Mecanismo centralizado y atómico para renovación de tokens
let refreshPromise: Promise<string | null> | null = null;

export async function refreshSessionTokens(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        await clearStoredSession();
        return null;
      }

      const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
      if (res.data?.success && res.data?.data?.accessToken) {
        const newAccessToken = res.data.data.accessToken;
        await tokenStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        if (res.data.data.refreshToken) {
          await tokenStorage.setItem(REFRESH_TOKEN_KEY, res.data.data.refreshToken);
        }
        return newAccessToken;
      }

      await clearStoredSession();
      return null;
    } catch (err: any) {
      const status = err?.response?.status;
      // Solo invalidar la sesión si el backend rechazó el refresh token por autenticación (401/403).
      // Ante 429, 5xx o caída transitoria de red, conservar la sesión local sin provocar cierres ni 401 en cascada.
      if (status === 401 || status === 403) {
        await clearStoredSession();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Interceptor para inyectar token Bearer y renovar preventivamente si está por expirar
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const isAuthRoute = Boolean(config.url && config.url.includes('/auth/'));
    if (isAuthRoute) {
      return config;
    }

    if (refreshPromise) {
      const freshToken = await refreshPromise;
      if (freshToken && config.headers) {
        setRequestAuthHeader(config.headers, freshToken);
        return config;
      }
    }

    let token = await tokenStorage.getItem(ACCESS_TOKEN_KEY);
    if (isTokenExpired(token, 20_000)) {
      const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        const renewed = await refreshSessionTokens();
        if (renewed) {
          token = renewed;
        }
      }
    }

    if (token && config.headers) {
      setRequestAuthHeader(config.headers, token);
    }
  } catch {}
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.success !== false) {
      const scopes = detectMutationScopes(response.config?.url, response.config?.method);
      if (scopes && scopes.length > 0) {
        emitApiMutation(scopes);
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthRoute = Boolean(originalRequest?.url && originalRequest.url.includes('/auth/'));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      // Si otro request concurrente ya rotó el token en almacenamiento, reutilizarlo sin llamar otra vez a /auth/refresh
      const sentAuth = extractRequestAuthHeader(originalRequest.headers);
      const currentStoredToken = await tokenStorage.getItem(ACCESS_TOKEN_KEY);
      if (
        currentStoredToken &&
        !isTokenExpired(currentStoredToken, 5_000) &&
        sentAuth !== `Bearer ${currentStoredToken}`
      ) {
        setRequestAuthHeader(originalRequest.headers, currentStoredToken);
        return apiClient(originalRequest);
      }

      const newAccessToken = await refreshSessionTokens();
      if (newAccessToken) {
        setRequestAuthHeader(originalRequest.headers, newAccessToken);
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
