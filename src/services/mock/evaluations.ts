import 'server-only';
import { randomUUID } from 'node:crypto';
import { MAX_QUESTIONS } from '@/features/evaluations/rules';
import { ApiError } from '@/lib/http/errors';
import type { Competency, EvaluationPayload, EvaluationQuestionAdmin, EvaluationResults, TeacherEvaluation, TeacherEvaluationDetail } from '@/types/evaluations';
import type { RequestContext, TeacherService } from '../contracts';

// Evaluaciones del profesor EN MEMORIA (modo demo), con las mismas reglas que el backend (SCRUM-62): borrador hasta
// publicar, al menos una pregunta para publicar, plazo con cierre posterior a la apertura. En la demo ningún alumno
// las rinde (el alumno de la demo tiene sus propias evaluaciones de ejemplo), así que todo queda «sin empezar».

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export const MOCK_COMPETENCIES: Competency[] = [
  { code: 'calculo', label: 'Cálculo y operaciones' },
  { code: 'razonamiento', label: 'Razonamiento lógico' },
  { code: 'problemas', label: 'Resolución de problemas' },
];

interface Stored {
  evaluation: Omit<TeacherEvaluation, 'questionCount' | 'started' | 'submitted' | 'enrolled'>;
  questions: EvaluationQuestionAdmin[];
}

const globalForEvaluations = globalThis as unknown as { __mfMockEvaluations?: Map<string, Stored> };
const store = () => (globalForEvaluations.__mfMockEvaluations ??= new Map());

const notFound = (detail: string) => new ApiError('not_found', 'Evaluación', 404, undefined, detail);
const invalid = (detail: string) => new ApiError('validation', 'Evaluación', 400, undefined, detail);

export interface MockGroup {
  offeringId: string;
  courseId: string;
  students: { id: string; fullName: string }[];
}

/** `groupOf`: el grupo del profesor, o null si no lo tiene asignado (el rol ya se verificó). */
export function createMockEvaluations(groupOf: (ctx: RequestContext, offeringId: string) => MockGroup | null) {
  const view = (ctx: RequestContext, stored: Stored): TeacherEvaluation => {
    const group = groupOf(ctx, stored.evaluation.offeringId);
    return { ...stored.evaluation, questionCount: stored.questions.length, started: 0, submitted: 0, enrolled: group?.students.length ?? 0 };
  };
  const owned = (ctx: RequestContext, evaluationId: string): Stored | null => {
    const stored = store().get(evaluationId);
    return stored && groupOf(ctx, stored.evaluation.offeringId) ? stored : null;
  };
  const detail = (ctx: RequestContext, stored: Stored): TeacherEvaluationDetail => ({ evaluation: view(ctx, stored), questions: stored.questions });

  const questionsOf = (payload: EvaluationPayload): EvaluationQuestionAdmin[] => {
    if (payload.questions.length > MAX_QUESTIONS) throw invalid(`Una evaluación admite como máximo ${MAX_QUESTIONS} preguntas.`);
    if (payload.isPublished && payload.questions.length === 0) throw invalid('Para publicarla, la evaluación necesita al menos una pregunta.');
    return payload.questions.map((question, index) => {
      const competency = MOCK_COMPETENCIES.find((item) => item.code === question.competency);
      if (!competency) throw invalid(`Pregunta ${index + 1}: la competencia no es válida.`);
      return {
        id: randomUUID(), number: index + 1, competency: competency.code, competencyLabel: competency.label, kind: question.kind,
        prompt: question.prompt, options: question.options ?? [], correctOption: question.correctOption, correctNumber: question.correctNumber,
        tolerance: question.tolerance ?? 0, explanation: question.explanation,
      };
    });
  };
  const check = (payload: EvaluationPayload) => {
    if (Date.parse(payload.closesAt) <= Date.parse(payload.opensAt)) throw invalid('El cierre debe ser posterior a la apertura.');
  };

  return {
    async listCompetencies() {
      await delay();
      return MOCK_COMPETENCIES;
    },

    async listEvaluations(ctx, offeringId) {
      await delay();
      if (!groupOf(ctx, offeringId)) return null;
      return [...store().values()]
        .filter((stored) => stored.evaluation.offeringId === offeringId)
        .sort((a, b) => a.evaluation.opensAt.localeCompare(b.evaluation.opensAt))
        .map((stored) => view(ctx, stored));
    },

    async getEvaluation(ctx, evaluationId) {
      await delay();
      const stored = owned(ctx, evaluationId);
      return stored ? detail(ctx, stored) : null;
    },

    async createEvaluation(ctx, offeringId, payload) {
      await delay();
      const group = groupOf(ctx, offeringId);
      if (!group) throw notFound('No tienes asignado ese grupo.');
      check(payload);
      const questions = questionsOf(payload);
      const stored: Stored = {
        evaluation: {
          id: randomUUID(), offeringId, courseId: group.courseId, kind: payload.kind, title: payload.title, opensAt: payload.opensAt,
          closesAt: payload.closesAt, durationMinutes: payload.durationMinutes, isPublished: payload.isPublished,
        },
        questions,
      };
      store().set(stored.evaluation.id, stored);
      return detail(ctx, stored);
    },

    async updateEvaluation(ctx, evaluationId, payload) {
      await delay();
      const stored = owned(ctx, evaluationId);
      if (!stored) throw notFound('No encontramos esa evaluación en tus grupos.');
      check(payload);
      const questions = questionsOf(payload);
      Object.assign(stored.evaluation, {
        kind: payload.kind, title: payload.title, opensAt: payload.opensAt, closesAt: payload.closesAt,
        durationMinutes: payload.durationMinutes, isPublished: payload.isPublished,
      });
      stored.questions = questions;
      return detail(ctx, stored);
    },

    async deleteEvaluation(ctx, evaluationId) {
      await delay();
      if (!owned(ctx, evaluationId)) throw notFound('No encontramos esa evaluación en tus grupos.');
      store().delete(evaluationId);
    },

    async getEvaluationResults(ctx, evaluationId): Promise<EvaluationResults | null> {
      await delay();
      const stored = owned(ctx, evaluationId);
      if (!stored) return null;
      const group = groupOf(ctx, stored.evaluation.offeringId)!;
      return {
        evaluation: view(ctx, stored),
        averageScore: null,
        byCompetency: [],
        students: group.students.map((student) => ({
          studentUserId: student.id, fullName: student.fullName, status: 'not_started' as const, score: null, percent: null,
          submittedAt: null, isLate: false, byCompetency: [],
        })),
      };
    },
  } satisfies Pick<TeacherService, 'listCompetencies' | 'listEvaluations' | 'getEvaluation' | 'createEvaluation' | 'updateEvaluation' | 'deleteEvaluation' | 'getEvaluationResults'>;
}
