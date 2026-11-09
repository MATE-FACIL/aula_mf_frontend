import { describe, expect, it } from 'vitest';
import { roleFromBackend } from './auth';
import { toPracticeCourse, uniqueCourses } from './practice';

const course = {
  courseId: 'c1', courseTitle: 'Matemáticas · Primaria · Básico', offeringId: 'o1', offeringName: 'Grupo A',
  level: { stageLabel: 'Primaria', levelLabel: 'Básico' },
};

describe('toPracticeCourse', () => {
  it('une el curso con su avance y arma el rótulo del nivel', () => {
    const progress = { courseId: 'c1', progress: { solved: 2, total: 3, percent: 67 }, lessons: [{ lessonId: 'l1', title: 'Sumar', progress: { solved: 2, total: 3, percent: 67 } }] };
    expect(toPracticeCourse(course, progress)).toEqual({
      courseId: 'c1', courseTitle: 'Matemáticas · Primaria · Básico', offeringName: 'Grupo A', levelLabel: 'Primaria · Básico',
      progress: progress.progress, lessons: progress.lessons,
    });
  });

  it('un curso que no es nivel, o sin avance disponible, sigue apareciendo vacío', () => {
    const result = toPracticeCourse({ ...course, level: null }, null);
    expect(result.levelLabel).toBeNull();
    expect(result.progress).toEqual({ solved: 0, total: 0, percent: null });
    expect(result.lessons).toEqual([]);
  });
});

describe('uniqueCourses', () => {
  it('el mismo curso por dos grupos se muestra una sola vez (y no se pide dos veces)', () => {
    expect(uniqueCourses([course, { ...course, offeringId: 'o2' }, { ...course, courseId: 'c2' }]).map((c) => c.courseId)).toEqual(['c1', 'c2']);
  });
});

describe('roleFromBackend', () => {
  it('el profesor (instructor) entra a su área', () => {
    expect(roleFromBackend(['instructor'])).toBe('teacher');
  });
  it('gana el rol de más alcance', () => {
    expect(roleFromBackend(['instructor', 'administrator'])).toBe('admin');
    expect(roleFromBackend(['guardian', 'instructor'])).toBe('teacher');
    expect(roleFromBackend(['student', 'guardian'])).toBe('family');
    expect(roleFromBackend(['student'])).toBe('student');
    expect(roleFromBackend([])).toBeNull();
  });
});
