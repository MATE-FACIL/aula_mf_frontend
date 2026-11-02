import { NextResponse, type NextRequest } from 'next/server';
import { HOME_BY_ROLE, LOGIN_PATH, ROLE_COOKIE, SESSION_COOKIE, areaOf } from '@/server/auth/constants';
import type { Role } from '@/types/domain';

// Comprobación OPTIMISTA (solo mira si existen cookies, sin llamar al backend → casi sin CPU).
// La verificación real del token ocurre en el DAL (server/auth/dal.ts) y en cada Server Action.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const role = request.cookies.get(ROLE_COOKIE)?.value as Role | undefined;
  const home = role && role in HOME_BY_ROLE ? HOME_BY_ROLE[role] : null;

  // El DAL detectó un token inválido/vencido: se borran las cookies para no rebotar entre páginas.
  if (pathname === LOGIN_PATH && request.nextUrl.searchParams.has('expirada')) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(ROLE_COOKIE);
    return response;
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSession && home ? home : LOGIN_PATH, request.url));
  }

  const area = areaOf(pathname);
  if (area && !hasSession) {
    const url = new URL(LOGIN_PATH, request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Cada rol solo entra a su área (alumno, familia o administración).
  if (area && home && area !== role) return NextResponse.redirect(new URL(home, request.url));

  return NextResponse.next();
}

export const config = {
  // Solo páginas: se excluyen estáticos, imágenes y archivos con extensión.
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|apple-icon.png|.*\\..*).*)'],
};
