import type { PracticeExerciseView, PracticeProgress } from '@/types/practice';

// Reglas puras de la pantalla de práctica (sin red): se prueban con Vitest.

/** Igual que el backend (`Exercise.MaxAnswerLength`). */
export const PRACTICE_ANSWER_MAX = 50;

/** Formato que acepta el backend para una respuesta numérica: 3, -2, 3,5 o 3.5 (sin separador de miles). */
const NUMBER_RE = /^[+-]?\d+([.,]\d+)?$/;

/**
 * Revisa el formato ANTES de enviar: así un «tres» no gasta una petición. Devuelve el mensaje para el alumno, o
 * null si se puede enviar. La corrección (si está bien o mal) la hace siempre el servidor.
 */
export function answerFormatError(exercise: Pick<PracticeExerciseView, 'kind' | 'options'>, raw: string): string | null {
  const answer = raw.trim();
  if (exercise.kind === 'multiple_choice') {
    const option = Number(answer);
    return answer !== '' && Number.isInteger(option) && option >= 0 && option < exercise.options.length ? null : 'Elige una de las opciones.';
  }
  if (!answer) return 'Escribe tu respuesta.';
  if (answer.length > PRACTICE_ANSWER_MAX || !NUMBER_RE.test(answer)) return 'Escribe un número, por ejemplo 3,5.';
  return null;
}

/** El primer ejercicio sin resolver, para retomar donde quedó (0 si ya resolvió todos). */
export function firstPending(exercises: Pick<PracticeExerciseView, 'solved'>[]): number {
  const index = exercises.findIndex((exercise) => !exercise.solved);
  return index === -1 ? 0 : index;
}

/** «3 de 5 resueltos · 60 %», o «Sin ejercicios todavía». */
export function progressLabel(progress: PracticeProgress): string {
  if (progress.total === 0 || progress.percent === null) return 'Sin ejercicios todavía';
  return `${progress.solved} de ${progress.total} ${progress.total === 1 ? 'resuelto' : 'resueltos'} · ${progress.percent} %`;
}
