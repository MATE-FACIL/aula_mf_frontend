import 'server-only';
import { ApiError } from '@/lib/http/errors';
import type { ContentLesson, CourseContent, StudentCourseContent } from '@/types/content';
import type { StudentContentService } from '../contracts';
import { PRACTICE_COURSE, PRACTICE_LESSONS } from './practice';

// Lecciones del alumno EN MEMORIA (modo demo): las sesiones de Matemáticas son las mismas de la práctica (así el
// botón «Practicar» lleva a ejercicios reales de la demo) y un laboratorio de ejemplo. Sin almacenamiento: solo enlaces.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

const LAB_COURSE_ID = 'a1b2c3d4-0000-4000-8000-000000000002';

const lesson = (unitId: string, number: number, id: string, title: string, extra: Partial<ContentLesson> = {}): ContentLesson => ({
  id, unitId, number, title, summary: null, videoUrl: null, videoFileId: null, videoContentType: null, isPublished: true, materials: [], ...extra,
});

function mathContent(): CourseContent {
  const unitId = 'a1b2c3d4-0000-4000-8000-000000000201';
  return {
    courseId: PRACTICE_COURSE.courseId,
    courseTitle: PRACTICE_COURSE.courseTitle,
    units: [{
      id: unitId, title: 'Fracciones', position: 1,
      lessons: PRACTICE_LESSONS.map((item, index) => lesson(unitId, index + 1, item.id, item.title, {
        summary: index === 0 ? 'Suma fracciones con distinto denominador buscando el común.' : null,
        videoUrl: 'https://www.youtube.com/watch?v=demo-fracciones',
        materials: [{ id: `${item.id.slice(0, -3)}9${index}1`, title: 'Guía de práctica', url: 'https://ejemplo.com/guia-fracciones.pdf', fileId: null, contentType: null, size: null }],
      })),
    }],
  };
}

function labContent(): CourseContent {
  const unitId = 'a1b2c3d4-0000-4000-8000-000000000301';
  return {
    courseId: LAB_COURSE_ID,
    courseTitle: 'Laboratorio · IA Creator Studio',
    units: [{
      id: unitId, title: 'Semana 1', position: 1,
      lessons: [lesson(unitId, 1, 'a1b2c3d4-0000-4000-8000-000000000302', 'Crea tu primer personaje', {
        summary: 'Reto de la semana: diseña un personaje y descríbelo en tres frases.',
        videoUrl: 'https://www.youtube.com/watch?v=demo-lab',
      })],
    }],
  };
}

export const mockStudentContent: StudentContentService = {
  async listCourses(ctx): Promise<StudentCourseContent[]> {
    if (ctx.user.role !== 'student') throw new ApiError('forbidden', 'Se requiere el rol student', 403);
    await delay();
    return [
      { courseId: PRACTICE_COURSE.courseId, courseTitle: PRACTICE_COURSE.courseTitle, offeringName: PRACTICE_COURSE.offeringName,
        kind: 'math', levelLabel: PRACTICE_COURSE.levelLabel, content: mathContent() },
      { courseId: LAB_COURSE_ID, courseTitle: 'Laboratorio · IA Creator Studio', offeringName: 'Lab de noviembre',
        kind: 'lab', levelLabel: null, content: labContent() },
    ];
  },
};
