/**
 * @file client.tsx
 * @description Cliente Axios centralizado para comunicación HTTP con el backend de KinesioGestión.
 * Implementa interceptores de solicitud para inyección de token JWT (Bearer),
 * renovación automática con Refresh Token vía Expo SecureStore, timeout extendido para cold starts
 * y notificación reactiva de mutaciones para actualización instantánea de la interfaz.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export type MutationScope =
  | 'all'
  | 'patients'
  | 'users'
  | 'appointments'
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
  '/calendar-availability'
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
  if (u.includes('/patients') || u.includes('/register-patient')) {
    return ['patients', 'appointments', 'clinicalRecords', 'payments', 'dashboard'];
  }
  if (u.includes('/users')) {
    return ['users', 'patients', 'appointments', 'dashboard'];
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
  return ['all'];
}

const ACCESS_TOKEN_KEY = 'kine_access_token';
const REFRESH_TOKEN_KEY = 'kine_refresh_token';
const USER_STORAGE_KEY = 'kine_current_user';

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

const getStorageItem = async (key: string): Promise<string | null> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {}
};

const deleteStorageItem = async (key: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {}
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Mecanismo centralizado y thread-safe para renovación de tokens
let refreshPromise: Promise<string | null> | null = null;

export async function refreshSessionTokens(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getStorageItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        await deleteStorageItem(ACCESS_TOKEN_KEY);
        await deleteStorageItem(REFRESH_TOKEN_KEY);
        await deleteStorageItem(USER_STORAGE_KEY);
        emitSessionExpired();
        return null;
      }

      const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      if (res.data?.success && res.data?.data?.accessToken) {
        const newAccessToken = res.data.data.accessToken;
        await setStorageItem(ACCESS_TOKEN_KEY, newAccessToken);
        if (res.data.data.refreshToken) {
          await setStorageItem(REFRESH_TOKEN_KEY, res.data.data.refreshToken);
        }
        return newAccessToken;
      }
      await deleteStorageItem(ACCESS_TOKEN_KEY);
      await deleteStorageItem(REFRESH_TOKEN_KEY);
      await deleteStorageItem(USER_STORAGE_KEY);
      emitSessionExpired();
      return null;
    } catch {
      await deleteStorageItem(ACCESS_TOKEN_KEY);
      await deleteStorageItem(REFRESH_TOKEN_KEY);
      await deleteStorageItem(USER_STORAGE_KEY);
      emitSessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Interceptor para inyectar token de autorización Bearer
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const isAuthRoute = Boolean(config.url && config.url.includes('/auth/'));
    // Si hay un refresco en curso y no es una ruta de auth, esperar a que culmine
    if (refreshPromise && !isAuthRoute) {
      const freshToken = await refreshPromise;
      if (freshToken && config.headers) {
        if (typeof (config.headers as any).set === 'function') {
          (config.headers as any).set('Authorization', `Bearer ${freshToken}`);
        }
        config.headers.Authorization = `Bearer ${freshToken}`;
        delete (config.headers as any)['authorization'];
        return config;
      }
    }

    const token = await getStorageItem(ACCESS_TOKEN_KEY);
    if (token && config.headers) {
      if (typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${token}`);
      }
      config.headers.Authorization = `Bearer ${token}`;
      delete (config.headers as any)['authorization'];
    }
  } catch (e) {}
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

      const newAccessToken = await refreshSessionTokens();
      if (newAccessToken) {
        if (originalRequest.headers) {
          if (typeof (originalRequest.headers as any).set === 'function') {
            (originalRequest.headers as any).set('Authorization', `Bearer ${newAccessToken}`);
          }
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          delete (originalRequest.headers as any)['authorization'];
        }
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
