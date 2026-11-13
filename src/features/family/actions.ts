'use server';

import { refresh } from 'next/cache';
import { ApiError } from '@/lib/http/errors';
import { cleanText, enforceLimit, limiters, runAction, type ActionResult } from '@/server/action-utils';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import type { FamilyConsent } from '@/types/consent';
import type { ChatMessage } from '@/types/domain';
import { parseAcceptance } from './consent';

const MAX_MESSAGE_LENGTH = 1000;

export async function sendMessageAction(text: string): Promise<ActionResult<ChatMessage>> {
  return runAction(async () => {
    const ctx = await requireSession('family');
    const clean = cleanText(text, MAX_MESSAGE_LENGTH);
    if (!clean) throw new ApiError('validation', 'Mensaje vacío', 400);
    enforceLimit(limiters.messages, ctx.user.id);
    return services.family.sendMessage(ctx, clean);
  });
}

/**
 * El padre acepta los términos y la privacidad por sus hijos (SCRUM-38). El backend comprueba que sean hijos suyos
 * y que el texto sea el vigente; aquí solo se revisa el formato. Todos los hijos o ninguno.
 */
export async function acceptConsentAction(version: string, studentUserIds: string[]): Promise<ActionResult<FamilyConsent>> {
  return runAction(async () => {
    const parsed = parseAcceptance(version, studentUserIds);
    if (!parsed.ok) throw new ApiError('validation', 'Solicitud inválida', 400, undefined, parsed.error);
    const ctx = await requireSession('family');
    enforceLimit(limiters.submissions, ctx.user.id);
    const result = await services.family.acceptConsent(ctx, parsed.version, parsed.studentUserIds);
    // El aviso del panel de la familia sale del servidor: se vuelve a leer.
    refresh();
    return result;
  });
}
