import 'server-only';
import { randomUUID } from 'node:crypto';
import { MAX_EXERCISES } from '@/features/practice/editor-rules';
import { ApiError } from '@/lib/http/errors';
import type { ExerciseAdmin, ExerciseInput } from '@/types/practice';

// Ejercicios de práctica de cada sesión EN MEMORIA (modo demo), con las mismas reglas que el backend (SCRUM-59): una
// lista ordenada por sesión; al guardar, los ejercicios que faltan se archivan (aquí: se quitan) y los que traen `id`
// conservan el suyo.

const globalForExercises = globalThis as unknown as { __mfMockLessonExercises?: Map<string, ExerciseAdmin[]> };
const store = () => (globalForExercises.__mfMockLessonExercises ??= new Map());

export const exercisesOf = (lessonId: string): ExerciseAdmin[] => store().get(lessonId) ?? [];

export function replaceExercises(lessonId: string, inputs: ExerciseInput[]): ExerciseAdmin[] {
  if (inputs.length > MAX_EXERCISES) {
    throw new ApiError('validation', 'Ejercicios', 400, undefined, `Una lección admite como máximo ${MAX_EXERCISES} ejercicios.`);
  }
  const current = new Map(exercisesOf(lessonId).map((item) => [item.id, item]));
  const ids = inputs.map((input) => input.id).filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) throw new ApiError('validation', 'Ejercicios', 400, undefined, 'Cada ejercicio puede aparecer una sola vez.');
  if (ids.some((id) => !current.has(id))) throw new ApiError('validation', 'Ejercicios', 400, undefined, 'Uno de los ejercicios no pertenece a esta lección.');
  const next = inputs.map((input, index): ExerciseAdmin => ({
    id: input.id ?? randomUUID(), number: index + 1, kind: input.kind, prompt: input.prompt,
    options: input.options ?? [], correctOption: input.correctOption, correctNumber: input.correctNumber,
    tolerance: input.tolerance ?? 0, explanation: input.explanation,
  }));
  store().set(lessonId, next);
  return next;
}
