'use server';

import { ApiError } from '@/lib/http/errors';
import { cleanText, enforceLimit, limiters, runAction, type ActionResult } from '@/server/action-utils';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import type { PracticeAnswerResult } from '@/types/practice';
import { isUuid } from '@/features/admin/validation';
import { PRACTICE_ANSWER_MAX } from './answer';

// Responder un ejercicio de práctica (SCRUM-61). Devuelve solo datos: el cliente actualiza su estado sin volver a
// renderizar la página en el servidor (una petición al backend por respuesta).

export async function answerPracticeAction(exerciseId: string, answer: string): Promise<ActionResult<PracticeAnswerResult>> {
  return runAction(async () => {
    if (!isUuid(exerciseId)) throw new ApiError('validation', 'Identificador inválido', 400);
    const text = cleanText(answer, PRACTICE_ANSWER_MAX);
    if (!text) throw new ApiError('validation', 'Respuesta vacía', 400, undefined, 'Escribe o elige tu respuesta.');
    const ctx = await requireSession('student');
    enforceLimit(limiters.answers, ctx.user.id);
    return services.practice.answer(ctx, exerciseId, text);
  });
}
