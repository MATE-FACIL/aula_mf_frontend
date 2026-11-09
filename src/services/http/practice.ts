import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { PracticeCourse, PracticeLessonProgress, PracticeProgress } from '@/types/practice';
import type { PracticeService, RequestContext } from '../contracts';
import { enc, nullOn404 } from './shared';

// Práctica real del alumno (SCRUM-59/60/61) contra la API .NET.

interface StudentCourseDto {
  courseId: string;
  courseTitle: string;
  offeringId: string;
  offeringName: string;
  level: { stageLabel: string; levelLabel: string } | null;
}

interface CourseProgressDto {
  courseId: string;
  progress: PracticeProgress;
  lessons: PracticeLessonProgress[];
}

/** El mismo curso puede aparecer por dos grupos (raro, pero posible): se muestra una vez. */
export function uniqueCourses<T extends { courseId: string }>(courses: T[]): T[] {
  const seen = new Set<string>();
  return courses.filter((course) => !seen.has(course.courseId) && seen.add(course.courseId));
}

export function toPracticeCourse(course: StudentCourseDto, progress: CourseProgressDto | null): PracticeCourse {
  return {
    courseId: course.courseId,
    courseTitle: course.courseTitle,
    offeringName: course.offeringName,
    levelLabel: course.level ? `${course.level.stageLabel} · ${course.level.levelLabel}` : null,
    progress: progress?.progress ?? { solved: 0, total: 0, percent: null },
    lessons: progress?.lessons ?? [],
  };
}

/**
 * Cursos del alumno con su avance: 1 petición por la lista y, EN PARALELO, 1 por curso (un alumno tiene
 * 1–3 cursos activos: Matemáticas y el laboratorio del mes). Una sola espera en total.
 */
async function listCourses(ctx: RequestContext): Promise<PracticeCourse[]> {
  const courses = uniqueCourses(await apiRequest<StudentCourseDto[]>('/students/me/courses', { token: ctx.token }));
  const progress = await Promise.all(courses.map((course) =>
    nullOn404(apiRequest<CourseProgressDto>(`/students/me/courses/${enc(course.courseId)}/progress`, { token: ctx.token }))));
  return courses.map((course, index) => toPracticeCourse(course, progress[index]));
}

export const httpPractice: PracticeService = {
  listCourses,
  getLesson: ({ token }, lessonId) => nullOn404(apiRequest(`/students/me/lessons/${enc(lessonId)}/practice`, { token })),
  answer: ({ token }, exerciseId, answer) =>
    apiRequest(`/students/me/exercises/${enc(exerciseId)}/answers`, { method: 'POST', token, body: { answer } }),
};
