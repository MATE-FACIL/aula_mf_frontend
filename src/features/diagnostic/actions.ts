'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminActionState } from '@/features/admin/actions';
import { isUuid } from '@/features/admin/validation';
import { PRACTICE_ANSWER_MAX } from '@/features/practice/answer';
import { ApiError } from '@/lib/http/errors';
import { cleanText, enforceLimit, limiters, runAction, type ActionResult } from '@/server/action-utils';
import { LOGIN_PATH } from '@/server/auth/constants';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import type { DiagnosticAnswerResult, DiagnosticStage } from '@/types/diagnostic';
import { isLevelCode } from './rules';

// Diagnóstico de entrada (SCRUM-48/49). El backend decide todo (de quién es el diagnóstico, si la respuesta se puede
// leer, cuándo termina y qué nivel sugiere); aquí solo se validan formatos para no gastar peticiones.

/** Empieza (o retoma) el diagnóstico de la etapa y lleva a su pantalla. */
export async function startDiagnosticAction(form: FormData): Promise<void> {
  const stage = form.get('stage');
  if (stage !== 'primary' && stage !== 'secondary') redirect('/diagnostico');
  const ctx = await requireSession('student');
  let attemptId: string | null = null;
  try {
    attemptId = (await services.diagnostic.start(ctx, stage as DiagnosticStage)).attemptId;
  } catch (error) {
    // Sin preguntas cargadas (409) u otro error de negocio: se avisa en la misma pantalla.
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 'unauthorized') redirect(`${LOGIN_PATH}?expirada=1`);
  }
  redirect(attemptId ? `/diagnostico/${attemptId}` : '/diagnostico?error=no-disponible');
}

/** Una respuesta, o «No lo sé» (`skip`). Devuelve solo el avance: no dice si acertó. */
export async function answerDiagnosticAction(attemptId: string, questionId: string, answer: string, skip: boolean)
  : Promise<ActionResult<DiagnosticAnswerResult>> {
  return runAction(async () => {
    if (!isUuid(attemptId) || !isUuid(questionId)) throw new ApiError('validation', 'Identificador inválido', 400);
    const text = skip ? null : cleanText(answer, PRACTICE_ANSWER_MAX);
    if (!skip && !text) throw new ApiError('validation', 'Respuesta vacía', 400, undefined, 'Escribe o elige tu respuesta.');
    const ctx = await requireSession('student');
    enforceLimit(limiters.answers, ctx.user.id);
    return services.diagnostic.answer(ctx, attemptId, questionId, text, skip);
  });
}

/** El profesor (o el administrador) confirma el nivel sugerido o elige otro. */
export async function confirmDiagnosticLevelAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const attemptId = form.get('attemptId');
    const level = form.get('level');
    if (!isUuid(attemptId)) return { error: 'La solicitud no es válida. Recarga la página.' };
    if (!isLevelCode(level)) return { error: 'Elige un nivel.' };
    const ctx = await requireSession();
    if (ctx.user.role !== 'teacher' && ctx.user.role !== 'admin') return { error: 'No tienes permiso para confirmar niveles.' };
    enforceLimit(ctx.user.role === 'admin' ? limiters.admin : limiters.teacher, ctx.user.id);
    const review = await services.diagnostic.confirm(ctx, attemptId, level);
    refresh();
    return { message: `Nivel confirmado: ${review.summary.confirmed?.label}.` };
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}
