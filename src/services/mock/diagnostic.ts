import 'server-only';
import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/http/errors';
import type {
  DiagnosticLevelCode,
  DiagnosticListItem,
  DiagnosticResult,
  DiagnosticReview,
  DiagnosticStage,
  StudentDiagnostic,
} from '@/types/diagnostic';
import type { ExerciseKind } from '@/types/practice';
import type { DiagnosticService } from '../contracts';
import { scoreDiagnostic } from '@/features/diagnostic/rules';

// Diagnóstico EN MEMORIA (modo mock), con las mismas reglas que el backend: uno por alumno y etapa, sin decir si
// acertó mientras responde, resultado por tema y nivel sugerido al terminar, y confirmación del profesor.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

interface MockQuestion {
  id: string;
  level: DiagnosticLevelCode;
  topic: string;
  kind: ExerciseKind;
  prompt: string;
  options?: string[];
  correctOption?: number;
  correctNumber?: number;
  explanation: string;
}

const q = (n: number, level: DiagnosticLevelCode, topic: string, rest: Omit<MockQuestion, 'id' | 'level' | 'topic'>): MockQuestion =>
  ({ id: `d1a90000-0000-4000-8000-${String(n).padStart(12, '0')}`, level, topic, ...rest });

/** Banco de ejemplo para la demo (el real lo carga el equipo académico, SCRUM-47). */
const BANK: Record<DiagnosticStage, MockQuestion[]> = {
  primary: [
    q(1, 'prebasic', 'Operaciones', { kind: 'numeric', prompt: '¿Cuánto es 25 + 17?', correctNumber: 42, explanation: '25 + 17 = 42.' }),
    q(2, 'prebasic', 'Operaciones', { kind: 'numeric', prompt: '¿Cuánto es 8 × 6?', correctNumber: 48, explanation: '8 × 6 = 48.' }),
    q(3, 'basic', 'Fracciones', { kind: 'multiple_choice', prompt: '¿Qué fracción es mayor?', options: ['1/3', '1/2', '1/4'], correctOption: 1, explanation: 'Con el mismo numerador, es mayor la de menor denominador.' }),
    q(4, 'basic', 'Fracciones', { kind: 'numeric', prompt: '¿Cuánto es 1/2 + 1/4 en decimal?', correctNumber: 0.75, explanation: '1/2 + 1/4 = 3/4 = 0,75.' }),
    q(5, 'intermediate', 'Decimales', { kind: 'numeric', prompt: '¿Cuánto es 2,5 × 4?', correctNumber: 10, explanation: '2,5 × 4 = 10.' }),
    q(6, 'intermediate', 'Geometría', { kind: 'numeric', prompt: '¿Cuál es el perímetro de un cuadrado de lado 7 cm?', correctNumber: 28, explanation: '4 lados de 7 cm: 28 cm.' }),
    q(7, 'advanced', 'Problemas', { kind: 'multiple_choice', prompt: 'Si 3 cuadernos cuestan S/ 12, ¿cuánto cuestan 5?', options: ['S/ 15', 'S/ 20', 'S/ 24'], correctOption: 1, explanation: 'Cada uno cuesta S/ 4; 5 × 4 = S/ 20.' }),
  ],
  secondary: [
    q(11, 'prebasic', 'Números enteros', { kind: 'numeric', prompt: '¿Cuánto es −7 + 12?', correctNumber: 5, explanation: '−7 + 12 = 5.' }),
    q(12, 'basic', 'Álgebra', { kind: 'numeric', prompt: 'Si 2x + 3 = 11, ¿cuánto vale x?', correctNumber: 4, explanation: '2x = 8, x = 4.' }),
    q(13, 'intermediate', 'Funciones', { kind: 'multiple_choice', prompt: '¿Cuál es la pendiente de y = 3x − 2?', options: ['−2', '3', '1/3'], correctOption: 1, explanation: 'En y = mx + b, la pendiente es m = 3.' }),
    q(14, 'advanced', 'Trigonometría', { kind: 'numeric', prompt: '¿Cuánto es sen 30°?', correctNumber: 0.5, explanation: 'sen 30° = 1/2.' }),
  ],
};

const STAGE_LABEL: Record<DiagnosticStage, string> = { primary: 'Primaria', secondary: 'Secundaria' };
export const LEVEL_LABEL: Record<DiagnosticLevelCode, string> = { prebasic: 'Prebásico', basic: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' };
const level = (code: DiagnosticLevelCode | null) => (code ? { code, label: LEVEL_LABEL[code] } : null);

interface MockAttempt {
  id: string;
  studentId: string;
  studentName: string;
  stage: DiagnosticStage;
  questionIds: string[];
  answers: Map<string, { answer: string | null; correct: boolean }>;
  startedAt: string;
  completedAt: string | null;
  suggested: DiagnosticLevelCode | null;
  confirmed: DiagnosticLevelCode | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

const globalForStore = globalThis as unknown as { __mfDiagnostics?: Map<string, MockAttempt> };
const attempts = () => (globalForStore.__mfDiagnostics ??= new Map());

const question = (id: string) => [...BANK.primary, ...BANK.secondary].find((item) => item.id === id)!;

function check(item: MockQuestion, answer: string): boolean | null {
  const text = answer.trim();
  if (item.kind === 'multiple_choice') {
    const option = Number(text);
    return /^\d+$/.test(text) && option < (item.options?.length ?? 0) ? option === item.correctOption : null;
  }
  if (!/^[+-]?\d+([.,]\d+)?$/.test(text)) return null;
  return Math.abs(Number(text.replace(',', '.')) - item.correctNumber!) < 1e-9;
}

function result(attempt: MockAttempt): DiagnosticResult | null {
  if (!attempt.completedAt) return null;
  const lines = attempt.questionIds.map((id) => ({ ...question(id), correct: attempt.answers.get(id)?.correct ?? false }));
  const score = scoreDiagnostic(lines);
  return {
    topics: score.topics,
    levels: score.levels.map((line) => ({ ...line, label: LEVEL_LABEL[line.label as DiagnosticLevelCode] })),
    suggested: level(attempt.suggested ?? score.suggested)!,
    confirmed: level(attempt.confirmed),
  };
}

function view(attempt: MockAttempt): StudentDiagnostic {
  return {
    attemptId: attempt.id,
    stage: attempt.stage,
    stageLabel: STAGE_LABEL[attempt.stage],
    status: attempt.completedAt ? 'completed' : 'in_progress',
    answered: attempt.answers.size,
    total: attempt.questionIds.length,
    questions: attempt.questionIds.map((id, index) => {
      const item = question(id);
      return { id, number: index + 1, topic: item.topic, kind: item.kind, prompt: item.prompt, options: item.options ?? [], answered: attempt.answers.has(id) };
    }),
    result: result(attempt),
  };
}

function summary(attempt: MockAttempt): DiagnosticListItem {
  return {
    attemptId: attempt.id, studentUserId: attempt.studentId, studentName: attempt.studentName, stage: attempt.stage,
    stageLabel: STAGE_LABEL[attempt.stage], status: attempt.completedAt ? 'completed' : 'in_progress',
    answered: attempt.answers.size, total: attempt.questionIds.length, startedAt: attempt.startedAt, completedAt: attempt.completedAt,
    suggested: level(attempt.suggested), confirmed: level(attempt.confirmed),
  };
}

function review(attempt: MockAttempt): DiagnosticReview {
  return {
    summary: summary(attempt),
    result: result(attempt),
    answers: attempt.questionIds.map((id, index) => {
      const item = question(id);
      const own = attempt.answers.get(id);
      const asText = (value: string | null | undefined) =>
        value == null ? null : item.kind === 'multiple_choice' ? (item.options?.[Number(value)] ?? value) : value;
      return {
        number: index + 1, topic: item.topic, levelLabel: LEVEL_LABEL[item.level], prompt: item.prompt, answered: !!own,
        answer: asText(own?.answer), correctAnswer: asText(item.kind === 'multiple_choice' ? String(item.correctOption) : String(item.correctNumber))!,
        isCorrect: own?.correct ?? false, explanation: item.explanation,
      };
    }),
    confirmedByName: attempt.confirmedBy,
    confirmedAt: attempt.confirmedAt,
  };
}

const notFound = () => new ApiError('not_found', 'Diagnóstico no encontrado', 404);

export const mockDiagnostic: DiagnosticService = {
  async overview(ctx) {
    await delay();
    return (['primary', 'secondary'] as const).map((stage) => {
      const attempt = [...attempts().values()].find((a) => a.studentId === ctx.user.id && a.stage === stage);
      return {
        stage, stageLabel: STAGE_LABEL[stage], available: BANK[stage].length > 0, attemptId: attempt?.id ?? null,
        status: attempt ? (attempt.completedAt ? 'completed' : 'in_progress') : null,
        answered: attempt?.answers.size ?? 0, total: attempt?.questionIds.length ?? 0, result: attempt ? result(attempt) : null,
      };
    });
  },

  async start(ctx, stage) {
    await delay();
    const existing = [...attempts().values()].find((a) => a.studentId === ctx.user.id && a.stage === stage);
    if (existing) return view(existing);
    const attempt: MockAttempt = {
      id: randomUUID(), studentId: ctx.user.id, studentName: ctx.user.displayName, stage, questionIds: BANK[stage].map((item) => item.id),
      answers: new Map(), startedAt: new Date().toISOString(), completedAt: null, suggested: null, confirmed: null, confirmedBy: null, confirmedAt: null,
    };
    attempts().set(attempt.id, attempt);
    return view(attempt);
  },

  async get(ctx, attemptId) {
    await delay();
    const attempt = attempts().get(attemptId);
    return attempt && attempt.studentId === ctx.user.id ? view(attempt) : null;
  },

  async answer(ctx, attemptId, questionId, answer, skip) {
    await delay();
    const attempt = attempts().get(attemptId);
    if (!attempt || attempt.studentId !== ctx.user.id || !attempt.questionIds.includes(questionId)) throw notFound();
    if (attempt.completedAt) throw new ApiError('conflict', 'Ya terminaste este diagnóstico.', 409, undefined, 'Ya terminaste este diagnóstico.');
    if (attempt.answers.has(questionId)) throw new ApiError('conflict', 'Ya respondiste esta pregunta.', 409, undefined, 'Ya respondiste esta pregunta.');
    const item = question(questionId);
    const correct = skip ? false : check(item, answer ?? '');
    if (correct === null) {
      const message = item.kind === 'multiple_choice' ? 'Elige una de las opciones.' : 'Escribe un número, por ejemplo 3,5.';
      throw new ApiError('validation', message, 400, undefined, message);
    }
    attempt.answers.set(questionId, { answer: skip ? null : (answer ?? '').trim(), correct });
    if (attempt.answers.size < attempt.questionIds.length) {
      return { answered: attempt.answers.size, total: attempt.questionIds.length, completed: false, result: null };
    }
    attempt.completedAt = new Date().toISOString();
    attempt.suggested = scoreDiagnostic(attempt.questionIds.map((id: string) => ({ ...question(id), correct: attempt.answers.get(id)!.correct }))).suggested;
    return { answered: attempt.answers.size, total: attempt.questionIds.length, completed: true, result: result(attempt) };
  },

  async listReviews(_ctx, filter, page) {
    await delay();
    const items = [...attempts().values()]
      .filter((a) => filter === 'all' ? true
        : filter === 'pending' ? !!a.completedAt && !a.confirmed
          : filter === 'confirmed' ? !!a.confirmed
            : !a.completedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const pageSize = 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize).map(summary), page, pageSize, total: items.length };
  },

  async getReview(_ctx, attemptId) {
    await delay();
    const attempt = attempts().get(attemptId);
    return attempt ? review(attempt) : null;
  },

  async confirm(ctx, attemptId, code) {
    await delay();
    const attempt = attempts().get(attemptId);
    if (!attempt) throw notFound();
    if (!attempt.completedAt) {
      throw new ApiError('conflict', 'Sin terminar', 409, undefined, 'El alumno todavía no termina el diagnóstico.');
    }
    if (!(code in LEVEL_LABEL)) throw new ApiError('validation', 'Nivel desconocido', 400, undefined, 'Elige un nivel.');
    attempt.confirmed = code as DiagnosticLevelCode;
    attempt.confirmedBy = ctx.user.displayName;
    attempt.confirmedAt = new Date().toISOString();
    return review(attempt);
  },
};
