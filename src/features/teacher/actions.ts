'use server';

import { refresh } from 'next/cache';
import type { AdminActionState } from '@/features/admin/actions';
import { isUuid, parseAttendanceForm } from '@/features/admin/validation';
import { enforceLimit, limiters, runAction } from '@/server/action-utils';
import { requireSession, type Session } from '@/server/auth/dal';
import { services } from '@/services';

// Asistencia que toma el profesor en sus clases (SCRUM-69/70). El backend vuelve a comprobar que la clase sea de un
// grupo suyo: cambiar el id en el formulario no da acceso a otra clase.

const BAD_REQUEST: AdminActionState = { error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };

async function teacherMutation(mutation: (ctx: Session) => Promise<AdminActionState>): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const ctx = await requireSession('teacher');
    enforceLimit(limiters.teacher, ctx.user.id);
    return mutation(ctx);
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}

const students = (n: number) => `${n} ${n === 1 ? 'alumno' : 'alumnos'}`;

export async function markTeacherAttendanceAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return teacherMutation(async (ctx) => {
    const sessionId = form.get('sessionId');
    if (!isUuid(sessionId)) return BAD_REQUEST;
    const parsed = parseAttendanceForm(form);
    if (!parsed.ok) return { error: Object.values(parsed.fieldErrors)[0] };
    await services.teacher.markAttendance(ctx, sessionId, parsed.value);
    refresh();
    return { message: `Asistencia guardada (${students(parsed.value.length)}).` };
  });
}

/** «Asistencia en un clic»: quienes no tienen marca quedan presentes; lo ya marcado no cambia. */
export async function markRemainingPresentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return teacherMutation(async (ctx) => {
    const sessionId = form.get('sessionId');
    if (!isUuid(sessionId)) return BAD_REQUEST;
    const view = await services.teacher.markRemainingPresent(ctx, sessionId);
    refresh();
    const present = view.students.filter((s) => s.enrolled && s.status === 'present').length;
    return { message: `Listo: los que faltaban quedaron presentes (${students(present)} ${present === 1 ? 'presente' : 'presentes'} en total).` };
  });
}
