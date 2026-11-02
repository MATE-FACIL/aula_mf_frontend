import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import { ApiError } from '@/lib/http/errors';
import type { Role, SessionUser } from '@/types/domain';
import type { AuthResult, AuthService } from '../contracts';
import { nullOn401 } from './shared';

// Autenticación contra la API .NET real (la usan los modos `http` e `hybrid`).
//
// El ROL de la sesión sale de `GET /auth/me` (roles del backend), nunca del formulario de ingreso:
// así nadie puede entrar al panel de administración cambiando una cookie o un campo oculto.

interface BackendToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface BackendMe {
  userId: string;
  status: string;
  roles: string[];
  displayName: string | null;
}

/** El backend todavía no guarda zona horaria por persona: Mate Fácil opera en Perú. */
const DEFAULT_TIME_ZONE = 'America/Lima';

/** Si una persona tiene varios roles, gana el de más alcance. */
export function roleFromBackend(roles: readonly string[]): Role | null {
  if (roles.includes('administrator')) return 'admin';
  if (roles.includes('guardian')) return 'family';
  if (roles.includes('student')) return 'student';
  return null;
}

const NO_ACCESS = 'Tu cuenta todavía no tiene acceso al aula. Escríbenos para activarla.';

async function me(token: string): Promise<SessionUser | null> {
  const account = await nullOn401(apiRequest<BackendMe>('/auth/me', { token }));
  if (!account || account.status !== 'active') return null;
  const role = roleFromBackend(account.roles);
  if (!role) return null;
  return { id: account.userId, role, displayName: account.displayName ?? 'Usuario', timeZone: DEFAULT_TIME_ZONE };
}

async function login(path: string, body: unknown): Promise<AuthResult | null> {
  const result = await nullOn401(apiRequest<BackendToken>(path, { method: 'POST', body }));
  if (!result) return null;
  // Una petición extra SOLO al ingresar: deja la sesión con el rol y el nombre verificados.
  const user = await me(result.accessToken);
  if (!user) throw new ApiError('forbidden', 'Cuenta sin rol o inactiva', 403, undefined, NO_ACCESS);
  return { token: result.accessToken, user, expiresIn: result.expiresIn };
}

export const backendAuth: AuthService = {
  loginStudent: ({ username, password }) => login('/auth/student/login', { username, password }),
  // `admin/login` es el ingreso por correo del backend: sirve a familias y al equipo por igual.
  loginFamily: ({ email, password }) => login('/auth/admin/login', { email, password }),
  me,
  logout: (token) => apiRequest('/auth/logout', { method: 'POST', token }),
};
