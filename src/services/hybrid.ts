import 'server-only';
import type { RequestContext, Services } from './contracts';
import { httpAdmin } from './http/admin';
import { httpConsent } from './http/consent';
import { backendAuth } from './http/auth';
import { fetchLiveSchedule } from './http/classes';
import { fetchChildren } from './http/family';
import { httpDiagnostic } from './http/diagnostic';
import { httpPractice } from './http/practice';
import { httpTeacher } from './http/teacher';
import { fetchStudentAttendance } from './http/student-attendance';
import { upcoming } from './http/live-schedule';
import { demoUserFor, mockServices } from './mock';

// Modo HÍBRIDO para probar el aula contra el backend .NET real:
//  - Autenticación (login, sesión, logout) y panel de administración → API real
//    (API_BASE_URL, ej.: http://localhost:5087/api/v1).
//  - Clases en vivo, calendario y asistencia del alumno, e hijos de la familia con su asistencia → API real
//    (SCRUM-50/51/52, 53 y 67).
//  - Práctica del alumno (SCRUM-59/60/61), panel del profesor (SCRUM-69/70) y diagnóstico de entrada
//    (SCRUM-48/49) → API real.
//  - El resto de lo que ven el alumno y la familia (lecciones, tareas, tutor…) → datos mock, porque el
//    backend aún no tiene esos módulos.
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

const demoStudents = withDemoUser(mockServices.students);
const demoSchedule = withDemoUser(mockServices.schedule);

export const hybridServices: Services = {
  auth: backendAuth,
  admin: httpAdmin,
  practice: httpPractice,
  teacher: httpTeacher,
  diagnostic: httpDiagnostic,
  students: {
    ...demoStudents,
    // Mock y clases reales en paralelo: una sola espera.
    async getDashboard(ctx) {
      const [dashboard, live] = await Promise.all([demoStudents.getDashboard(ctx), fetchLiveSchedule(ctx)]);
      return { ...dashboard, classes: upcoming(live.classes, Date.now()) };
    },
  },
  notifications: withDemoUser(mockServices.notifications),
  lessons: withDemoUser(mockServices.lessons),
  tutor: withDemoUser(mockServices.tutor),
  assessments: withDemoUser(mockServices.assessments),
  schedule: {
    ...demoSchedule,
    // Clases y asistencia reales (SCRUM-50/53) junto a las tareas de ejemplo: tres fuentes, una sola espera.
    async getSchedule(ctx) {
      const [demo, live, attendance] = await Promise.all([demoSchedule.getSchedule(ctx), fetchLiveSchedule(ctx), fetchStudentAttendance(ctx)]);
      return { ...demo, ...live, attendance: attendance.records, attendanceSummary: attendance.summary };
    },
  },
  // Hijos reales del padre (sin datos de ejemplo mezclados: serían de otro niño).
  // El consentimiento también es real (SCRUM-38): se acepta por los hijos reales de la sesión.
  family: { ...withDemoUser(mockServices.family), getChildren: fetchChildren, ...httpConsent },
};
