import type { LessonPayload, UploadKind } from '@/types/content';

// Reglas puras de la carga de contenido (SCRUM-71), sin red: se prueban con Vitest. Son las mismas que valida el
// backend (límites y tipos de archivo de SCRUM-55 y SCRUM-58): aquí solo sirven para avisar antes de gastar una
// petición o de subir un archivo grande que el backend iba a rechazar.

export const UNIT_TITLE_MAX = 150;
export const LESSON_TITLE_MAX = 200;
export const LESSON_SUMMARY_MAX = 2000;
export const MATERIAL_TITLE_MAX = 150;
export const LINK_MAX = 2048;
export const MAX_UNITS = 30;
export const MAX_LESSONS = 200;
export const MAX_MATERIALS = 20;

export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const OFFICE = {
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const MATERIAL_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', OFFICE.word, OFFICE.powerpoint, OFFICE.excel];
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/** Algunos sistemas no informan el tipo de un .docx o un .pptx: se deduce de la extensión. */
const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  docx: OFFICE.word, pptx: OFFICE.powerpoint, xlsx: OFFICE.excel, mp4: 'video/mp4', webm: 'video/webm',
};

export function contentTypeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  return BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

/** Valor para `accept` del selector de archivos. */
export const acceptFor = (kind: UploadKind) => (kind === 'video' ? VIDEO_TYPES : MATERIAL_TYPES).join(',');

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** null si el archivo se puede subir; si no, el mensaje para el administrador (igual que el del backend). */
export function fileProblem(kind: UploadKind, file: { name: string; type: string; size: number }): string | null {
  const [types, max, label] = kind === 'video'
    ? [VIDEO_TYPES, VIDEO_MAX_BYTES, 'MP4 o WebM'] as const
    : [MATERIAL_TYPES, MATERIAL_MAX_BYTES, 'PDF, imagen (PNG, JPG, WebP) o documento de Office'] as const;
  const type = contentTypeOf(file);
  if (!type || !types.includes(type)) return `Tipo de archivo no permitido: usa ${label}.`;
  if (file.size <= 0) return 'El archivo está vacío.';
  if (file.size > max) return `El archivo supera el máximo de ${max / (1024 * 1024)} MB.`;
  return null;
}

/** Un enlace https:// válido. Vacío es válido (sin enlace). Un http:// no, porque el navegador lo bloquea en el aula. */
export function parseHttpsLink(value: unknown): { ok: true; value: string | null } | { ok: false } {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { ok: true, value: null };
  if (text.length > LINK_MAX) return { ok: false };
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname.includes('.') ? { ok: true, value: text } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** El orden nuevo al subir (-1) o bajar (1) un elemento; null si ya está en el borde o no existe. */
export function moveInOrder(ids: string[], id: string, direction: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type FieldErrors = Partial<Record<string, string>>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };

export function parseUnitTitle(value: unknown): Parsed<string> {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title) return { ok: false, fieldErrors: { title: 'Escribe el nombre de la unidad.' } };
  if (title.length > UNIT_TITLE_MAX) return { ok: false, fieldErrors: { title: `El nombre admite como máximo ${UNIT_TITLE_MAX} caracteres.` } };
  return { ok: true, value: title };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/**
 * Formulario de una sesión. El video es un enlace (`videoUrl`) o un archivo ya subido (`videoFileId`); cada material,
 * una fila de `materialTitle`, `materialUrl` y `materialFileId` en paralelo. Las filas totalmente vacías se ignoran.
 */
export function parseLessonForm(form: FormData): Parsed<LessonPayload & { unitId: string }> {
  const errors: FieldErrors = {};

  const unitId = text(form, 'unitId');
  if (!UUID_RE.test(unitId)) errors.unitId = 'Elige la unidad.';

  const title = text(form, 'title');
  if (!title) errors.title = 'Escribe el título de la sesión.';
  else if (title.length > LESSON_TITLE_MAX) errors.title = `El título admite como máximo ${LESSON_TITLE_MAX} caracteres.`;

  const summary = text(form, 'summary');
  if (summary.length > LESSON_SUMMARY_MAX) errors.summary = `El resumen admite como máximo ${LESSON_SUMMARY_MAX} caracteres.`;

  const link = parseHttpsLink(form.get('videoUrl'));
  const videoFileId = text(form, 'videoFileId');
  if (!link.ok) errors.video = 'El video debe ser un enlace https:// válido.';
  else if (link.value && videoFileId) errors.video = 'El video es un enlace o un archivo, no los dos.';
  else if (videoFileId && !UUID_RE.test(videoFileId)) errors.video = 'El archivo del video no es válido. Súbelo otra vez.';

  const titles = form.getAll('materialTitle').map(String);
  const urls = form.getAll('materialUrl').map(String);
  const fileIds = form.getAll('materialFileId').map(String);
  const materials: LessonPayload['materials'] = [];
  for (let row = 0; row < titles.length; row++) {
    const materialTitle = titles[row].trim();
    const materialUrl = (urls[row] ?? '').trim();
    const materialFileId = (fileIds[row] ?? '').trim();
    if (!materialTitle && !materialUrl && !materialFileId) continue;
    const place = `Material ${materials.length + 1}`;
    const url = parseHttpsLink(materialUrl);
    if (!materialTitle) errors.materials ??= `${place}: escribe su título.`;
    else if (materialTitle.length > MATERIAL_TITLE_MAX) errors.materials ??= `${place}: el título admite como máximo ${MATERIAL_TITLE_MAX} caracteres.`;
    else if (!url.ok) errors.materials ??= `${place}: el enlace debe ser https:// válido.`;
    else if (url.value && materialFileId) errors.materials ??= `${place}: es un enlace o un archivo, no los dos.`;
    else if (!url.value && !materialFileId) errors.materials ??= `${place}: pon un enlace o sube un archivo.`;
    else if (materialFileId && !UUID_RE.test(materialFileId)) errors.materials ??= `${place}: el archivo no es válido. Súbelo otra vez.`;
    materials.push({ title: materialTitle, url: url.ok ? url.value : null, fileId: materialFileId || null });
  }
  if (materials.length > MAX_MATERIALS) errors.materials = `Una sesión admite como máximo ${MAX_MATERIALS} materiales.`;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: {
      unitId, title, summary: summary || null,
      videoUrl: link.ok ? link.value : null, videoFileId: videoFileId || null,
      isPublished: form.get('isPublished') === 'on', materials,
    },
  };
}
