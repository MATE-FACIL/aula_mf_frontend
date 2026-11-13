import 'server-only';
import { randomUUID } from 'node:crypto';
import { fileProblem, MAX_LESSONS, MAX_MATERIALS, MAX_UNITS, parseHttpsLink } from '@/features/content/rules';
import { ApiError } from '@/lib/http/errors';
import type { ContentLesson, ContentUnit, CourseContent, LessonPayload, UploadGrant, UploadKind } from '@/types/content';
import type { AdminService, RequestContext } from '../contracts';

// Contenido de los cursos EN MEMORIA (modo demo), con las mismas reglas que el backend (SCRUM-55): unidades y
// sesiones en orden, borradores, enlaces https y límites. En la demo no hay almacenamiento: los archivos no se
// pueden subir, solo poner enlaces.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

interface MockLesson {
  id: string;
  title: string;
  summary: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  materials: { id: string; title: string; url: string }[];
}

interface MockUnit {
  id: string;
  title: string;
  lessons: MockLesson[];
}

const globalForContent = globalThis as unknown as { __mfMockContent?: Map<string, MockUnit[]> };
const contents = () => (globalForContent.__mfMockContent ??= new Map());

const notFound = (detail: string) => new ApiError('not_found', detail, 404, undefined, detail);
const invalid = (detail: string) => new ApiError('validation', detail, 400, undefined, detail);
const conflict = (detail: string) => new ApiError('conflict', detail, 409, undefined, detail);

function seed(): MockUnit[] {
  const lesson = (title: string, isPublished: boolean, videoUrl: string | null, materials: MockLesson['materials'] = []): MockLesson =>
    ({ id: randomUUID(), title, summary: null, videoUrl, isPublished, materials });
  return [
    {
      id: randomUUID(), title: 'Fracciones', lessons: [
        lesson('Sumar fracciones', true, 'https://www.youtube.com/watch?v=demo-sumar', [{ id: randomUUID(), title: 'Guía de práctica', url: 'https://ejemplo.com/guia-fracciones.pdf' }]),
        lesson('Restar fracciones', true, null),
      ],
    },
    { id: randomUUID(), title: 'Decimales', lessons: [lesson('Fracciones y decimales', false, null)] },
  ];
}

function viewOf(courseId: string, courseTitle: string, units: MockUnit[]): CourseContent {
  let number = 0;
  return {
    courseId,
    courseTitle,
    units: units.map((unit, index): ContentUnit => ({
      id: unit.id, title: unit.title, position: index + 1,
      lessons: unit.lessons.map((item): ContentLesson => ({
        id: item.id, unitId: unit.id, number: ++number, title: item.title, summary: item.summary, videoUrl: item.videoUrl,
        videoFileId: null, videoContentType: null, isPublished: item.isPublished,
        materials: item.materials.map((m) => ({ id: m.id, title: m.title, url: m.url, fileId: null, contentType: null, size: null })),
      })),
    })),
  };
}

export type MockContent = Pick<AdminService, 'getCourseContent' | 'addUnit' | 'renameUnit' | 'deleteUnit' | 'reorderUnits' |
  'addLesson' | 'updateLesson' | 'deleteLesson' | 'reorderLessons' | 'grantLessonUpload'>;

/** `titleOf`: el título del curso, o null si no existe. `guard`: exige la sesión de un administrador. */
export function createMockContent({ titleOf, guard }: { titleOf: (courseId: string) => string | null; guard: (ctx: RequestContext) => void }): MockContent {
  const unitsOf = (courseId: string): MockUnit[] => {
    if (titleOf(courseId) === null) throw notFound('No encontramos ese curso.');
    let units = contents().get(courseId);
    if (!units) {
      // La demo trae contenido de ejemplo solo en el curso de Secundaria Intermedio.
      units = titleOf(courseId)!.includes('Secundaria Intermedio') ? seed() : [];
      contents().set(courseId, units);
    }
    return units;
  };
  const unitOf = (courseId: string, unitId: string) => {
    const unit = unitsOf(courseId).find((item) => item.id === unitId);
    if (!unit) throw notFound('No encontramos esa unidad.');
    return unit;
  };
  const find = (courseId: string, lessonId: string) => {
    for (const unit of unitsOf(courseId)) {
      const item = unit.lessons.find((candidate) => candidate.id === lessonId);
      if (item) return { unit, item };
    }
    throw notFound('No encontramos esa sesión en el curso.');
  };
  const content = (courseId: string) => viewOf(courseId, titleOf(courseId) ?? '', unitsOf(courseId));
  const lessonView = (courseId: string, lessonId: string) =>
    content(courseId).units.flatMap((unit) => unit.lessons).find((item) => item.id === lessonId)!;
  const unitView = (courseId: string, unitId: string) => content(courseId).units.find((unit) => unit.id === unitId)!;

  /** Aplica el contenido de una sesión, validando como el backend. */
  function apply(target: MockLesson, input: LessonPayload) {
    if (input.videoFileId || input.materials.some((m) => m.fileId)) {
      throw invalid('En la demo no hay almacenamiento de archivos: usa enlaces.');
    }
    if (!input.title.trim()) throw invalid('El título es obligatorio.');
    if (!parseHttpsLink(input.videoUrl).ok) throw invalid('El video debe ser un enlace https:// válido.');
    if (input.materials.length > MAX_MATERIALS) throw invalid(`Una lección admite como máximo ${MAX_MATERIALS} materiales.`);
    if (input.materials.some((m) => !m.title.trim() || !m.url || !parseHttpsLink(m.url).ok)) {
      throw invalid('Cada material necesita un título y un enlace https:// válido.');
    }
    Object.assign(target, {
      title: input.title.trim(), summary: input.summary?.trim() || null, videoUrl: input.videoUrl?.trim() || null, isPublished: input.isPublished,
      materials: input.materials.map((m) => ({ id: randomUUID(), title: m.title.trim(), url: m.url!.trim() })),
    });
  }

  const sameSet = (current: string[], ids: string[]) => current.length === ids.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));

  return {
    async getCourseContent(ctx, courseId) {
      guard(ctx);
      await delay();
      return titleOf(courseId) === null ? null : content(courseId);
    },

    async addUnit(ctx, courseId, title) {
      guard(ctx);
      await delay();
      const units = unitsOf(courseId);
      if (units.length >= MAX_UNITS) throw invalid(`Un curso admite como máximo ${MAX_UNITS} unidades.`);
      const unit: MockUnit = { id: randomUUID(), title: title.trim(), lessons: [] };
      units.push(unit);
      return unitView(courseId, unit.id);
    },

    async renameUnit(ctx, courseId, unitId, title) {
      guard(ctx);
      await delay();
      unitOf(courseId, unitId).title = title.trim();
      return unitView(courseId, unitId);
    },

    async deleteUnit(ctx, courseId, unitId) {
      guard(ctx);
      await delay();
      const unit = unitOf(courseId, unitId);
      if (unit.lessons.length > 0) throw conflict('La unidad tiene sesiones: bórralas o muévelas a otra unidad antes de borrarla.');
      contents().set(courseId, unitsOf(courseId).filter((item) => item.id !== unitId));
    },

    async reorderUnits(ctx, courseId, ids) {
      guard(ctx);
      await delay();
      const units = unitsOf(courseId);
      if (!sameSet(units.map((unit) => unit.id), ids)) throw invalid('El orden debe incluir cada unidad una sola vez.');
      contents().set(courseId, ids.map((id) => units.find((unit) => unit.id === id)!));
      return content(courseId);
    },

    async addLesson(ctx, courseId, unitId, input) {
      guard(ctx);
      await delay();
      const unit = unitOf(courseId, unitId);
      if (unitsOf(courseId).reduce((sum, item) => sum + item.lessons.length, 0) >= MAX_LESSONS) {
        throw invalid(`Un curso admite como máximo ${MAX_LESSONS} lecciones.`);
      }
      const created: MockLesson = { id: randomUUID(), title: '', summary: null, videoUrl: null, isPublished: false, materials: [] };
      apply(created, input);
      unit.lessons.push(created);
      return lessonView(courseId, created.id);
    },

    async updateLesson(ctx, courseId, lessonId, unitId, input) {
      guard(ctx);
      await delay();
      const { unit, item } = find(courseId, lessonId);
      const destination = unitId === unit.id ? unit : unitOf(courseId, unitId);
      apply(item, input);
      if (destination !== unit) {
        unit.lessons = unit.lessons.filter((candidate) => candidate.id !== lessonId);
        destination.lessons.push(item);
      }
      return lessonView(courseId, lessonId);
    },

    async deleteLesson(ctx, courseId, lessonId) {
      guard(ctx);
      await delay();
      const { unit } = find(courseId, lessonId);
      unit.lessons = unit.lessons.filter((candidate) => candidate.id !== lessonId);
    },

    async reorderLessons(ctx, courseId, unitId, ids) {
      guard(ctx);
      await delay();
      const unit = unitOf(courseId, unitId);
      if (!sameSet(unit.lessons.map((item) => item.id), ids)) throw invalid('El orden debe incluir cada lección de la unidad una sola vez.');
      unit.lessons = ids.map((id) => unit.lessons.find((item) => item.id === id)!);
      return content(courseId);
    },

    async grantLessonUpload(ctx, courseId, lessonId, { kind, contentType, size }): Promise<UploadGrant> {
      guard(ctx);
      await delay();
      find(courseId, lessonId);
      const problem = fileProblem(kind as UploadKind, { name: '', type: contentType, size });
      if (problem) throw invalid(problem);
      throw invalid('En la demo no hay almacenamiento de archivos: usa enlaces.');
    },
  };
}
