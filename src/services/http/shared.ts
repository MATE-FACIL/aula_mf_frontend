import 'server-only';
import { ApiError, type ApiErrorCode } from '@/lib/http/errors';

export const enc = encodeURIComponent;

/** Convierte un error HTTP esperado en `null` (p. ej. 401 al iniciar sesión, 404 al buscar por id). */
async function nullOn<T>(code: ApiErrorCode, promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.code === code) return null;
    throw error;
  }
}

/** 401 al iniciar sesión = credenciales incorrectas, no un error del sistema. */
export const nullOn401 = <T>(promise: Promise<T>) => nullOn('unauthorized', promise);

export const nullOn404 = <T>(promise: Promise<T>) => nullOn('not_found', promise);

/** Algo que existe pero no es de quien pregunta (p. ej. la clase de otro profesor) se muestra como «no encontrado». */
export const nullOn403or404 = <T>(promise: Promise<T>) => nullOn404(nullOn('forbidden', promise));
