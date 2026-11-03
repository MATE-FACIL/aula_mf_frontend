// Compartido por proxy.ts y la capa de sesión (sin dependencias de servidor para que el proxy lo importe).
import type { Role } from '@/types/domain';

export const SESSION_COOKIE = 'mf_session';
export const ROLE_COOKIE = 'mf_role';
/** Token de renovación del backend (httpOnly). Solo existe con el backend real (modos http/hybrid). */
export const REFRESH_COOKIE = 'mf_refresh';

export const LOGIN_PATH = '/ingreso';

export const HOME_BY_ROLE: Record<Role, string> = {
  student: '/inicio',
  family: '/familia',
  admin: '/admin',
};

export const STUDENT_PATHS = ['/inicio', '/ruta', '/lecciones', '/evaluaciones', '/clases', '/logros'];
export const FAMILY_PATHS = ['/familia'];
export const ADMIN_PATHS = ['/admin'];

export const PATHS_BY_ROLE: Record<Role, string[]> = {
  student: STUDENT_PATHS,
  family: FAMILY_PATHS,
  admin: ADMIN_PATHS,
};

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Área a la que pertenece una ruta protegida, o null si la ruta es pública. */
export function areaOf(pathname: string): Role | null {
  for (const [role, prefixes] of Object.entries(PATHS_BY_ROLE) as [Role, string[]][]) {
    if (matches(pathname, prefixes)) return role;
  }
  return null;
}
