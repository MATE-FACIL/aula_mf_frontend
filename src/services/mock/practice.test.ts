import { describe, expect, it } from 'vitest';
import type { RequestContext } from '../contracts';
import { checkPracticeAnswer, mockPractice, PRACTICE_LESSONS } from './practice';

// La demo debe comportarse como el backend: corrige en el servidor, la explicación llega solo tras responder y el
// avance cuenta ejercicios resueltos al menos una vez.

const ctx = (id: string, role: 'student' | 'family' = 'student'): RequestContext =>
  ({ token: 't', user: { id, role, displayName: 'X', timeZone: 'America/Lima' } });

describe('checkPracticeAnswer', () => {
  const choice = { kind: 'multiple_choice' as const, options: ['a', 'b'], correctOption: 1 };
  const numeric = { kind: 'numeric' as const, correctNumber: 3.5, tolerance: 0 };
  it('corrige opción múltiple por índice y numéricas con coma o punto', () => {
    expect(checkPracticeAnswer(choice, '1')).toBe(true);
    expect(checkPracticeAnswer(choice, '0')).toBe(false);
    expect(checkPracticeAnswer(numeric, '3,5')).toBe(true);
    expect(checkPracticeAnswer(numeric, '3.4')).toBe(false);
  });
  it('una respuesta ilegible no es ni buena ni mala', () => {
    expect(checkPracticeAnswer(choice, '7')).toBeNull();
    expect(checkPracticeAnswer(numeric, 'tres y medio')).toBeNull();
  });
});

describe('mockPractice', () => {
  const [lesson] = PRACTICE_LESSONS;
  const [first] = lesson.exercises;

  it('el alumno no recibe la respuesta ni la explicación antes de responder', async () => {
    const view = await mockPractice.getLesson(ctx('alumno-1'), lesson.id);
    const raw = JSON.stringify(view);
    expect(view?.exercises).toHaveLength(lesson.exercises.length);
    expect(raw).not.toMatch(/correctOption|correctNumber|explanation/);
    expect(raw).not.toContain(first.explanation);
  });

  it('responde, explica y recalcula el avance; un error y luego el acierto cuentan un resuelto', async () => {
    const who = ctx('alumno-2');
    const wrong = await mockPractice.answer(who, first.id, '2');
    expect(wrong).toMatchObject({ isCorrect: false, explanation: first.explanation, attempts: 1 });
    expect(wrong.lessonProgress.solved).toBe(0);
    const right = await mockPractice.answer(who, first.id, '0');
    expect(right).toMatchObject({ isCorrect: true, attempts: 2 });
    expect(right.lessonProgress).toEqual({ solved: 1, total: 3, percent: 33 });
    const [course] = await mockPractice.listCourses(who);
    expect(course.lessons[0].progress.solved).toBe(1);
  });

  it('una respuesta ilegible es 400 y no se guarda', async () => {
    const who = ctx('alumno-3');
    await expect(mockPractice.answer(who, lesson.exercises[1].id, 'medio')).rejects.toMatchObject({ code: 'validation' });
    expect((await mockPractice.getLesson(who, lesson.id))?.exercises[1].attempts).toBe(0);
  });

  it('solo el alumno practica', async () => {
    await expect(mockPractice.listCourses(ctx('fam', 'family'))).rejects.toMatchObject({ code: 'forbidden' });
  });
});
