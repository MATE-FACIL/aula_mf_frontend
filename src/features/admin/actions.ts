'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { enforceLimit, limiters, runAction } from '@/server/action-utils';
import { requireSession, type Session } from '@/server/auth/dal';
import { services } from '@/services';
import type { IssuedCredentials } from '@/types/admin';
import {
  isUuid,
  parseCategoryName,
  parseCourseForm,
  parseGuardianForm,
  parseStudentForm,
  type FieldErrors,
} from './validation';

// Server Actions del panel. Cada una:
//  1. verifica en el servidor que la sesión es de un administrador (las acciones aceptan POST directos),
//  2. aplica un límite de frecuencia por administrador antes de tocar la API,
//  3. valida el formulario (errores por campo sin viajar al backend),
//  4. llama a la API y con `refresh()` devuelve la página actualizada en el MISMO viaje de red.

export interface AdminActionState {
  error?: string;
  fieldErrors?: FieldErrors;
  /** Mensaje de éxito breve (se muestra como aviso). */
  message?: string;
  /** Contraseña inicial recién emitida: se muestra una sola vez. */
  credentials?: IssuedCredentials;
  /** Cambia en cada resultado para que el cliente reaccione aunque el mensaje se repita. */
  at?: number;
  /** Uso interno: adónde navegar al terminar (se resuelve en el servidor, no llega al cliente). */
  redirectTo?: string;
}

type Mutation = (ctx: Session) => Promise<AdminActionState | void>;

async function adminMutation(mutation: Mutation): Promise<AdminActionState> {
  const result = await runAction(async () => {
    const ctx = await requireSession('admin');
    enforceLimit(limiters.admin, ctx.user.id);
    return (await mutation(ctx)) ?? {};
  });
  return result.ok ? { ...result.data, at: Date.now() } : { error: result.error, at: Date.now() };
}

const invalid = (fieldErrors: FieldErrors): AdminActionState => ({ fieldErrors, error: 'Revisa los campos marcados.' });

function ids(form: FormData, ...names: string[]): string[] | null {
  const values = names.map((name) => form.get(name));
  return values.every(isUuid) ? (values as string[]) : null;
}

const BAD_REQUEST: AdminActionState = { error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };

// ─── Personas ──────────────────────────────────────────────────────────

export async function createStudentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const parsed = parseStudentForm(form);
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    const credentials = await services.admin.createStudent(ctx, parsed.value);
    refresh();
    return { credentials, message: 'Alumno creado.' };
  });
}

export async function createGuardianAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const parsed = parseGuardianForm(form);
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    const credentials = await services.admin.createGuardian(ctx, parsed.value);
    refresh();
    return { credentials, message: 'Padre o tutor creado.' };
  });
}

export async function setUserActiveAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [userId] = ids(form, 'userId') ?? [];
    if (!userId) return BAD_REQUEST;
    const active = form.get('active') === 'true';
    await services.admin.setUserActive(ctx, userId, active);
    refresh();
    return { message: active ? 'Cuenta activada.' : 'Cuenta desactivada: sus sesiones se cerraron.' };
  });
}

export async function linkStudentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const pair = ids(form, 'guardianId', 'studentId');
    if (!pair) return BAD_REQUEST;
    await services.admin.linkStudent(ctx, pair[0], pair[1]);
    refresh();
    return { message: 'Vínculo creado.' };
  });
}

export async function unlinkStudentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const pair = ids(form, 'guardianId', 'studentId');
    if (!pair) return BAD_REQUEST;
    await services.admin.unlinkStudent(ctx, pair[0], pair[1]);
    refresh();
    return { message: 'Vínculo quitado.' };
  });
}

// ─── Cursos ────────────────────────────────────────────────────────────

export async function saveCourseAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const state = await adminMutation(async (ctx) => {
    const parsed = parseCourseForm(form);
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    const courseId = form.get('courseId');
    if (courseId) {
      if (!isUuid(courseId)) return BAD_REQUEST;
      await services.admin.updateCourse(ctx, courseId, parsed.value);
      refresh();
      return { message: 'Cambios guardados.' };
    }
    const created = await services.admin.createCourse(ctx, parsed.value);
    return { redirectTo: `/admin/cursos/${created.id}?creado=1` };
  });
  if (state.redirectTo) redirect(state.redirectTo);
  return state;
}

export async function setCoursePublishedAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [courseId] = ids(form, 'courseId') ?? [];
    if (!courseId) return BAD_REQUEST;
    const published = form.get('published') === 'true';
    await services.admin.setCoursePublished(ctx, courseId, published);
    refresh();
    return { message: published ? 'Curso publicado.' : 'Curso pasado a borrador.' };
  });
}

// ─── Categorías ────────────────────────────────────────────────────────

export async function createCategoryAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const parsed = parseCategoryName(form);
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    await services.admin.createCategory(ctx, parsed.value);
    refresh();
    return { message: 'Categoría creada.' };
  });
}

export async function renameCategoryAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [categoryId] = ids(form, 'categoryId') ?? [];
    const parsed = parseCategoryName(form);
    if (!categoryId) return BAD_REQUEST;
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    await services.admin.renameCategory(ctx, categoryId, parsed.value);
    refresh();
    return { message: 'Categoría actualizada.' };
  });
}

export async function deleteCategoryAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [categoryId] = ids(form, 'categoryId') ?? [];
    if (!categoryId) return BAD_REQUEST;
    await services.admin.deleteCategory(ctx, categoryId);
    refresh();
    return { message: 'Categoría eliminada.' };
  });
}

// ─── Matrículas (activación manual) ────────────────────────────────────

const MAX_PAYMENT_NOTE = 300;

function paymentNote(form: FormData): string | undefined | null {
  const value = form.get('paymentNote');
  const note = typeof value === 'string' ? value.trim() : '';
  if (note.length > MAX_PAYMENT_NOTE) return null;
  return note || undefined;
}

export async function enrollAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const pair = ids(form, 'studentUserId', 'courseOfferingId');
    if (!pair) return invalid({ courseOfferingId: 'Elige un grupo.' });
    const note = paymentNote(form);
    if (note === null) return invalid({ paymentNote: 'Máximo 300 caracteres.' });
    await services.admin.enroll(ctx, { studentUserId: pair[0], courseOfferingId: pair[1], paymentNote: note });
    refresh();
    return { message: 'Matrícula registrada como pendiente de pago.' };
  });
}

export async function activateEnrollmentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [enrollmentId] = ids(form, 'enrollmentId') ?? [];
    if (!enrollmentId) return BAD_REQUEST;
    const note = paymentNote(form);
    if (note === null) return invalid({ paymentNote: 'Máximo 300 caracteres.' });
    await services.admin.activateEnrollment(ctx, enrollmentId, note);
    refresh();
    return { message: 'Matrícula activada.' };
  });
}

export async function withdrawEnrollmentAction(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  return adminMutation(async (ctx) => {
    const [enrollmentId] = ids(form, 'enrollmentId') ?? [];
    if (!enrollmentId) return BAD_REQUEST;
    await services.admin.withdrawEnrollment(ctx, enrollmentId);
    refresh();
    return { message: 'Matrícula retirada: el cupo quedó libre.' };
  });
}
