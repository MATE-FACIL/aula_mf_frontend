'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AdminActionState } from '@/features/admin/actions';
import { isUuid } from '@/features/admin/validation';
import { ApiError } from '@/lib/http/errors';
import { enforceLimit, limiters, runAction, type ActionResult } from '@/server/action-utils';
import { requireSession, type Session } from '@/server/auth/dal';
import { services } from '@/services';
import type { UploadGrant, UploadKind } from '@/types/content';
import { fileProblem, MAX_LESSONS, MAX_UNITS, parseLessonForm, parseUnitTitle, type FieldErrors } from './rules';

// Server Actions de la carga de contenido (SCRUM-71). Cada una verifica en el servidor que la sesión es de un
// administrador, aplica el límite de frecuencia y valida el formulario antes de llamar a la API. El backend vuelve a
// validar todo y es quien decide (límites, enlaces https, archivos y de qué curso es cada cosa).

const BAD_REQUEST: AdminActionState = { error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };
const invalid = (fieldErrors: FieldErrors): AdminActionState => ({ fieldErrors, error: 'Revisa los campos marcados.' });

async function contentMutation(mutation: (ctx: Session) => Promise<AdminActionState | void>): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const ctx = await requireSession('admin');
    enforceLimit(limiters.admin, ctx.user.id);
    return (await mutation(ctx)) ?? {};
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}

const uuid = (form: FormData, name: string) => {
  const value = form.get(name);
  return isUuid(value) ? value : null;
};

/** `ids`: los identificadores en el orden nuevo, separados por coma (todos, una vez cada uno). */
function orderOf(form: FormData, max: number): string[] | null {
  const ids = String(form.get('ids') ?? '').split(',').filter(Boolean);
  return ids.length > 0 && ids.length <= max && ids.every(isUuid) ? ids : null;
}

// ─── Unidades ──────────────────────────────────────────────────────────

export async function addUnitAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    if (!courseId) return BAD_REQUEST;
    const title = parseUnitTitle(form.get('title'));
    if (!title.ok) return invalid(title.fieldErrors);
    await services.admin.addUnit(ctx, courseId, title.value);
    refresh();
    return { message: 'Unidad creada.' };
  });
}

export async function renameUnitAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    const unitId = uuid(form, 'unitId');
    if (!courseId || !unitId) return BAD_REQUEST;
    const title = parseUnitTitle(form.get('title'));
    if (!title.ok) return invalid(title.fieldErrors);
    await services.admin.renameUnit(ctx, courseId, unitId, title.value);
    refresh();
    return { message: 'Nombre guardado.' };
  });
}

export async function deleteUnitAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    const unitId = uuid(form, 'unitId');
    if (!courseId || !unitId) return BAD_REQUEST;
    await services.admin.deleteUnit(ctx, courseId, unitId);
    refresh();
    return { message: 'Unidad borrada.' };
  });
}

export async function moveUnitAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    const ids = orderOf(form, MAX_UNITS);
    if (!courseId || !ids) return BAD_REQUEST;
    await services.admin.reorderUnits(ctx, courseId, ids);
    refresh();
    return {};
  });
}

// ─── Sesiones ──────────────────────────────────────────────────────────

const lessonPath = (courseId: string, lessonId: string) => `/admin/cursos/${courseId}/contenido/sesiones/${lessonId}`;

/** Crea (sin `lessonId`) o guarda una sesión. Al crear, lleva a su pantalla: ahí ya se pueden subir archivos. */
export async function saveLessonAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const state = await contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    if (!courseId) return BAD_REQUEST;
    const parsed = parseLessonForm(form);
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    const { unitId, ...payload } = parsed.value;
    const lessonId = form.get('lessonId');
    if (lessonId) {
      if (!isUuid(lessonId)) return BAD_REQUEST;
      await services.admin.updateLesson(ctx, courseId, lessonId, unitId, payload);
      refresh();
      return { message: 'Sesión guardada.' };
    }
    const created = await services.admin.addLesson(ctx, courseId, unitId, payload);
    return { redirectTo: `${lessonPath(courseId, created.id)}?creada=1` };
  });
  if (state.redirectTo) redirect(state.redirectTo);
  return state;
}

export async function deleteLessonAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const state = await contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    const lessonId = uuid(form, 'lessonId');
    if (!courseId || !lessonId) return BAD_REQUEST;
    await services.admin.deleteLesson(ctx, courseId, lessonId);
    return { redirectTo: `/admin/cursos/${courseId}/contenido?borrada=1` };
  });
  if (state.redirectTo) redirect(state.redirectTo);
  return state;
}

export async function moveLessonAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return contentMutation(async (ctx) => {
    const courseId = uuid(form, 'courseId');
    const unitId = uuid(form, 'unitId');
    const ids = orderOf(form, MAX_LESSONS);
    if (!courseId || !unitId || !ids) return BAD_REQUEST;
    await services.admin.reorderLessons(ctx, courseId, unitId, ids);
    refresh();
    return {};
  });
}

// ─── Subida de archivos ────────────────────────────────────────────────

/**
 * Pide el permiso para subir UN archivo directo al almacenamiento: el archivo nunca pasa por el aula ni por la API.
 * Se revisa el tipo y el tamaño aquí para no pedir un permiso que el backend iba a negar.
 */
export async function grantLessonUploadAction(
  courseId: string,
  lessonId: string,
  kind: UploadKind,
  contentType: string,
  size: number,
): Promise<ActionResult<UploadGrant>> {
  return runAction(async () => {
    if (!isUuid(courseId) || !isUuid(lessonId) || (kind !== 'video' && kind !== 'material') || !Number.isFinite(size)) {
      throw new ApiError('validation', 'Solicitud inválida', 400, undefined, BAD_REQUEST.error);
    }
    const problem = fileProblem(kind, { name: '', type: contentType, size });
    if (problem) throw new ApiError('validation', 'Archivo no permitido', 400, undefined, problem);
    const ctx = await requireSession('admin');
    enforceLimit(limiters.admin, ctx.user.id);
    try {
      return await services.admin.grantLessonUpload(ctx, courseId, lessonId, { kind, contentType, size });
    } catch (error) {
      // Sin almacenamiento en este ambiente (503): se explica qué hacer en vez de «no disponible».
      if (error instanceof ApiError && error.code === 'unavailable') {
        throw new ApiError('validation', 'Sin almacenamiento', 400, undefined, 'La subida de archivos no está activa en este ambiente. Por ahora usa un enlace.');
      }
      throw error;
    }
  });
}
