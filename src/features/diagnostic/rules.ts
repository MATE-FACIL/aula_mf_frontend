import type { DiagnosticFilter, DiagnosticLevelCode, DiagnosticQuestionView, ScoreLine } from '@/types/diagnostic';

// Reglas puras del diagnóstico (sin red): se prueban con Vitest. La calificación de verdad la hace el backend; esta
// copia sirve al modo mock y debe decir lo mismo (ver docs/DIAGNOSTICO.md del backend).

/** Porcentaje de preguntas de un nivel que hay que acertar para dominarlo. */
export const PASS_PERCENT = 60;

export const LEVELS: { code: DiagnosticLevelCode; label: string }[] = [
  { code: 'prebasic', label: 'Prebásico' },
  { code: 'basic', label: 'Básico' },
  { code: 'intermediate', label: 'Intermedio' },
  { code: 'advanced', label: 'Avanzado' },
];

export const isLevelCode = (value: unknown): value is DiagnosticLevelCode => LEVELS.some((level) => level.code === value);

export const FILTERS: { value: DiagnosticFilter; label: string }[] = [
  { value: 'pending', label: 'Por confirmar' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'all', label: 'Todos' },
];

export const isFilter = (value: unknown): value is DiagnosticFilter => FILTERS.some((filter) => filter.value === value);

const percent = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct * 100) / total));

/**
 * Resultado por tema (en el orden en que aparecen, sin distinguir mayúsculas) y por nivel (en orden de la ruta). El
 * nivel sugerido es el primero que el alumno aún no domina; si domina todos, el más alto medido.
 */
export function scoreDiagnostic(answers: { topic: string; level: DiagnosticLevelCode; correct: boolean }[]): {
  topics: ScoreLine[];
  levels: ScoreLine[];
  suggested: DiagnosticLevelCode;
} {
  if (answers.length === 0) throw new Error('No hay respuestas que calificar.');
  const topics = new Map<string, ScoreLine>();
  for (const answer of answers) {
    const key = answer.topic.toLocaleLowerCase('es');
    const line = topics.get(key) ?? { label: answer.topic, correct: 0, total: 0, percent: 0 };
    line.correct += answer.correct ? 1 : 0;
    line.total += 1;
    topics.set(key, line);
  }
  const levels = LEVELS.map(({ code }) => {
    const own = answers.filter((answer) => answer.level === code);
    const correct = own.filter((answer) => answer.correct).length;
    return { label: code, correct, total: own.length, percent: percent(correct, own.length) };
  }).filter((line) => line.total > 0);
  const suggested = (levels.find((line) => line.percent < PASS_PERCENT) ?? levels[levels.length - 1]).label as DiagnosticLevelCode;
  return { topics: [...topics.values()].map((line) => ({ ...line, percent: percent(line.correct, line.total) })), levels, suggested };
}

/** Dónde retomar: la primera pregunta sin responder (0 si ya respondió todas). */
export function firstUnanswered(questions: Pick<DiagnosticQuestionView, 'answered'>[]): number {
  const index = questions.findIndex((question) => !question.answered);
  return index === -1 ? 0 : index;
}

/** Un número del backend («0.75») con coma decimal («0,75»); cualquier otro texto queda igual. */
export const decimalComma = (value: string) => (/^-?\d+\.\d+$/.test(value) ? value.replace('.', ',') : value);

/** «3 de 10 respondidas». */
export const answeredLabel = (answered: number, total: number) =>
  `${answered} de ${total} ${total === 1 ? 'respondida' : 'respondidas'}`;
