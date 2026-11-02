import 'server-only';
import type { RequestContext, Services } from './contracts';
import { httpAdmin } from './http/admin';
import { backendAuth } from './http/auth';
import { demoUserFor, mockServices } from './mock';

// Modo HÍBRIDO para probar el aula contra el backend .NET real:
//  - Autenticación (login, sesión, logout) y panel de administración → API real
//    (API_BASE_URL, ej.: http://localhost:5087/api/v1).
//  - Lo que el alumno y la familia ven (lecciones, tareas, tutor…) → datos mock, porque el backend
//    aún no tiene esos módulos.
//
// El rol de la sesión lo decide el backend (`/auth/me` → roles), no el formulario de ingreso.

/** Los servicios mock esperan al usuario de demostración: se les entrega el del rol de la sesión real. */
function withDemoUser<T extends object>(service: T): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, method] of Object.entries(service)) {
    wrapped[name] = (ctx: RequestContext, ...args: unknown[]) =>
      (method as (...a: unknown[]) => unknown)({ ...ctx, user: demoUserFor(ctx.user.role) }, ...args);
  }
  return wrapped as T;
}

export const hybridServices: Services = {
  auth: backendAuth,
  admin: httpAdmin,
  students: withDemoUser(mockServices.students),
  notifications: withDemoUser(mockServices.notifications),
  lessons: withDemoUser(mockServices.lessons),
  tutor: withDemoUser(mockServices.tutor),
  assessments: withDemoUser(mockServices.assessments),
  schedule: withDemoUser(mockServices.schedule),
  family: withDemoUser(mockServices.family),
};
