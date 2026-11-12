/**
 * @file DataSyncContext.tsx
 * @description Contexto reactivo global de sincronización e invalidación automática de datos.
 * Garantiza que las mutaciones actualicen vistas activas sin generar ráfagas ni llamadas redundantes al recuperar foco.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { MutationScope, subscribeToApiMutations, emitApiMutation } from '../api/client';
import { useAuth } from './AuthContext';

export type ScopeVersions = Record<MutationScope, number>;

const INITIAL_SCOPE_VERSIONS: ScopeVersions = {
  all: 0,
  patients: 0,
  users: 0,
  appointments: 0,
  vacations: 0,
  clinicalRecords: 0,
  treatments: 0,
  exercises: 0,
  services: 0,
  payments: 0,
  dashboard: 0,
  patientPortal: 0
};

const FOCUS_SYNC_COOLDOWN_MS = 30_000;

interface DataSyncContextType {
  syncVersion: number;
  scopeVersions: ScopeVersions;
  notifyMutation: (scopes?: MutationScope | MutationScope[]) => void;
}

const DataSyncContext = createContext<DataSyncContextType>({
  syncVersion: 0,
  scopeVersions: INITIAL_SCOPE_VERSIONS,
  notifyMutation: () => {}
});

export const DataSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [syncVersion, setSyncVersion] = useState<number>(0);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersions>(INITIAL_SCOPE_VERSIONS);
  const lastFocusSyncRef = useRef<number>(Date.now());
  const wasBackgroundedRef = useRef<boolean>(false);

  const applyScopesIncrement = useCallback((scopes: MutationScope[]) => {
    setSyncVersion((prev) => prev + 1);
    setScopeVersions((prev) => {
      const next = { ...prev, all: prev.all + 1 };
      const isAll = scopes.includes('all');
      if (isAll) {
        (Object.keys(next) as MutationScope[]).forEach((k) => {
          if (k !== 'all') {
            next[k] = prev[k] + 1;
          }
        });
      } else {
        scopes.forEach((scope) => {
          if (scope in next && scope !== 'all') {
            next[scope] = prev[scope] + 1;
          }
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToApiMutations((scopes) => {
      applyScopesIncrement(scopes);
    });
    return unsubscribe;
  }, [applyScopesIncrement]);

  // Reiniciar contadores cuando el usuario cierra sesión para evitar disparos residuales
  useEffect(() => {
    if (!user) {
      setSyncVersion(0);
      setScopeVersions(INITIAL_SCOPE_VERSIONS);
      wasBackgroundedRef.current = false;
    }
  }, [user]);

  // Sincronización automática únicamente al volver desde segundo plano / pestaña oculta tras al menos 30s
  useEffect(() => {
    if (!user) return;

    const triggerFocusRefresh = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < FOCUS_SYNC_COOLDOWN_MS) return;
      lastFocusSyncRef.current = now;
      applyScopesIncrement(['all']);
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          wasBackgroundedRef.current = true;
          return;
        }
        if (document.visibilityState === 'visible' && wasBackgroundedRef.current) {
          wasBackgroundedRef.current = false;
          triggerFocusRefresh();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    let previousState: AppStateStatus = (AppState.currentState || 'active') as AppStateStatus;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasInBackground = previousState === 'background' || previousState === 'inactive';
      previousState = nextState;
      if (wasInBackground && nextState === 'active') {
        triggerFocusRefresh();
      }
    });
    return () => sub.remove();
  }, [user, applyScopesIncrement]);

  const notifyMutation = useCallback((scopes: MutationScope | MutationScope[] = 'all') => {
    const scopeArray = Array.isArray(scopes) ? scopes : [scopes];
    emitApiMutation(scopeArray);
  }, []);

  return (
    <DataSyncContext.Provider value={{ syncVersion, scopeVersions, notifyMutation }}>
      {children}
    </DataSyncContext.Provider>
  );
};

export const useDataSync = () => useContext(DataSyncContext);
