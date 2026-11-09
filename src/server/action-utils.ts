import 'server-only';
import { headers } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ApiError, toUserMessage } from '@/lib/http/errors';
import { createRateLimiter, type RateLimiter } from '@/lib/rate-limit';
import { LOGIN_PATH } from './auth/constants';

// Utilidades comunes de las Server Actions: resultado tipado, manejo de errores y límites de frecuencia.

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; retryAfterSec?: number };

/** Límites por acción. Se aplican ANTES de llamar a la API para no cargar al backend. */
export const limiters = {
  login: createRateLimiter({ limit: 5, windowMs: 5 * 60_000 }),
  tutor: createRateLimiter({ limit: 12, windowMs: 60_000 }),
  answers: createRateLimiter({ limit: 40, windowMs: 60_000 }),
  messages: createRateLimiter({ limit: 6, windowMs: 60_000 }),
  submissions: createRateLimiter({ limit: 10, windowMs: 60_000 }),
  /** Asistencia que marca el profesor, por profesor. */
  teacher: createRateLimiter({ limit: 60, windowMs: 60_000 }),
  /** Cambios del panel de administración, por administrador. */
  admin: createRateLimiter({ limit: 60, windowMs: 60_000 }),
} satisfies Record<string, RateLimiter>;

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSec: number) {
    super('rate_limited');
  }
}

export function enforceLimit(limiter: RateLimiter, key: string) {
  const result = limiter.consume(key);
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSec);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

/** Ejecuta la acción y convierte cualquier error en un mensaje seguro para la UI. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect()/notFound() de Next
    if (error instanceof RateLimitedError) {
      return { ok: false, error: `Vas muy rápido. Espera ${error.retryAfterSec} s e inténtalo otra vez.`, retryAfterSec: error.retryAfterSec };
    }
    if (error instanceof ApiError && error.code === 'unauthorized') redirect(`${LOGIN_PATH}?expirada=1`);
    if (!(error instanceof ApiError)) console.error('[action]', error);
    return { ok: false, error: toUserMessage(error), retryAfterSec: error instanceof ApiError ? error.retryAfterSec : undefined };
  }
}

/** Recorta y valida texto libre que llega del navegador. */
export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
