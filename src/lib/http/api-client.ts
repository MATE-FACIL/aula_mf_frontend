import 'server-only';
import { env } from '@/config/env';
import { ApiError, codeFromStatus } from './errors';

// Cliente HTTP hacia la API .NET. Solo corre en el servidor de Next (BFF):
// el token viaja en una cookie httpOnly y nunca se expone al navegador.
//
// - Límite de tiempo por petición (AbortSignal.timeout) → una API lenta no bloquea el VPS.
// - Un reintento con espera corta solo para lecturas (GET) ante errores de red / 502-504.
// - Errores normalizados en ApiError (con el `detail` del ProblemDetails, si lo hay).

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  /** Objeto → JSON. FormData → multipart (el navegador de Node pone el boundary). */
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  /** Reintentos para peticiones idempotentes. Por defecto 1 en GET y 0 en el resto. */
  retries?: number;
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 300;
const MAX_DETAIL_LENGTH = 300;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lee `detail` de un ProblemDetails (RFC 9457) sin fallar si el cuerpo no es JSON. */
async function problemDetail(response: Response): Promise<string | undefined> {
  if (!response.headers.get('Content-Type')?.includes('json')) return undefined;
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === 'string' ? body.detail.slice(0, MAX_DETAIL_LENGTH) : undefined;
  } catch {
    return undefined;
  }
}

/** Arma la query string omitiendo valores vacíos. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = env.apiTimeoutMs, signal } = options;
  const retries = options.retries ?? (method === 'GET' ? 1 : 0);
  const url = `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const isForm = body instanceof FormData;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        cache: 'no-store',
      });

      if (!response.ok) {
        if (attempt < retries && RETRYABLE_STATUS.has(response.status)) {
          await wait(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
        throw new ApiError(codeFromStatus(response.status), `${method} ${path} → ${response.status}`, response.status, retryAfter, await problemDetail(response));
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const isTimeout = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (!isTimeout && attempt < retries) {
        await wait(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw new ApiError(isTimeout ? 'timeout' : 'network', `${method} ${path}: ${(error as Error).message}`);
    }
  }
}
