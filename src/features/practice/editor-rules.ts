import type { ExerciseAdmin, ExerciseInput, ExerciseKind } from '@/types/practice';

// Reglas puras del editor de ejercicios (SCRUM-59 desde el panel): las mismas que valida el backend. Aquí solo sirven
// para avisar antes de enviar; el backend vuelve a validar todo y es quien decide.

export const MAX_EXERCISES = 30;
export const MAX_PROMPT = 1000;
export const MAX_EXPLANATION = 2000;
export const MAX_OPTION = 200;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

/** Un ejercicio en el formulario: todo es texto, como lo escribe la persona. */
export interface ExerciseDraft {
  key: string;
  id: string | null;
  kind: ExerciseKind;
  prompt: string;
  options: string[];
  correctOption: number | null;
  correctNumber: string;
  tolerance: string;
  explanation: string;
}

let counter = 0;
const nextKey = () => `e${++counter}`;

export function blankDraft(kind: ExerciseKind = 'multiple_choice'): ExerciseDraft {
  return { key: nextKey(), id: null, kind, prompt: '', options: ['', ''], correctOption: null, correctNumber: '', tolerance: '0', explanation: '' };
}

export function toDrafts(exercises: ExerciseAdmin[]): ExerciseDraft[] {
  return exercises.map((item) => ({
    key: nextKey(),
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    options: item.kind === 'multiple_choice' ? [...item.options] : ['', ''],
    correctOption: item.correctOption,
    correctNumber: item.correctNumber === null ? '' : String(item.correctNumber).replace('.', ','),
    tolerance: String(item.tolerance).replace('.', ','),
    explanation: item.explanation ?? '',
  }));
}

/** Un número escrito por una persona: coma o punto decimal. null si no se entiende. */
export function parseNumber(value: string): number | null {
  const text = value.trim().replace(',', '.');
  return /^[+-]?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

/** Quita una opción y corrige cuál era la correcta. No deja menos de dos opciones. */
export function removeOption(draft: ExerciseDraft, index: number): ExerciseDraft {
  if (draft.options.length <= MIN_OPTIONS) return draft;
  const options = draft.options.filter((_, i) => i !== index);
  const correct = draft.correctOption;
  const correctOption = correct === null || correct === index ? null : correct > index ? correct - 1 : correct;
  return { ...draft, options, correctOption };
}

/** Un mensaje por ejercicio con problema (posición → mensaje; -1 es el de toda la lista); vacío si todo está bien. */
export function validateDrafts(drafts: ExerciseDraft[]): Record<number, string> {
  const errors: Record<number, string> = {};
  if (drafts.length > MAX_EXERCISES) errors[-1] = `Una lección admite como máximo ${MAX_EXERCISES} ejercicios.`;
  drafts.forEach((draft, index) => {
    const problem = problemOf(draft);
    if (problem) errors[index] = problem;
  });
  return errors;
}

function problemOf(draft: ExerciseDraft): string | null {
  const prompt = draft.prompt.trim();
  if (!prompt) return 'Escribe el enunciado.';
  if (prompt.length > MAX_PROMPT) return `El enunciado admite como máximo ${MAX_PROMPT} caracteres.`;
  if (draft.explanation.trim().length > MAX_EXPLANATION) return `La explicación admite como máximo ${MAX_EXPLANATION} caracteres.`;
  if (draft.kind === 'multiple_choice') {
    const options = draft.options.map((option) => option.trim());
    if (options.some((option) => !option)) return 'Completa todas las opciones o quita las que sobran.';
    if (options.some((option) => option.length > MAX_OPTION)) return `Cada opción admite como máximo ${MAX_OPTION} caracteres.`;
    if (new Set(options.map((option) => option.toLocaleLowerCase('es'))).size !== options.length) return 'Las opciones no se pueden repetir.';
    if (draft.correctOption === null || draft.correctOption >= options.length) return 'Marca cuál de las opciones es la correcta.';
    return null;
  }
  if (parseNumber(draft.correctNumber) === null) return 'Escribe el número correcto.';
  const tolerance = parseNumber(draft.tolerance);
  if (tolerance === null || tolerance < 0) return 'La tolerancia debe ser cero o un número positivo.';
  return null;
}

/** Lo que se envía al guardar; asume que `validateDrafts` no dio errores. */
export function toInputs(drafts: ExerciseDraft[]): ExerciseInput[] {
  return drafts.map((draft): ExerciseInput => {
    const common = { id: draft.id, kind: draft.kind, prompt: draft.prompt.trim(), explanation: draft.explanation.trim() || null };
    return draft.kind === 'multiple_choice'
      ? { ...common, options: draft.options.map((option) => option.trim()), correctOption: draft.correctOption, correctNumber: null, tolerance: null }
      : { ...common, options: null, correctOption: null, correctNumber: parseNumber(draft.correctNumber), tolerance: parseNumber(draft.tolerance) ?? 0 };
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El JSON que llega a la Server Action: se vuelve a validar en el servidor (el navegador no es de fiar). */
export function parseInputs(raw: unknown): ExerciseInput[] | null {
  if (typeof raw !== 'string' || raw.length > 400_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length > MAX_EXERCISES) return null;
  const inputs: ExerciseInput[] = [];
  for (const item of value) {
    const input = parseInput(item);
    if (!input) return null;
    inputs.push(input);
  }
  return inputs;
}

function parseInput(item: unknown): ExerciseInput | null {
  if (typeof item !== 'object' || item === null) return null;
  const row = item as Record<string, unknown>;
  if (typeof row.prompt !== 'string' || !row.prompt.trim()) return null;
  const id = row.id ?? null;
  if (id !== null && !(typeof id === 'string' && UUID_RE.test(id))) return null;
  const explanation = row.explanation ?? null;
  if (explanation !== null && typeof explanation !== 'string') return null;
  const common = { id: id as string | null, prompt: row.prompt.trim(), explanation: (explanation as string | null)?.trim() || null };

  if (row.kind === 'multiple_choice') {
    const options = row.options;
    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
    if (!options.every((option) => typeof option === 'string' && option.trim())) return null;
    const correct = row.correctOption;
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
    return { ...common, kind: 'multiple_choice', options: options.map((option: string) => option.trim()), correctOption: correct, correctNumber: null, tolerance: null };
  }
  if (row.kind === 'numeric') {
    const tolerance = row.tolerance ?? 0;
    if (typeof row.correctNumber !== 'number' || !Number.isFinite(row.correctNumber)) return null;
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0) return null;
    return { ...common, kind: 'numeric', options: null, correctOption: null, correctNumber: row.correctNumber, tolerance };
  }
  return null;
}
