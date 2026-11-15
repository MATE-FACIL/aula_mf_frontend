import type { ContentLesson, StudentCourseContent } from '@/types/content';

// Reglas puras de la pantalla de lecciones del alumno (SCRUM-56), sin red: se prueban con Vitest.

/** El video se reproduce en la página solo si es un archivo propio o un enlace directo a MP4/WebM; el resto (YouTube, Vimeo…) se abre aparte. */
export function isPlayableVideo(lesson: Pick<ContentLesson, 'videoUrl' | 'videoFileId' | 'videoContentType'>): boolean {
  if (!lesson.videoUrl) return false;
  if (lesson.videoFileId || lesson.videoContentType?.startsWith('video/')) return true;
  try {
    return /\.(mp4|webm)$/i.test(new URL(lesson.videoUrl).pathname);
  } catch {
    return false;
  }
}

/** La primera sesión del curso, o null si no hay. */
export function firstLesson(course: StudentCourseContent): ContentLesson | null {
  return course.content.units.flatMap((unit) => unit.lessons)[0] ?? null;
}

/** Curso que se muestra al entrar: el de la ruta pedida (`?ruta=lab`) si existe; si no, Matemáticas; si no, el primero. */
export function initialCourse(courses: StudentCourseContent[], ruta: string | undefined): StudentCourseContent | null {
  const wanted = ruta === 'lab' ? 'lab' : 'math';
  return courses.find((course) => course.kind === wanted) ?? courses[0] ?? null;
}

/** Sesión elegida: la pedida si es de ese curso; si no, la primera. */
export function pickLesson(course: StudentCourseContent, lessonId: string | null): ContentLesson | null {
  const all = course.content.units.flatMap((unit) => unit.lessons);
  return all.find((item) => item.id === lessonId) ?? all[0] ?? null;
}
