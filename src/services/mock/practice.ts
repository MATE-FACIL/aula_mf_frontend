import 'server-only';
import { ApiError } from '@/lib/http/errors';
import type { ExerciseKind, LessonPractice, PracticeAnswerResult, PracticeCourse, PracticeProgress } from '@/types/practice';
import type { PracticeService, RequestContext } from '../contracts';

// Práctica EN MEMORIA (modo mock), con las mismas reglas que el backend: corrige en el servidor, guarda cada
// intento, la explicación llega solo después de responder y el avance cuenta ejercicios resueltos al menos una vez.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
const MAX_ATTEMPTS = 50;

interface MockExercise {
  id: string;
  kind: ExerciseKind;
  prompt: string;
  options?: string[];
  correctOption?: number;
  correctNumber?: number;
  tolerance?: number;
  explanation: string;
}

interface MockLesson {
  id: string;
  title: string;
  exercises: MockExercise[];
}

export const PRACTICE_COURSE = {
  courseId: 'a1b2c3d4-0000-4000-8000-000000000001',
  courseTitle: 'Matemáticas · Secundaria · Intermedio',
  offeringName: 'Grupo A · Lun y Mié 5 p. m.',
  levelLabel: 'Secundaria · Intermedio',
};

export const PRACTICE_LESSONS: MockLesson[] = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000101',
    title: 'Sumar fracciones',
    exercises: [
      {
        id: 'a1b2c3d4-0000-4000-8000-000000001001', kind: 'multiple_choice', prompt: '¿Cuánto es 1/2 + 1/4?',
        options: ['3/4', '2/6', '1/6'], correctOption: 0,
        explanation: 'Busca un denominador común: 1/2 = 2/4, y 2/4 + 1/4 = 3/4.',
      },
      {
        id: 'a1b2c3d4-0000-4000-8000-000000001002', kind: 'numeric', prompt: '¿Cuánto es 1/4 + 1/4 en decimal?',
        correctNumber: 0.5, tolerance: 0, explanation: '1/4 + 1/4 = 2/4 = 1/2, que en decimal es 0,5.',
      },
      {
        id: 'a1b2c3d4-0000-4000-8000-000000001003', kind: 'multiple_choice', prompt: '¿Qué fracción es equivalente a 2/3?',
        options: ['3/4', '4/6', '2/6'], correctOption: 1,
        explanation: 'Multiplica arriba y abajo por el mismo número: 2·2 / 3·2 = 4/6.',
      },
    ],
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000102',
    title: 'Fracciones y decimales',
    exercises: [
      {
        id: 'a1b2c3d4-0000-4000-8000-000000001004', kind: 'numeric', prompt: '¿Cuánto es 7 ÷ 2?',
        correctNumber: 3.5, tolerance: 0, explanation: '7 ÷ 2 = 3 y sobra 1; ese 1 entre 2 es 0,5. Total: 3,5.',
      },
      {
        id: 'a1b2c3d4-0000-4000-8000-000000001005', kind: 'numeric', prompt: 'Escribe 3/4 como decimal.',
        correctNumber: 0.75, tolerance: 0, explanation: '3 ÷ 4 = 0,75.',
      },
    ],
  },
];

interface MockAttempt {
  exerciseId: string;
  correct: boolean;
}

const globalForPractice = globalThis as unknown as { __mfMockPractice?: Map<string, MockAttempt[]> };
/** studentId → intentos. Vive en memoria como el resto del modo demo. */
const attempts = (): Map<string, MockAttempt[]> => (globalForPractice.__mfMockPractice ??= new Map());
const own = (studentId: string) => attempts().get(studentId) ?? [];

const progressOf = (solved: number, total: number): PracticeProgress =>
  ({ solved, total, percent: total === 0 ? null : Math.round((solved * 100) / total) });

function lessonProgress(studentId: string, lesson: MockLesson): PracticeProgress {
  const solved = new Set(own(studentId).filter((a) => a.correct).map((a) => a.exerciseId));
  return progressOf(lesson.exercises.filter((e) => solved.has(e.id)).length, lesson.exercises.length);
}

/** Avance de un alumno en todo el curso de práctica (lo usa el panel del profesor en modo demo). */
export function practiceProgressOf(studentId: string): PracticeProgress {
  const each = PRACTICE_LESSONS.map((lesson) => lessonProgress(studentId, lesson));
  return progressOf(each.reduce((sum, p) => sum + p.solved, 0), each.reduce((sum, p) => sum + p.total, 0));
}

/** Como `Exercise.Check` del backend: null si la respuesta no se entiende (no cuenta como intento). */
export function checkPracticeAnswer(exercise: Pick<MockExercise, 'kind' | 'options' | 'correctOption' | 'correctNumber' | 'tolerance'>, answer: string): boolean | null {
  const raw = answer.trim();
  if (exercise.kind === 'multiple_choice') {
    if (!/^\d{1,2}$/.test(raw)) return null;
    const option = Number(raw);
    return option < (exercise.options?.length ?? 0) ? option === exercise.correctOption : null;
  }
  if (!/^[+-]?\d+([.,]\d+)?$/.test(raw)) return null;
  return Math.abs(Number(raw.replace(',', '.')) - (exercise.correctNumber ?? Number.NaN)) <= (exercise.tolerance ?? 0) + 1e-9;
}

function requireStudent(ctx: RequestContext) {
  if (ctx.user.role !== 'student') throw new ApiError('forbidden', 'Se requiere el rol student', 403);
}

function findExercise(exerciseId: string) {
  for (const lesson of PRACTICE_LESSONS) {
    const exercise = lesson.exercises.find((e) => e.id === exerciseId);
    if (exercise) return { lesson, exercise };
  }
  throw new ApiError('not_found', 'Ejercicio', 404, undefined, 'Esta práctica no está disponible para ti.');
}

export const mockPractice: PracticeService = {
  async listCourses(ctx): Promise<PracticeCourse[]> {
    requireStudent(ctx);
    await delay();
    const lessons = PRACTICE_LESSONS.map((lesson) => ({ lessonId: lesson.id, title: lesson.title, progress: lessonProgress(ctx.user.id, lesson) }));
    return [{ ...PRACTICE_COURSE, progress: practiceProgressOf(ctx.user.id), lessons }];
  },

  async getLesson(ctx, lessonId): Promise<LessonPractice | null> {
    requireStudent(ctx);
    await delay();
    const lesson = PRACTICE_LESSONS.find((l) => l.id === lessonId);
    if (!lesson) return null;
    const mine = own(ctx.user.id);
    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      progress: lessonProgress(ctx.user.id, lesson),
      exercises: lesson.exercises.map((e, index) => ({
        id: e.id, number: index + 1, kind: e.kind, prompt: e.prompt, options: e.options ?? [],
        attempts: mine.filter((a) => a.exerciseId === e.id).length,
        solved: mine.some((a) => a.exerciseId === e.id && a.correct),
      })),
    };
  },

  async answer(ctx, exerciseId, answer): Promise<PracticeAnswerResult> {
    requireStudent(ctx);
    await delay();
    const { lesson, exercise } = findExercise(exerciseId);
    const correct = checkPracticeAnswer(exercise, answer);
    if (correct === null) {
      const detail = exercise.kind === 'multiple_choice' ? 'Elige una de las opciones.' : 'Escribe un número, por ejemplo 3,5.';
      throw new ApiError('validation', 'Respuesta ilegible', 400, undefined, detail);
    }
    const previous = own(ctx.user.id).filter((a) => a.exerciseId === exerciseId).length;
    if (previous >= MAX_ATTEMPTS) {
      throw new ApiError('conflict', 'Demasiados intentos', 409, undefined, 'Ya respondiste este ejercicio muchas veces. Pide ayuda a tu profesor.');
    }
    attempts().set(ctx.user.id, [...own(ctx.user.id), { exerciseId, correct }]);
    return { isCorrect: correct, explanation: exercise.explanation, lessonProgress: lessonProgress(ctx.user.id, lesson), attempts: previous + 1 };
  },
};
