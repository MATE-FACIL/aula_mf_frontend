import { zonedDateTime } from '@/lib/time';
import type { ExerciseDraft } from '@/features/practice/editor-rules';
import { parseQuestionValues, toQuestions, validateDrafts, type EvaluationQuestionInput } from '@/features/practice/editor-rules';
import type { EvaluationKindCode, EvaluationPayload } from '@/types/evaluations';

// Reglas puras del formulario de evaluaciones (SCRUM-62/63), sin red: se prueban con Vitest. Son las mismas que valida
// el backend; aquí solo avisan antes de enviar. Las horas se escriben y se muestran en la hora de Perú, como el horario.

export const EVALUATION_TIME_ZONE = 'America/Lima';
export const MIN_DURATION = 5;
export const MAX_DURATION = 180;
export const TITLE_MAX = 150;
export const MAX_QUESTIONS = 50;

export const KIND_LABEL: Record<EvaluationKindCode, string> = {
  weekly: 'Semanal',
  midterm: 'Intermedia (sesión 8)',
  final: 'Final (sesión 14)',
};

/** Un instante → el valor de un campo «fecha y hora» (AAAA-MM-DDTHH:mm) en la hora de Perú. */
export function toLocalInput(iso: string, timeZone = EVALUATION_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** El valor de un campo «fecha y hora» (hora de Perú) → instante ISO; null si está vacío o mal escrito. */
export function fromLocalInput(value: string, timeZone = EVALUATION_TIME_ZONE): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = zonedDateTime(match[1], Number(match[2]), Number(match[3]), timeZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface EvaluationFormState {
  kind: EvaluationKindCode;
  title: string;
  opens: string;
  closes: string;
  duration: string;
  isPublished: boolean;
  drafts: ExerciseDraft[];
}

export interface EvaluationProblems {
  title?: string;
  window?: string;
  duration?: string;
  questions?: string;
  /** Por pregunta (posición → mensaje). */
  byQuestion: Record<number, string>;
}

export const hasProblems = (problems: EvaluationProblems) =>
  Boolean(problems.title || problems.window || problems.duration || problems.questions || Object.keys(problems.byQuestion).length > 0);

export function validateEvaluation(form: EvaluationFormState): EvaluationProblems {
  const problems: EvaluationProblems = { byQuestion: {} };
  const title = form.title.trim();
  if (!title) problems.title = 'Escribe el título.';
  else if (title.length > TITLE_MAX) problems.title = `El título admite como máximo ${TITLE_MAX} caracteres.`;

  const opens = fromLocalInput(form.opens);
  const closes = fromLocalInput(form.closes);
  if (!opens || !closes) problems.window = 'Indica cuándo abre y cuándo cierra.';
  else if (Date.parse(closes) <= Date.parse(opens)) problems.window = 'El cierre debe ser posterior a la apertura.';

  const minutes = Number(form.duration);
  if (!Number.isInteger(minutes) || minutes < MIN_DURATION || minutes > MAX_DURATION) {
    problems.duration = `El tiempo para rendirla es de ${MIN_DURATION} a ${MAX_DURATION} minutos.`;
  }

  if (form.drafts.length > MAX_QUESTIONS) problems.questions = `Una evaluación admite como máximo ${MAX_QUESTIONS} preguntas.`;
  else if (form.isPublished && form.drafts.length === 0) problems.questions = 'Para publicarla, agrega al menos una pregunta.';
  const found = validateDrafts(form.drafts, true);
  delete found[-1];
  problems.byQuestion = found;
  return problems;
}

/** Una pregunta como la espera el backend: sin identificador (las preguntas de una evaluación se guardan juntas). */
function questionPayload(question: EvaluationQuestionInput): EvaluationPayload['questions'][number] {
  return {
    competency: question.competency, kind: question.kind, prompt: question.prompt, options: question.options,
    correctOption: question.correctOption, correctNumber: question.correctNumber, tolerance: question.tolerance, explanation: question.explanation,
  };
}

/** Lo que se envía al guardar; asume que `validateEvaluation` no dio problemas. */
export function toPayload(form: EvaluationFormState): EvaluationPayload {
  return {
    kind: form.kind,
    title: form.title.trim(),
    opensAt: fromLocalInput(form.opens) ?? '',
    closesAt: fromLocalInput(form.closes) ?? '',
    durationMinutes: Number(form.duration),
    isPublished: form.isPublished,
    questions: toQuestions(form.drafts).map(questionPayload),
  };
}

const KINDS = ['weekly', 'midterm', 'final'] as const;

/** El JSON que llega a la Server Action: se vuelve a validar en el servidor (el navegador no es de fiar). */
export function parsePayload(raw: unknown): EvaluationPayload | null {
  if (typeof raw !== 'string' || raw.length > 600_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (!KINDS.includes(row.kind as EvaluationKindCode)) return null;
  if (typeof row.title !== 'string' || !row.title.trim() || row.title.trim().length > TITLE_MAX) return null;
  if (typeof row.opensAt !== 'string' || typeof row.closesAt !== 'string') return null;
  const opens = Date.parse(row.opensAt);
  const closes = Date.parse(row.closesAt);
  if (Number.isNaN(opens) || Number.isNaN(closes) || closes <= opens) return null;
  if (typeof row.durationMinutes !== 'number' || !Number.isInteger(row.durationMinutes) || row.durationMinutes < MIN_DURATION || row.durationMinutes > MAX_DURATION) return null;
  if (typeof row.isPublished !== 'boolean') return null;
  const questions = parseQuestionValues(row.questions, MAX_QUESTIONS);
  if (!questions) return null;
  return {
    kind: row.kind as EvaluationKindCode,
    title: row.title.trim(),
    opensAt: new Date(opens).toISOString(),
    closesAt: new Date(closes).toISOString(),
    durationMinutes: row.durationMinutes,
    isPublished: row.isPublished,
    questions: questions.map(questionPayload),
  };
}

/** «Abre hoy 5:00 p. m.», «Cierra mañana…»: el estado de la ventana para el profesor. */
export function windowState(opensAt: string, closesAt: string, now: number): 'upcoming' | 'open' | 'closed' {
  if (now < Date.parse(opensAt)) return 'upcoming';
  return now > Date.parse(closesAt) ? 'closed' : 'open';
}
