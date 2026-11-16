import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import { formatShortDate, formatShortWeekday, formatTime } from '@/lib/time';
import type { EvaluationKind, EvaluationStatus, EvaluationSummary, QuizAttempt, QuizQuestion, QuizResult } from '@/types/domain';
import type { AssessmentService } from '../contracts';
import { enc } from './shared';

// Evaluaciones reales del alumno (SCRUM-62/63): el backend decide si se puede iniciar y enviar (con su reloj), corrige y
// calcula la nota sobre 20 con el resultado por competencia. Aquí solo se convierten sus respuestas a las pantallas.

export interface StudentEvaluationDto {
  id: string;
  kind: 'weekly' | 'midterm' | 'final';
  title: string;
  courseTitle: string;
  offeringName: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  questionCount: number;
  status: 'upcoming' | 'open' | 'in_progress' | 'graded' | 'missed';
  score: number | null;
  percent: number | null;
  attemptId: string | null;
}

export interface StartedAttemptDto {
  attemptId: string;
  evaluationId: string;
  title: string;
  durationSeconds: number;
  startedAt: string;
  deadline: string;
  serverNow: string;
  questions: { id: string; number: number; kind: 'multiple_choice' | 'numeric'; competency: string; prompt: string; options: string[] }[];
}

export interface SubmittedResultDto {
  evaluationId: string;
  score: number;
  percent: number;
  correctCount: number;
  total: number;
  late: boolean;
  byCompetency: { competency: string; label: string; correct: number; total: number }[];
  questions: { questionId: string; isCorrect: boolean; explanation: string | null }[];
}

const KIND: Record<StudentEvaluationDto['kind'], EvaluationKind> = { weekly: 'Semanal', midterm: 'Intermedia', final: 'Final' };
const STATUS: Record<StudentEvaluationDto['status'], EvaluationStatus> = {
  upcoming: 'upcoming', open: 'available', in_progress: 'available', graded: 'graded', missed: 'missed',
};

const when = (iso: string, timeZone: string) => `${formatShortWeekday(iso, timeZone)} ${formatShortDate(iso, timeZone)} · ${formatTime(iso, timeZone)}`;

export function toSummary(dto: StudentEvaluationDto, timeZone: string): EvaluationSummary {
  const base = { id: dto.id, kind: KIND[dto.kind], topic: dto.title, status: STATUS[dto.status] };
  const details = `${dto.questionCount} ${dto.questionCount === 1 ? 'pregunta' : 'preguntas'} · ${dto.durationMinutes} min`;
  switch (dto.status) {
    case 'graded':
      return { ...base, score: dto.percent, dateLabel: 'Calificada', resultLabel: `${String(dto.score).replace('.', ',')} de 20 puntos` };
    case 'upcoming':
      return { ...base, score: null, dateLabel: `Abre ${when(dto.opensAt, timeZone)}`, resultLabel: details };
    case 'missed':
      return { ...base, score: null, dateLabel: `Cerró ${when(dto.closesAt, timeZone)}`, resultLabel: 'Sin rendir' };
    case 'in_progress':
      return { ...base, score: null, dateLabel: `Cierra ${when(dto.closesAt, timeZone)}`, resultLabel: `Ya empezaste · ${details}` };
    default:
      return { ...base, score: null, dateLabel: `Cierra ${when(dto.closesAt, timeZone)}`, resultLabel: details };
  }
}

export function toAttempt(dto: StartedAttemptDto): QuizAttempt {
  const questions = dto.questions.map((q): QuizQuestion =>
    q.kind === 'multiple_choice' ? { id: q.id, type: 'choice', text: q.prompt, options: q.options } : { id: q.id, type: 'number', text: q.prompt });
  return { attemptId: dto.attemptId, title: dto.title, questions, durationSec: dto.durationSeconds, startedAt: dto.startedAt, deadline: dto.deadline };
}

export function toResult(dto: SubmittedResultDto): QuizResult {
  return {
    score: dto.percent,
    correctCount: dto.correctCount,
    total: dto.total,
    points: dto.score,
    byCompetency: dto.byCompetency.map((c) => ({ competency: c.label, correct: c.correct, total: c.total })),
    questions: dto.questions.map((q) => ({ questionId: q.questionId, correct: q.isCorrect, explanation: q.explanation ?? '' })),
    late: dto.late,
  };
}

export const httpAssessments: AssessmentService = {
  async list({ token, user }) {
    const items = await apiRequest<StudentEvaluationDto[]>('/students/me/evaluations', { token });
    return items.map((item) => toSummary(item, user.timeZone));
  },
  async start({ token }, evaluationId) {
    return toAttempt(await apiRequest<StartedAttemptDto>(`/students/me/evaluations/${enc(evaluationId)}/attempts`, { method: 'POST', token }));
  },
  async submit({ token }, attemptId, answers) {
    return toResult(await apiRequest<SubmittedResultDto>(`/students/me/evaluations/attempts/${enc(attemptId)}/submit`, { method: 'POST', token, body: { answers } }));
  },
};
