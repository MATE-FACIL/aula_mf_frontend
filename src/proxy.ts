import { NextResponse, type NextRequest } from 'next/server';
import { needsRenewal, renewBackendSession, SESSION_MAX_AGE_SEC, usesBackendSession } from '@/server/auth/backend-session';
import { HOME_BY_ROLE, LOGIN_PATH, REFRESH_COOKIE, ROLE_COOKIE, SESSION_COOKIE, areaOf } from '@/server/auth/constants';
import type { Role } from '@/types/domain';

// Comprobación OPTIMISTA (solo mira cookies → casi sin CPU). La verificación real del token ocurre en el DAL
// (server/auth/dal.ts) y en cada Server Action.
//
// SCRUM-36: con el backend real, el token de acceso dura 15 min. Si está por vencer, aquí se renueva ANTES de
// renderizar (una llamada al backend, solo en ese momento; el resto de peticiones no llama a nadie). El token
// nuevo se pasa a la página en la misma petición y se guarda en el navegador.

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SEC,
};

function clearAndGoToLogin(request: NextRequest) {
  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set('expirada', '1');
  return NextResponse.redirect(url);
}

/** Renueva la sesión si el token de acceso está por vencer. `undefined` = no hacía falta o el backend no respondió. */
async function renewIfNeeded(request: NextRequest): Promise<NextResponse | undefined> {
  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!usesBackendSession() || !accessToken || !refreshToken || !needsRenewal(accessToken)) return undefined;

  const renewed = await renewBackendSession(refreshToken);
  if (renewed === 'unavailable') return undefined; // backend caído: no se cierra la sesión por eso
  if (renewed === null) return clearAndGoToLogin(request);

  // La página de ESTA petición ya lee el token nuevo…
  request.cookies.set(SESSION_COOKIE, renewed.accessToken);
  if (renewed.refreshToken) request.cookies.set(REFRESH_COOKIE, renewed.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  // …y el navegador lo guarda para las siguientes (el rol no cambia: solo se extiende su vigencia).
  response.cookies.set(SESSION_COOKIE, renewed.accessToken, cookieOptions);
  if (renewed.refreshToken) response.cookies.set(REFRESH_COOKIE, renewed.refreshToken, cookieOptions);
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  if (role) response.cookies.set(ROLE_COOKIE, role, cookieOptions);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const role = request.cookies.get(ROLE_COOKIE)?.value as Role | undefined;
  const home = role && role in HOME_BY_ROLE ? HOME_BY_ROLE[role] : null;

  // El DAL detectó un token inválido/vencido: se borran las cookies para no rebotar entre páginas.
  if (pathname === LOGIN_PATH && request.nextUrl.searchParams.has('expirada')) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(ROLE_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
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

  if (area) return (await renewIfNeeded(request)) ?? NextResponse.next();
  return NextResponse.next();
}

export const config = {
  // Solo páginas: se excluyen estáticos, imágenes y archivos con extensión.
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico|apple-icon.png|.*\\..*).*)'],
};
