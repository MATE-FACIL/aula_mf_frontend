import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/config/env';
import type { Role } from '@/types/domain';
import { SESSION_MAX_AGE_SEC } from './backend-session';
import { REFRESH_COOKIE, ROLE_COOKIE, SESSION_COOKIE } from './constants';

// Cookies de sesión. El token del backend .NET vive en una cookie httpOnly:
// JavaScript del navegador no puede leerlo (protección ante XSS).
// `mf_role` solo sirve para redirecciones optimistas en proxy.ts; nunca para autorizar.

const baseCookie = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * Con token de renovación (backend real) la sesión dura lo que la renovación (7 días): el token de acceso
 * vence a los 15 min y proxy.ts lo renueva solo. Sin él (modo mock) dura lo que el token.
 */
export async function writeSession(token: string, role: Role, maxAgeSec: number, refreshToken?: string | null) {
  const store = await cookies();
  const maxAge = refreshToken ? SESSION_MAX_AGE_SEC : maxAgeSec;
  store.set(SESSION_COOKIE, token, { ...baseCookie, maxAge });
  store.set(ROLE_COOKIE, role, { ...baseCookie, maxAge });
  if (refreshToken) store.set(REFRESH_COOKIE, refreshToken, { ...baseCookie, maxAge });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ROLE_COOKIE);
  store.delete(REFRESH_COOKIE);
}
