import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { CourseContent, StudentCourseContent } from '@/types/content';
import type { StudentContentService } from '../contracts';
import { enc, nullOn404 } from './shared';
import { uniqueCourses } from './practice';

// Lecciones reales del alumno (SCRUM-56): `GET /students/me/courses` y, EN PARALELO, las sesiones publicadas de
// cada curso. Un alumno tiene 1–3 cursos activos (Matemáticas y el laboratorio del mes): una sola espera.

interface StudentCourseDto {
  courseId: string;
  courseTitle: string;
  offeringId: string;
  offeringName: string;
  level: { stageLabel: string; levelLabel: string } | null;
}

export function toStudentCourse(course: StudentCourseDto, content: CourseContent): StudentCourseContent {
  return {
    courseId: course.courseId,
    courseTitle: course.courseTitle,
    offeringName: course.offeringName,
    kind: course.level ? 'math' : 'lab',
    levelLabel: course.level ? `${course.level.stageLabel} · ${course.level.levelLabel}` : null,
    content,
  };
}

export const httpStudentContent: StudentContentService = {
  async listCourses({ token }) {
    const courses = uniqueCourses(await apiRequest<StudentCourseDto[]>('/students/me/courses', { token }));
    const contents = await Promise.all(courses.map((course) =>
      nullOn404(apiRequest<CourseContent>(`/students/me/courses/${enc(course.courseId)}/lessons`, { token }))));
    // Un curso sin acceso (404) o sin sesiones publicadas no aparece: no hay nada que estudiar.
    return courses.flatMap((course, index) => {
      const content = contents[index];
      return content && content.units.some((unit) => unit.lessons.length > 0) ? [toStudentCourse(course, content)] : [];
    });
  },
};
