import { NextResponse, type NextRequest } from 'next/server';
import { checkCover, COVER_MAX_BYTES, isUuid } from '@/features/admin/validation';
import { ApiError, toUserMessage } from '@/lib/http/errors';
import { enforceLimit, limiters, RateLimitedError } from '@/server/action-utils';
import { getSession } from '@/server/auth/dal';
import { services } from '@/services';

// Subida de la portada de un curso. Es un Route Handler (no una Server Action) a propósito:
// las Server Actions comparten un límite global de 1 MB y subirlo abriría TODAS las acciones a
// cuerpos grandes. Aquí el límite (5 MB) aplica solo a esta ruta y se revisa ANTES de leer el cuerpo.

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest, ctx: RouteContext<'/admin/cursos/[id]/portada'>) {
  // Las Server Actions comprueban el origen solas; un Route Handler debe hacerlo a mano (CSRF).
  // Igual que Next: el host del Origin debe ser el host al que llegó la petición (o el del proxy delante).
  if (!sameOrigin(request)) return fail(403, 'Origen no permitido.');

  const session = await getSession();
  if (!session) return fail(401, 'Tu sesión terminó. Vuelve a ingresar.');
  if (session.user.role !== 'admin') return fail(403, 'No tienes permiso para hacer esto.');

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(400, 'Curso no válido.');

  const declared = Number(request.headers.get('content-length'));
  if (!declared || declared > COVER_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) return fail(413, 'La imagen pesa más de 5 MB.');

  try {
    enforceLimit(limiters.admin, session.user.id);
    const file = (await request.formData()).get('file');
    const problem = checkCover(file instanceof File ? file : null);
    if (problem || !(file instanceof File)) return fail(400, problem ?? 'Elige una imagen.');

    await services.admin.replaceCourseCover(session, id, file);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RateLimitedError) return fail(429, `Vas muy rápido. Espera ${error.retryAfterSec} s.`);
    if (!(error instanceof ApiError)) console.error('[portada]', error);
    const status = error instanceof ApiError && error.status ? error.status : 500;
    const message = error instanceof ApiError && error.code === 'unavailable'
      ? 'El almacenamiento de imágenes no está configurado en este entorno.'
      : toUserMessage(error);
    return fail(status, message);
  }
}
