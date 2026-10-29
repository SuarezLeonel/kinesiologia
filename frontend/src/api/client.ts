import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

const ACCESS_TOKEN_KEY = 'kine_access_token';
const REFRESH_TOKEN_KEY = 'kine_refresh_token';

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
  timeout: 10000
});

// Interceptor para inyectar token de autorización
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await getStorageItem(ACCESS_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
});

// Interceptor para manejo de renovación automática de tokens
let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const refreshToken = await getStorageItem(REFRESH_TOKEN_KEY);
            if (!refreshToken) return null;

            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
            if (res.data?.success && res.data?.data?.accessToken) {
              const newAccessToken = res.data.data.accessToken;
              await setStorageItem(ACCESS_TOKEN_KEY, newAccessToken);
              if (res.data.data.refreshToken) {
                await setStorageItem(REFRESH_TOKEN_KEY, res.data.data.refreshToken);
              }
              return newAccessToken;
            }
            return null;
          } catch (refreshErr) {
            await deleteStorageItem(ACCESS_TOKEN_KEY);
            await deleteStorageItem(REFRESH_TOKEN_KEY);
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
