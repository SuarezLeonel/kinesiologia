/**
 * @file ThemeContext.tsx
 * @description Contexto global de tema visual (claro / oscuro / automático sincronizado con el sistema).
 * Soporta persistencia individualizada por usuario (tanto pacientes como personal) y detección dinámica de SO.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightTheme, darkTheme, ThemeColors } from './colors';
import * as designTokens from './tokens';
import { useAuth } from '../context/AuthContext';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeColors;
  tokens: typeof designTokens;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

const GLOBAL_THEME_KEY = 'kine_theme_mode_v2';

const getUserStorageKey = (userId?: number | string | null, email?: string | null): string | null => {
  if (userId) return `kine_theme_mode_user_${userId}`;
  if (email) return `kine_theme_mode_user_${email.trim().toLowerCase()}`;
  return null;
};

// Helper multiplataforma de almacenamiento
export const themeStorage = {
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
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const auth = useAuth();
  const user = auth?.user;

  // Carga y sincronización de preferencia de tema por usuario activo
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const userKey = getUserStorageKey(user?.id, user?.email);

        if (userKey) {
          const userSaved = await themeStorage.getItem(userKey);
          if (isMounted) {
            if (userSaved === 'light' || userSaved === 'dark' || userSaved === 'system') {
              setModeState(userSaved);
            } else {
              // Si el usuario todavía no configuró una preferencia, se utiliza el tema automático
              setModeState('system');
            }
          }
        } else {
          // Si no hay sesión iniciada (pantalla de login o registro)
          const generalSaved = await themeStorage.getItem(GLOBAL_THEME_KEY);
          if (isMounted) {
            if (generalSaved === 'light' || generalSaved === 'dark' || generalSaved === 'system') {
              setModeState(generalSaved);
            } else {
              setModeState('system');
            }
          }
        }
      } catch (e) {
        // Fallback silente ante excepciones de lectura
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email]);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);

    const userKey = getUserStorageKey(user?.id, user?.email);
    if (userKey) {
      await themeStorage.setItem(userKey, newMode);
    }

    // Persistencia en clave global para mantener la preferencia en transiciones y evitar parpadeos
    await themeStorage.setItem(GLOBAL_THEME_KEY, newMode);
  };

  const isDark = mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, tokens: designTokens, mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
