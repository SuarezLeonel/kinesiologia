/**
 * @file DataSyncContext.tsx
 * @description Contexto reactivo global de sincronización e invalidación automática de datos.
 * Garantiza que cualquier operación CRUD (pacientes, turnos, historias clínicas, tratamientos,
 * sesiones, ejercicios, servicios, tarifas y pagos) actualice de forma instantánea todas las
 * vistas activas sin requerir recargas manuales de página.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { MutationScope, subscribeToApiMutations, emitApiMutation } from '../api/client';

export type ScopeVersions = Record<MutationScope, number>;

const INITIAL_SCOPE_VERSIONS: ScopeVersions = {
  all: 0,
  patients: 0,
  users: 0,
  appointments: 0,
  clinicalRecords: 0,
  treatments: 0,
  exercises: 0,
  services: 0,
  payments: 0,
  dashboard: 0,
  patientPortal: 0
};

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
  const [syncVersion, setSyncVersion] = useState<number>(0);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersions>(INITIAL_SCOPE_VERSIONS);
  const lastFocusSyncRef = useRef<number>(0);

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

  // Sincronización automática al recuperar el foco de la ventana (Web) o volver al primer plano (Móvil)
  useEffect(() => {
    const triggerFocusRefresh = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 2500) return;
      lastFocusSyncRef.current = now;
      applyScopesIncrement(['all']);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          triggerFocusRefresh();
        }
      };
      window.addEventListener('focus', triggerFocusRefresh);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
      return () => {
        window.removeEventListener('focus', triggerFocusRefresh);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
      };
    } else {
      const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          triggerFocusRefresh();
        }
      });
      return () => sub.remove();
    }
  }, [applyScopesIncrement]);

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

