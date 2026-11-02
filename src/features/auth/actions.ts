'use server';

import { redirect } from 'next/navigation';
import { toUserMessage } from '@/lib/http/errors';
import { cleanText, clientIp, limiters } from '@/server/action-utils';
import { HOME_BY_ROLE, areaOf } from '@/server/auth/constants';
import { clearSession, readSessionToken, writeSession } from '@/server/auth/session';
import { services, usesPasswordLogin } from '@/services';
import type { AuthResult } from '@/services/contracts';
import type { Role } from '@/types/domain';

export interface LoginState {
  error?: string;
  /** Bloqueo temporal por demasiados intentos. */
  retryAfterSec?: number;
}

const PICTOGRAM_COUNT = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Solo se acepta volver a una ruta interna del área del rol (evita redirecciones abiertas). */
function safeNext(raw: FormDataEntryValue | null, role: Role): string {
  const home = HOME_BY_ROLE[role];
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return home;
  return areaOf(new URL(raw, 'http://aula.local').pathname) === role ? raw : home;
}

/** `kind` es el formulario usado (para el límite de intentos y el mensaje); el rol final lo decide el servidor. */
async function attemptLogin(kind: 'student' | 'family', formData: FormData, login: () => Promise<AuthResult | null>): Promise<LoginState> {
  const key = `${kind}:${await clientIp()}`;
  const limit = limiters.login.consume(key);
  if (!limit.allowed) {
    return { error: `Demasiados intentos. Por seguridad, espera ${limit.retryAfterSec} s.`, retryAfterSec: limit.retryAfterSec };
  }

  let result: AuthResult | null;
  try {
    result = await login();
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  if (!result) {
    const left = limit.remaining;
    const base = kind === 'student' ? (usesPasswordLogin ? 'Usuario o contraseña incorrectos.' : 'Usuario o figuras incorrectas.') : 'Correo o contraseña incorrectos.';
    return { error: left > 0 ? `${base} Te quedan ${left} intento${left === 1 ? '' : 's'}.` : base };
  }

  limiters.login.reset(key);
  await writeSession(result.token, result.user.role, result.expiresIn);
  redirect(safeNext(formData.get('next'), result.user.role));
}

export async function loginStudentAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = cleanText(formData.get('username'), 60);
  if (!username) return { error: 'Escribe tu usuario.' };
  if (usesPasswordLogin) {
    const password = typeof formData.get('password') === 'string' ? String(formData.get('password')).slice(0, 128) : '';
    if (!password) return { error: 'Escribe tu contraseña.' };
    return attemptLogin('student', formData, () => services.auth.loginStudent({ username, password }));
  }
  const pictograms = cleanText(formData.get('pictograms'), 64).split(',').filter(Boolean);
  if (pictograms.length !== PICTOGRAM_COUNT) return { error: 'Elige tus 3 figuras secretas.' };
  return attemptLogin('student', formData, () => services.auth.loginStudent({ username, pictograms }));
}

export async function loginFamilyAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = cleanText(formData.get('email'), 120);
  const password = typeof formData.get('password') === 'string' ? String(formData.get('password')).slice(0, 128) : '';
  if (!EMAIL_RE.test(email)) return { error: 'Escribe un correo válido.' };
  if (!password) return { error: 'Escribe tu contraseña.' };
  return attemptLogin('family', formData, () => services.auth.loginFamily({ email, password }));
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await services.auth.logout(token).catch(() => undefined); // cerrar sesión no debe fallar por la API
  await clearSession();
}
