/**
 * @file AuthContext.tsx
 * @description Contexto global de autenticación en React Native.
 * Administra el estado de sesión, tokens en SecureStore, login tradicional, login social y logout.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api/client';
import { API_BASE_URL } from '../api/config';

export type UserRole = 'admin' | 'kinesiologo' | 'recepcionista' | 'paciente';

export const normalizeRole = (rawRole?: string): UserRole => {
  if (!rawRole) return 'recepcionista';
  const lower = String(rawRole).toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'kinesiologo' || lower === 'kinesiologist') return 'kinesiologo';
  if (lower === 'recepcionista' || lower === 'receptionist') return 'recepcionista';
  if (lower === 'paciente' || lower === 'patient') return 'paciente';
  return 'recepcionista';
};

export interface User {
  id: number;
  name: string;
  lastName?: string;
  last_name?: string;
  email: string;
  role: UserRole;
  role_name?: string;
  patientId?: number;
}

export interface RegisterPatientPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dni?: string;
  birthDate?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
}

export type SocialProvider = 'google' | 'github' | 'microsoft' | 'facebook';

export interface SocialLoginPayload {
  provider: SocialProvider;
  idToken?: string;
  accessToken?: string;
  code?: string;
  codeVerifier?: string;
  registrationToken?: string;
  redirectUri?: string;
  existingPassword?: string;
  confirmedEmail?: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  phone?: string;
  birthDate?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  address?: string;
}

export interface SocialLoginResult {
  success: boolean;
  requiresLinkingConfirmation?: boolean;
  requiresEmail?: boolean;
  requiresProfileCompletion?: boolean;
  registrationToken?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  provider?: SocialProvider;
  message?: string;
  error?: string;
}

export interface OAuthConfig {
  google: { configured: boolean; clientId: string | null };
  github: { configured: boolean; clientId: string | null };
  facebook: { configured: boolean; appId: string | null };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isKinesiologist: boolean;
  isReceptionist: boolean;
  isPatient: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerPatient: (data: RegisterPatientPayload) => Promise<{ success: boolean; error?: string; linkedToExistingPatient?: boolean; message?: string }>;
  googleLogin: (idToken?: string, email?: string) => Promise<SocialLoginResult>;
  socialLogin: (payload: SocialLoginPayload) => Promise<SocialLoginResult>;
  getOAuthConfig: () => Promise<OAuthConfig | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const USER_STORAGE_KEY = 'kine_current_user';
const ACCESS_TOKEN_KEY = 'kine_access_token';
const REFRESH_TOKEN_KEY = 'kine_refresh_token';

// Helper compatible con Web y Móvil (SecureStore no soporta web por defecto)
const storage = {
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await storage.getItem(USER_STORAGE_KEY);
        const token = await storage.getItem(ACCESS_TOKEN_KEY);
        if (savedUser && token) {
          const parsed = JSON.parse(savedUser);
          const normalized: User = {
            ...parsed,
            role: normalizeRole(parsed.role || parsed.role_name),
            lastName: parsed.lastName || parsed.last_name || ''
          };
          setUser(normalized);
        }
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      if (response.data?.success) {
        const { user: rawUser, accessToken, refreshToken } = response.data.data;
        const normalizedUser: User = {
          ...rawUser,
          role: normalizeRole(rawUser.role || rawUser.role_name),
          lastName: rawUser.lastName || rawUser.last_name || ''
        };
        await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
        await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        await storage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
        setUser(normalizedUser);
        return { success: true };
      }
      return { success: false, error: response.data?.error?.message || 'Error al iniciar sesión' };
    } catch (err: any) {
      const isNetworkErr = err.code === 'ERR_NETWORK' || err.message === 'Network Error' || !err.response;
      const msg = err.response?.data?.error?.message ||
        (isNetworkErr
          ? `Error de red al conectar con el servidor (${API_BASE_URL}). Verifique su conexión a internet.`
          : err.message || 'No se pudo conectar con el servidor');
      return { success: false, error: msg };
    }
  };

  const registerPatient = async (data: RegisterPatientPayload) => {
    try {
      const response = await apiClient.post('/auth/register-patient', data);
      if (response.data?.success) {
        const { user: rawUser, tokens, linkedToExistingPatient } = response.data.data;
        const normalizedUser: User = {
          ...rawUser,
          role: normalizeRole(rawUser.role || rawUser.role_name),
          lastName: rawUser.lastName || rawUser.last_name || '',
          patientId: response.data.data.patientId
        };
        if (tokens?.accessToken) {
          await storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
          await storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
          await storage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
          setUser(normalizedUser);
        }
        return {
          success: true,
          linkedToExistingPatient,
          message: linkedToExistingPatient
            ? '¡Tu cuenta ha sido vinculada con éxito a tu ficha médica existente!'
            : 'Tu cuenta de paciente ha sido creada exitosamente.'
        };
      }
      return { success: false, error: response.data?.error?.message || 'Error al registrar paciente' };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'No se pudo procesar el registro';
      return { success: false, error: msg };
    }
  };

  const getOAuthConfig = async (): Promise<OAuthConfig | null> => {
    try {
      const response = await apiClient.post('/auth/oauth-config', {});
      if (response.data?.success && response.data.data) {
        return response.data.data;
      }
    } catch {
      // Fallback a variables de entorno locales de Expo si están definidas
    }

    return {
      google: {
        configured: Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID),
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || null
      },
      github: {
        configured: Boolean(process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID),
        clientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || null
      },
      facebook: {
        configured: Boolean(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID),
        appId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || null
      }
    };
  };

  const socialLogin = async (payload: SocialLoginPayload): Promise<SocialLoginResult> => {
    try {
      const response = await apiClient.post('/auth/social', payload);
      if (response.data?.success) {
        const data = response.data.data;

        // Caso: Requiere confirmación de vinculación con contraseña de cuenta existente
        if (data?.requiresLinkingConfirmation) {
          return {
            success: false,
            requiresLinkingConfirmation: true,
            registrationToken: data.registrationToken,
            email: data.email,
            provider: data.provider,
            message: data.message
          };
        }

        // Caso: Registro nuevo requiere completar datos de perfil (nombre, apellido, DNI, teléfono, obra social)
        if (data?.requiresProfileCompletion) {
          return {
            success: false,
            requiresProfileCompletion: true,
            registrationToken: data.registrationToken,
            email: data.email,
            provider: data.provider,
            firstName: data.firstName,
            lastName: data.lastName,
            message: data.message
          };
        }

        // Caso: Proveedor no suministró correo (ej. Facebook sin permiso de email)
        if (data?.requiresEmail) {
          return {
            success: false,
            requiresEmail: true,
            registrationToken: data.registrationToken,
            provider: data.provider,
            message: data.message
          };
        }

        const { user: rawUser, tokens, patientId } = data;
        const normalizedUser: User = {
          ...rawUser,
          role: normalizeRole(rawUser.role || rawUser.role_name),
          lastName: rawUser.lastName || rawUser.last_name || '',
          patientId
        };
        if (tokens?.accessToken) {
          await storage.setItem(ACCESS_TOKEN_KEY, accessTokenOrFallback(tokens.accessToken));
          await storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
          await storage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
          setUser(normalizedUser);
        }
        return { success: true };
      }
      return { success: false, error: response.data?.error?.message || 'Error en autenticación social' };
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Error al autenticar con el proveedor seleccionado';
      return { success: false, error: msg };
    }
  };

  const accessTokenOrFallback = (token: string) => token;

  const googleLogin = async (idToken?: string, email?: string): Promise<SocialLoginResult> => {
    return socialLogin({
      provider: 'google',
      idToken: idToken || 'google_demo_patient_token_' + Date.now(),
      confirmedEmail: email
    });
  };

  const logout = async () => {
    try {
      const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch (e) {
    } finally {
      await storage.deleteItem(ACCESS_TOKEN_KEY);
      await storage.deleteItem(REFRESH_TOKEN_KEY);
      await storage.deleteItem(USER_STORAGE_KEY);
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isKinesiologist = user?.role === 'kinesiologo';
  const isReceptionist = user?.role === 'recepcionista';
  const isPatient = user?.role === 'paciente';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isKinesiologist,
        isReceptionist,
        isPatient,
        login,
        registerPatient,
        googleLogin,
        socialLogin,
        getOAuthConfig,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
