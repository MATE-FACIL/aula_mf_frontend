import type { NewGuardianInput, NewStudentInput, SaveCourseInput, SaveOfferingInput } from '@/types/admin';

// Validación de formularios del panel ANTES de llamar a la API (mismos límites que el backend .NET):
// evita viajes inútiles y devuelve errores por campo para mostrarlos junto a cada input.
// El backend vuelve a validar todo: esto es comodidad, no seguridad.

export type FieldErrors = Partial<Record<string, string>>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCUMENT_RE = /^[A-Za-z0-9-]{4,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

const optional = (value: string) => value || undefined;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

function personNames(form: FormData, errors: FieldErrors) {
  const givenNames = text(form, 'givenNames', 150);
  const firstSurname = text(form, 'firstSurname', 100);
  const secondSurname = optional(text(form, 'secondSurname', 100));
  if (!givenNames) errors.givenNames = 'Escribe los nombres.';
  if (!firstSurname) errors.firstSurname = 'Escribe el primer apellido.';
  return { givenNames, firstSurname, secondSurname };
}

export function parseStudentForm(form: FormData): Parsed<NewStudentInput> {
  const errors: FieldErrors = {};
  const names = personNames(form, errors);
  const email = optional(text(form, 'email', 254));
  const documentType = text(form, 'documentType', 32) || 'DNI';
  const documentNumber = text(form, 'documentNumber', 50);
  const guardian = text(form, 'guardianUserId', 36);

  if (email && !EMAIL_RE.test(email)) errors.email = 'El correo no es válido.';
  if (!documentNumber) errors.documentNumber = 'El documento es obligatorio: con él se arma el usuario.';
  else if (!DOCUMENT_RE.test(documentNumber)) errors.documentNumber = 'Usa solo letras, números o guiones (4 a 20).';
  if (guardian && !isUuid(guardian)) errors.guardianUserId = 'El padre o tutor elegido no es válido.';

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { ...names, email, documentType, documentNumber, guardianUserId: guardian || undefined } };
}

export function parseGuardianForm(form: FormData): Parsed<NewGuardianInput> {
  const errors: FieldErrors = {};
  const names = personNames(form, errors);
  const email = text(form, 'email', 254);
  const documentNumber = optional(text(form, 'documentNumber', 50));
  const documentType = documentNumber ? text(form, 'documentType', 32) || 'DNI' : undefined;

  if (!email) errors.email = 'El correo es obligatorio: es su usuario para ingresar.';
  else if (!EMAIL_RE.test(email)) errors.email = 'El correo no es válido.';
  if (documentNumber && !DOCUMENT_RE.test(documentNumber)) errors.documentNumber = 'Usa solo letras, números o guiones (4 a 20).';

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { ...names, email, documentType, documentNumber } };
}

const COURSE_TEXT_FIELDS = ['shortDescription', 'fullDescription', 'objectives', 'syllabus', 'targetAudience', 'prerequisites'] as const;
const COURSE_TEXT_MAX = 8000;

export function parseCourseForm(form: FormData): Parsed<SaveCourseInput> {
  const errors: FieldErrors = {};
  const title = text(form, 'title', 200);
  const category = text(form, 'categoryId', 36);
  const rawDuration = text(form, 'sessionDurationMinutes', 4);
  const duration = rawDuration ? Number(rawDuration) : null;
  if (!title) errors.title = 'El curso necesita un título.';
  if (category && !isUuid(category)) errors.categoryId = 'La categoría elegida no es válida.';
  if (duration !== null && (!Number.isInteger(duration) || duration < 30 || duration > 240)) {
    errors.sessionDurationMinutes = 'Entre 30 y 240 minutos (primaria 60, secundaria 90).';
  }
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  const fields = Object.fromEntries(COURSE_TEXT_FIELDS.map((name) => [name, text(form, name, COURSE_TEXT_MAX) || null])) as Record<
    (typeof COURSE_TEXT_FIELDS)[number],
    string | null
  >;
  return { ok: true, value: { title, categoryId: category || null, ...fields, sessionDurationMinutes: duration } };
}

export function parseCategoryName(form: FormData): Parsed<string> {
  const name = text(form, 'name', 150);
  return name ? { ok: true, value: name } : { ok: false, fieldErrors: { name: 'Escribe un nombre.' } };
}

// ─── Portada del curso (mismos límites que Courses:Cover en el backend) ───

export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function checkCover(file: { size: number; type: string } | null): string | null {
  if (!file || file.size === 0) return 'Elige una imagen.';
  if (!COVER_TYPES.includes(file.type as (typeof COVER_TYPES)[number])) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size > COVER_MAX_BYTES) return 'La imagen pesa más de 5 MB.';
  return null;
}

// ─── Grupos (ediciones) ────────────────────────────────────────────────

export const OFFERING_CURRENCIES = ['PEN', 'USD'] as const;
const MAX_OFFERING_SESSIONS = 60;
const MAX_LINK_LENGTH = 2048;

type SessionPlan = SaveOfferingInput['sessions'][number];

/** Enlace de clase opcional: vacío → null; solo http(s). */
export function parseLink(value: unknown): { ok: true; value: string | null } | { ok: false } {
  const link = typeof value === 'string' ? value.trim() : '';
  if (!link) return { ok: true, value: null };
  if (link.length > MAX_LINK_LENGTH) return { ok: false };
  try {
    const url = new URL(link);
    return url.protocol === 'https:' || url.protocol === 'http:' ? { ok: true, value: link } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Las sesiones llegan como JSON desde el generador del navegador: se revisan una por una. */
function parseSessions(raw: unknown): SessionPlan[] | null {
  if (typeof raw !== 'string' || raw.length > 100_000) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_OFFERING_SESSIONS) return null;
  const sessions: SessionPlan[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, startsAt, endsAt, virtualLink } = item as Record<string, unknown>;
    const starts = typeof startsAt === 'string' ? Date.parse(startsAt) : NaN;
    const ends = typeof endsAt === 'string' ? Date.parse(endsAt) : NaN;
    const link = parseLink(virtualLink);
    if (!(starts < ends) || !link.ok || (id !== null && id !== undefined && !isUuid(id))) return null;
    sessions.push({ id: (id as string | null | undefined) ?? null, startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString(), virtualLink: link.value });
  }
  return sessions;
}

export function parseOfferingForm(form: FormData): Parsed<SaveOfferingInput> {
  const errors: FieldErrors = {};
  const name = text(form, 'name', 200);
  const capacity = Number(text(form, 'maximumCapacity', 4));
  const price = Number(text(form, 'basePrice', 12));
  const currency = text(form, 'currencyCode', 3);
  const sessions = parseSessions(form.get('sessions'));

  if (!name) errors.name = 'El grupo necesita un nombre.';
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) errors.maximumCapacity = 'Cupo entre 1 y 500 alumnos.';
  if (!Number.isFinite(price) || price < 0) errors.basePrice = 'Precio no válido.';
  if (!OFFERING_CURRENCIES.includes(currency as (typeof OFFERING_CURRENCIES)[number])) errors.currencyCode = 'Moneda no válida.';
  if (!sessions) errors.sessions = 'Genera el horario del grupo (al menos una clase).';

  if (Object.keys(errors).length || !sessions) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { name, maximumCapacity: capacity, basePrice: Math.round(price * 100) / 100, currencyCode: currency, plannedSessionCount: sessions.length, sessions },
  };
}
