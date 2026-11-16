import type { LessonSummary, MathLevel, Unit } from '@/types/domain';
import { MATH_LEVELS } from '@/types/domain';
import type { StudentCourseContent } from '@/types/content';
import type { PracticeCourse } from '@/types/practice';
import type { LearningPath } from '../contracts';

// «Mi ruta» con datos reales (SCRUM-57): el nivel y el avance de Matemáticas y las sesiones de cada curso salen de la
// matrícula y de la práctica del alumno. Función pura: se prueba sin red. Lo que el backend aún no tiene (frecuencia
// y laboratorios del año) se conserva de `base`.

/** «Secundaria · Intermedio» → su nivel de Matemáticas; null si no es uno de los cuatro (p. ej. los de primaria). */
export function mathLevelOf(label: string | null): MathLevel | null {
  const name = label?.split('·').pop()?.trim();
  return MATH_LEVELS.find((level) => level === name) ?? null;
}

/** Una sesión está terminada cuando resolvió todos sus ejercicios; sin ejercicios no hay nada que marcar. */
function isDone(percent: number | null | undefined): boolean {
  return percent === 100;
}

/** La unidad que toca: la primera con una sesión por hacer, o la última si ya terminó todo. */
export function unitOf(course: StudentCourseContent, practice: PracticeCourse | undefined): Unit {
  const done = new Set((practice?.lessons ?? []).filter((item) => isDone(item.progress.percent)).map((item) => item.lessonId));
  const units = course.content.units.filter((unit) => unit.lessons.length > 0);
  const index = Math.max(0, units.findIndex((unit) => unit.lessons.some((item) => !done.has(item.id))));
  const unit = units[index];
  let currentTaken = false;
  const lessons: LessonSummary[] = (unit?.lessons ?? []).map((item) => {
    const finished = done.has(item.id);
    const status = finished ? 'done' : currentTaken ? 'open' : 'current';
    if (!finished) currentTaken = true;
    return { id: item.id, title: item.title, status, duration: `Sesión ${item.number}` };
  });
  const rest = units.slice(index + 1).map((next) => next.title);
  return {
    id: unit?.id ?? course.courseId,
    name: unit?.title ?? course.courseTitle,
    track: course.kind,
    level: mathLevelOf(course.levelLabel) ?? undefined,
    lessons,
    nextUnits: rest.length ? rest.join(' · ') : undefined,
  };
}

const EMPTY_UNIT = (track: 'math' | 'lab'): Unit => ({ id: `sin-${track}`, name: track === 'math' ? 'Matemáticas' : 'Laboratorio', track, lessons: [] });

export function buildLearningPath(base: LearningPath, courses: StudentCourseContent[], practice: PracticeCourse[]): LearningPath {
  const math = courses.find((course) => course.kind === 'math');
  const lab = courses.find((course) => course.kind === 'lab');
  const progressOf = (course: StudentCourseContent | undefined) => practice.find((item) => item.courseId === course?.courseId);
  const mathPractice = progressOf(math);
  const level = mathLevelOf(math?.levelLabel ?? null);

  return {
    ...base,
    profile: {
      ...base.profile,
      stage: math?.levelLabel?.startsWith('Primaria') ? 'Primaria' : math?.levelLabel?.startsWith('Secundaria') ? 'Secundaria' : base.profile.stage,
      math: { level, startLevel: null, progress: mathPractice?.progress.percent ?? 0 },
      lab: { ...base.profile.lab, name: lab?.courseTitle ?? base.profile.lab.name, progress: progressOf(lab)?.progress.percent ?? 0 },
    },
    mathUnit: math ? unitOf(math, mathPractice) : EMPTY_UNIT('math'),
    labUnit: lab ? { ...unitOf(lab, progressOf(lab)), area: base.labUnit.area, month: base.labUnit.month } : EMPTY_UNIT('lab'),
  };
}
