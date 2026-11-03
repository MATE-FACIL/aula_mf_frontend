// Sesión contra el backend .NET (modos `http` e `hybrid`) — SCRUM-36.
//
// El backend entrega un token de acceso corto (15 min) y una cookie de renovación (7 días) que ROTA en cada
// uso: si un token de renovación viejo se vuelve a usar, el backend lo toma como robo y revoca la sesión.
// Por eso la renovación es de «vuelo único»: peticiones simultáneas con el mismo token comparten UNA sola
// llamada al backend, y el resultado se recuerda unos segundos para las que lleguen tarde.
// (Pensado para un solo proceso de Next; con varias instancias haría falta un caché compartido.)
//
// Sin `server-only`: lo importa también proxy.ts. Lee process.env directamente.

const BACKEND_REFRESH_COOKIE = 'aula_virtual_refresh';
const TIMEOUT_MS = 8000;
const SHARED_RESULT_MS = 30_000;
/** Se renueva un poco antes de que venza, para no llegar al backend con un token ya expirado. */
export const RENEW_BEFORE_SEC = 60;

export const usesBackendSession = () => process.env.API_MODE === 'http' || process.env.API_MODE === 'hybrid';

/** Vida de la sesión en el navegador: la del token de renovación del backend (por defecto 7 días). */
export const SESSION_MAX_AGE_SEC = Math.max(1, Number(process.env.SESSION_MAX_AGE_DAYS) || 7) * 24 * 60 * 60;

const apiBase = () => (process.env.API_BASE_URL ?? '').replace(/\/$/, '');

export interface BackendTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
}

export interface AuthCall {
  status: number;
  json: unknown;
  /** Nuevo token de renovación si el backend lo envió en Set-Cookie. */
  refreshToken: string | null;
}

/** Valor de la cookie de renovación del backend dentro de las cabeceras Set-Cookie. */
export function refreshTokenFrom(response: Response): string | null {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0 && pair.slice(0, index).trim() === BACKEND_REFRESH_COOKIE) {
      const value = pair.slice(index + 1).trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

/** Llamada a /auth/* que necesita ver o enviar la cookie de renovación (apiRequest no expone cabeceras). */
export async function callAuth(path: string, options: { body?: unknown; refreshToken?: string | null; accessToken?: string }): Promise<AuthCall> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.refreshToken) headers.Cookie = `${BACKEND_REFRESH_COOKIE}=${encodeURIComponent(options.refreshToken)}`;
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, json, refreshToken: refreshTokenFrom(response) };
}

/** `exp` de un JWT sin verificarlo: solo sirve para decidir cuándo renovar (el backend verifica siempre). */
export function jwtExpiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function needsRenewal(accessToken: string, now = Date.now()): boolean {
  const expiresAt = jwtExpiresAt(accessToken);
  return expiresAt !== null && expiresAt - now < RENEW_BEFORE_SEC * 1000;
}

/** `null` = el backend rechazó la renovación (sesión terminada). `'unavailable'` = no respondió (no cerrar sesión). */
export type RenewResult = BackendTokens | null | 'unavailable';

const inflight = new Map<string, { result: Promise<RenewResult>; at: number }>();

async function renew(refreshToken: string): Promise<RenewResult> {
  try {
    const { status, json, refreshToken: next } = await callAuth('/auth/refresh', { refreshToken });
    if (status === 401) return null;
    const body = json as { accessToken?: unknown; expiresIn?: unknown } | undefined;
    if (status !== 200 || typeof body?.accessToken !== 'string' || typeof body.expiresIn !== 'number') return 'unavailable';
    return { accessToken: body.accessToken, expiresIn: body.expiresIn, refreshToken: next };
  } catch {
    return 'unavailable';
  }
}

export function renewBackendSession(refreshToken: string, now = Date.now()): Promise<RenewResult> {
  for (const [key, entry] of inflight) if (now - entry.at > SHARED_RESULT_MS) inflight.delete(key);
  const existing = inflight.get(refreshToken);
  if (existing) return existing.result;
  const result = renew(refreshToken);
  inflight.set(refreshToken, { result, at: now });
  return result;
}
