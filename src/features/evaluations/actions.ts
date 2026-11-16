'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminActionState } from '@/features/admin/actions';
import { isUuid } from '@/features/admin/validation';
import { enforceLimit, limiters, runAction } from '@/server/action-utils';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import { parsePayload } from './rules';

// Crear, editar y borrar las evaluaciones de un grupo (SCRUM-62/63). El profesor solo toca las de sus grupos, y eso lo
// decide el backend (404 en otro grupo); aquí se valida la forma del envío antes de llamarlo. El backend vuelve a validar
// todo, y es quien impide cambiar las preguntas cuando ya hay alumnos que empezaron.

const BAD_REQUEST: AdminActionState = { error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };

async function teacherMutation(mutation: (ctx: Awaited<ReturnType<typeof requireSession>>) => Promise<AdminActionState>): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const ctx = await requireSession('teacher');
    enforceLimit(limiters.teacher, ctx.user.id);
    return mutation(ctx);
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}

/** Crea (con `offeringId`) o actualiza (con `evaluationId`) la evaluación; al crear lleva a su pantalla. */
export async function saveEvaluationAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const payload = parsePayload(form.get('payload'));
  const offeringId = form.get('offeringId');
  const evaluationId = form.get('evaluationId');
  if (!payload || (offeringId ? !isUuid(offeringId) : !isUuid(evaluationId))) return { ...BAD_REQUEST, at: Date.now() };

  const state = await teacherMutation(async (ctx) => {
    if (offeringId) {
      const created = await services.teacher.createEvaluation(ctx, String(offeringId), payload);
      return { redirectTo: `/profesor/evaluaciones/${created.evaluation.id}?creada=1` };
    }
    await services.teacher.updateEvaluation(ctx, String(evaluationId), payload);
    refresh();
    return { message: 'Evaluación guardada.' };
  });
  if (state.redirectTo) redirect(state.redirectTo);
  return state;
}

export async function deleteEvaluationAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const evaluationId = form.get('evaluationId');
  const offeringId = form.get('offeringId');
  if (!isUuid(evaluationId) || !isUuid(offeringId)) return { ...BAD_REQUEST, at: Date.now() };

  const state = await teacherMutation(async (ctx) => {
    await services.teacher.deleteEvaluation(ctx, String(evaluationId));
    return { redirectTo: `/profesor/grupos/${offeringId}?borrada=1` };
  });
  if (state.redirectTo) redirect(state.redirectTo);
  return state;
}
