'use server';

import { refresh } from 'next/cache';
import type { AdminActionState } from '@/features/admin/actions';
import { isUuid } from '@/features/admin/validation';
import { enforceLimit, limiters, runAction } from '@/server/action-utils';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import { parseInputs } from './editor-rules';

// Guardar los ejercicios de una sesión (SCRUM-59 desde el panel). Lo usan el administrador y el profesor: cada uno con
// su sesión y su límite de frecuencia. El profesor solo puede editar los cursos que enseña, y eso lo decide el
// backend (responde 404 en otro curso); aquí se valida la forma del envío antes de llamarlo.

const BAD_REQUEST: AdminActionState = { error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };

export async function saveExercisesAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const scope = form.get('scope');
    if (scope !== 'admin' && scope !== 'teacher') return BAD_REQUEST;
    const courseId = form.get('courseId');
    const lessonId = form.get('lessonId');
    const exercises = parseInputs(form.get('exercises'));
    if (!isUuid(courseId) || !isUuid(lessonId) || !exercises) return BAD_REQUEST;

    const ctx = await requireSession(scope);
    enforceLimit(scope === 'admin' ? limiters.admin : limiters.teacher, ctx.user.id);
    const saved = scope === 'admin'
      ? await services.admin.replaceLessonExercises(ctx, courseId, lessonId, exercises)
      : await services.teacher.replaceLessonExercises(ctx, courseId, lessonId, exercises);
    refresh();
    return { message: saved.length === 0 ? 'Se quitaron todos los ejercicios de la sesión.' : `Guardado: ${saved.length} ${saved.length === 1 ? 'ejercicio' : 'ejercicios'}.` } satisfies AdminActionState;
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}
