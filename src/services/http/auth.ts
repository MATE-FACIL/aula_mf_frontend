import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import { ApiError } from '@/lib/http/errors';
import { callAuth } from '@/server/auth/backend-session';
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

/** Si una persona tiene varios roles, gana el de más alcance (un profesor que además es padre entra como profesor). */
export function roleFromBackend(roles: readonly string[]): Role | null {
  if (roles.includes('administrator')) return 'admin';
  if (roles.includes('instructor')) return 'teacher';
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
  // callAuth (no apiRequest): hace falta leer la cookie de renovación que manda el backend.
  const { status, json, refreshToken } = await callAuth(path, { body });
  if (status === 401) return null;
  if (status === 429) throw new ApiError('rate_limited', `POST ${path} → 429`, 429);
  const result = json as Partial<BackendToken> | undefined;
  if (status !== 200 || typeof result?.accessToken !== 'string' || typeof result.expiresIn !== 'number') {
    throw new ApiError(status === 400 ? 'validation' : 'server', `POST ${path} → ${status}`, status);
  }
  // Una petición extra SOLO al ingresar: deja la sesión con el rol y el nombre verificados.
  const user = await me(result.accessToken);
  if (!user) throw new ApiError('forbidden', 'Cuenta sin rol o inactiva', 403, undefined, NO_ACCESS);
  return { token: result.accessToken, user, expiresIn: result.expiresIn, refreshToken };
}

export const backendAuth: AuthService = {
  loginStudent: ({ username, password }) => login('/auth/student/login', { username, password }),
  // `admin/login` es el ingreso por correo del backend: sirve a familias y al equipo por igual.
  loginFamily: ({ email, password }) => login('/auth/admin/login', { email, password }),
  me,
  // El backend revoca la sesión de este dispositivo a partir de su token de renovación.
  logout: async (token, refreshToken) => {
    await callAuth('/auth/logout', { accessToken: token, refreshToken });
  },
};
