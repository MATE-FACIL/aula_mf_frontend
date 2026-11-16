import { describe, expect, it } from 'vitest';
import type { StudentCourseContent } from '@/types/content';
import type { PracticeCourse } from '@/types/practice';
import type { LearningPath } from '../contracts';
import { buildLearningPath, mathLevelOf, unitOf } from './learning-path';

const lesson = (id: string, unitId: string, number: number) => ({ id, unitId, number, title: `Sesión ${id}`, summary: null, videoUrl: null, videoFileId: null, videoContentType: null, isPublished: true, materials: [] });
const course = (kind: 'math' | 'lab', levelLabel: string | null): StudentCourseContent => ({
  courseId: `c-${kind}`, courseTitle: `Curso ${kind}`, offeringName: 'G', kind, levelLabel,
  content: {
    courseId: `c-${kind}`, courseTitle: `Curso ${kind}`,
    units: [
      { id: 'u1', title: 'Fracciones', position: 1, lessons: [lesson('a', 'u1', 1), lesson('b', 'u1', 2)] },
      { id: 'u2', title: 'Decimales', position: 2, lessons: [lesson('c', 'u2', 3)] },
      { id: 'u3', title: 'Vacía', position: 3, lessons: [] },
    ],
  },
});
const practice = (courseId: string, done: string[], total = 2): PracticeCourse => ({
  courseId, courseTitle: '', offeringName: '', levelLabel: null,
  progress: { solved: done.length, total, percent: Math.round((done.length * 100) / total) },
  lessons: ['a', 'b', 'c'].map((id) => ({ lessonId: id, title: id, progress: done.includes(id) ? { solved: 2, total: 2, percent: 100 } : { solved: 0, total: 2, percent: 0 } })),
});

describe('mathLevelOf', () => {
  it('reconoce los cuatro niveles y devuelve null en los demás', () => {
    expect(mathLevelOf('Secundaria · Intermedio')).toBe('Intermedio');
    expect(mathLevelOf('Primaria · Nivel 2')).toBeNull();
    expect(mathLevelOf(null)).toBeNull();
  });
});

describe('unitOf', () => {
  it('marca terminadas las sesiones con la práctica resuelta, la siguiente como actual y las demás como abiertas', () => {
    const unit = unitOf(course('math', null), practice('c-math', ['a']));
    expect(unit.name).toBe('Fracciones');
    expect(unit.lessons.map((l) => l.status)).toEqual(['done', 'current']);
    expect(unit.nextUnits).toBe('Decimales');
  });

  it('pasa a la unidad siguiente cuando termina la anterior, sin contar las unidades vacías', () => {
    const unit = unitOf(course('math', null), practice('c-math', ['a', 'b']));
    expect(unit.name).toBe('Decimales');
    expect(unit.lessons.map((l) => l.status)).toEqual(['current']);
    expect(unit.nextUnits).toBeUndefined();
  });

  it('sin práctica la primera sesión es la actual y el resto está abierto', () => {
    expect(unitOf(course('math', null), undefined).lessons.map((l) => l.status)).toEqual(['current', 'open']);
  });

  it('con todo terminado muestra la última unidad completa', () => {
    const unit = unitOf(course('math', null), practice('c-math', ['a', 'b', 'c']));
    expect(unit.name).toBe('Fracciones');
    expect(unit.lessons.every((l) => l.status === 'done')).toBe(true);
  });
});

describe('buildLearningPath', () => {
  const base = {
    profile: { stage: 'Secundaria', math: { level: 'Avanzado', startLevel: 'Básico', progress: 99 }, lab: { name: 'Demo', area: 'Programación', month: 'Octubre', progress: 50 } },
    mathUnit: { id: 'demo' }, labUnit: { id: 'demo-lab', area: 'Programación', month: 'Octubre' }, labs: [{ month: 'x' }], frequency: [{ course: 'x' }],
  } as unknown as LearningPath;

  it('toma nivel, avance y unidades de los datos reales y conserva lo que el backend aún no tiene', () => {
    const path = buildLearningPath(base, [course('math', 'Primaria · Básico'), course('lab', null)], [practice('c-math', ['a'], 4)]);
    expect(path.profile.stage).toBe('Primaria');
    expect(path.profile.math).toEqual({ level: 'Básico', startLevel: null, progress: 25 });
    expect(path.mathUnit.lessons).toHaveLength(2);
    expect(path.labUnit.track).toBe('lab');
    expect(path.labs).toBe(base.labs);
    expect(path.frequency).toBe(base.frequency);
  });

  it('sin cursos no inventa lecciones', () => {
    const path = buildLearningPath(base, [], []);
    expect(path.mathUnit.lessons).toEqual([]);
    expect(path.labUnit.lessons).toEqual([]);
    expect(path.profile.math.level).toBeNull();
  });
});
