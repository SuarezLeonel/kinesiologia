/**
 * @file queryCache.tsx
 * @description Caché en memoria, deduplicación de solicitudes simultáneas (in-flight)
 * y soporte de cancelación segura mediante AbortSignal para consultas POST del frontend.
 * Se invalida automáticamente ante mutaciones del backend o cierre/cambio de sesión.
 */
import axios, { AxiosResponse } from 'axios';
import {
  apiClient,
  MutationScope,
  subscribeToApiMutations,
  subscribeToSessionExpired
} from './client';
import { invalidateClientCalendarCache } from '../utils/bookingCalendar';

export interface CachedPostOptions {
  staleTimeMs?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  scopes?: MutationScope[];
}

interface CacheEntry<T = any> {
  response: AxiosResponse<T>;
  fetchedAt: number;
  scopes: MutationScope[];
}

interface InFlightEntry<T = any> {
  promise: Promise<AxiosResponse<T>>;
  controller: AbortController;
  subscribers: number;
}

const DEFAULT_SHORT_TTL_MS = 10_000;
const REFERENCE_DATA_TTL_MS = 60_000;

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, InFlightEntry>();

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function inferScopesFromUrl(url: string): MutationScope[] {
  const u = url.toLowerCase();
  if (u.includes('/dashboard/summary')) return ['dashboard', 'appointments', 'payments', 'vacations'];
  if (u.includes('/vacations/')) return ['vacations', 'dashboard', 'appointments'];
  if (u.includes('/appointments/professionals')) return ['users', 'appointments'];
  if (u.includes('/appointments/')) return ['appointments', 'vacations', 'services'];
  if (u.includes('/patients/')) return ['patients'];
  if (u.includes('/users/')) return ['users'];
  if (u.includes('/services/')) return ['services'];
  if (u.includes('/clinical-records/')) return ['clinicalRecords', 'patients', 'treatments'];
  if (u.includes('/exercises/')) return ['exercises'];
  if (u.includes('/payments/')) return ['payments', 'appointments', 'patients'];
  if (u.includes('/treatments/')) return ['treatments', 'clinicalRecords', 'exercises'];
  if (u.includes('/patient-portal/')) return ['patientPortal', 'appointments', 'vacations', 'treatments'];
  return ['all'];
}

function getDefaultStaleTimeMs(url: string): number {
  const u = url.toLowerCase();
  if (
    u.includes('/appointments/professionals') ||
    u.includes('/services/search') ||
    u.includes('/exercises/filter-options') ||
    u.includes('/appointments/holidays/search')
  ) {
    return REFERENCE_DATA_TTL_MS;
  }
  return DEFAULT_SHORT_TTL_MS;
}

function createAbortError(message = 'Solicitud cancelada por cambio de vista o actualización'): Error {
  return new axios.CanceledError(message);
}

/**
 * Invalida entradas en caché asociadas a uno o más scopes de datos.
 */
export function invalidateQueryCache(scopes?: MutationScope | MutationScope[]): void {
  if (!scopes) {
    responseCache.clear();
    return;
  }
  const scopeList = Array.isArray(scopes) ? scopes : [scopes];
  if (scopeList.includes('all')) {
    responseCache.clear();
    invalidateClientCalendarCache();
    return;
  }

  for (const [key, entry] of responseCache.entries()) {
    if (entry.scopes.some((s) => scopeList.includes(s))) {
      responseCache.delete(key);
    }
  }

  if (scopeList.includes('vacations') || scopeList.includes('appointments') || scopeList.includes('services')) {
    invalidateClientCalendarCache();
  }
}

/**
 * Limpia por completo la caché y cancela solicitudes activas (ej. al cerrar sesión o cambiar de usuario).
 */
export function clearQueryCache(): void {
  responseCache.clear();
  for (const entry of inFlightRequests.values()) {
    try {
      entry.controller.abort();
    } catch {}
  }
  inFlightRequests.clear();
  invalidateClientCalendarCache();
}

// Suscripción automática a mutaciones exitosas y expiración de sesión emitidas por client.tsx
subscribeToApiMutations((scopes) => {
  invalidateQueryCache(scopes);
});

subscribeToSessionExpired(() => {
  clearQueryCache();
});

/**
 * Ejecuta una consulta POST deduplicando llamadas idénticas simultáneas y reutilizando caché vigente.
 */
export async function cachedPost<T = any>(
  url: string,
  payload: Record<string, any> = {},
  options: CachedPostOptions = {}
): Promise<AxiosResponse<T>> {
  const {
    staleTimeMs = getDefaultStaleTimeMs(url),
    forceRefresh = false,
    signal,
    scopes = inferScopesFromUrl(url)
  } = options;

  if (signal?.aborted) {
    throw createAbortError();
  }

  const key = `POST::${url}::${stableStringify(payload)}`;
  const now = Date.now();

  if (!forceRefresh && staleTimeMs > 0) {
    const cached = responseCache.get(key);
    if (cached && now - cached.fetchedAt < staleTimeMs) {
      return { ...cached.response };
    }
  }

  let inFlight = inFlightRequests.get(key);
  if (!inFlight) {
    const controller = new AbortController();
    const promise = apiClient
      .post<T>(url, payload, { signal: controller.signal })
      .then((res) => {
        if (res.data && (res.data as any).success !== false) {
          responseCache.set(key, {
            response: res,
            fetchedAt: Date.now(),
            scopes
          });
        }
        return res;
      })
      .finally(() => {
        inFlightRequests.delete(key);
      });

    inFlight = {
      promise,
      controller,
      subscribers: 0
    };
    inFlightRequests.set(key, inFlight);
  }

  inFlight.subscribers += 1;

  if (!signal) {
    try {
      return await inFlight.promise;
    } finally {
      inFlight.subscribers = Math.max(0, inFlight.subscribers - 1);
    }
  }

  return await new Promise<AxiosResponse<T>>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
      if (inFlight) {
        inFlight.subscribers = Math.max(0, inFlight.subscribers - 1);
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (inFlight && inFlight.subscribers <= 1) {
        try {
          inFlight.controller.abort();
        } catch {}
      }
      cleanup();
      reject(createAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });

    inFlight!.promise.then(
      (res) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(res);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }
    );
  });
}

/**
 * Helper para identificar errores producidos por cancelación explícita de solicitudes.
 */
export function isRequestCanceled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as any;
  return (
    axios.isCancel(err) ||
    anyErr.code === 'ERR_CANCELED' ||
    anyErr.name === 'CanceledError' ||
    anyErr.name === 'AbortError'
  );
}

