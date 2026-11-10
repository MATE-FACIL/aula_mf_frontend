// Diagnóstico de entrada (SCRUM-48/49). Mismas formas que la API .NET (camelCase): el alumno nunca recibe la
// respuesta correcta ni la explicación, y mientras rinde la prueba tampoco sabe si acertó.

import type { ExerciseKind } from './practice';

export type DiagnosticStage = 'primary' | 'secondary';
export type DiagnosticLevelCode = 'prebasic' | 'basic' | 'intermediate' | 'advanced';
export type DiagnosticStatus = 'in_progress' | 'completed';

export interface LevelRef {
  code: DiagnosticLevelCode;
  label: string;
}

/** Una línea del resultado: un tema o un nivel. */
export interface ScoreLine {
  label: string;
  correct: number;
  total: number;
  percent: number;
}

export interface DiagnosticResult {
  topics: ScoreLine[];
  levels: ScoreLine[];
  suggested: LevelRef;
  /** null hasta que el profesor confirma el nivel. */
  confirmed: LevelRef | null;
}

export interface DiagnosticQuestionView {
  id: string;
  number: number;
  topic: string;
  kind: ExerciseKind;
  prompt: string;
  options: string[];
  answered: boolean;
}

export interface StudentDiagnostic {
  attemptId: string;
  stage: DiagnosticStage;
  stageLabel: string;
  status: DiagnosticStatus;
  answered: number;
  total: number;
  questions: DiagnosticQuestionView[];
  result: DiagnosticResult | null;
}

/** Una etapa en el resumen del alumno. */
export interface DiagnosticStageSummary {
  stage: DiagnosticStage;
  stageLabel: string;
  /** true si el equipo ya cargó preguntas para esta etapa. */
  available: boolean;
  attemptId: string | null;
  status: DiagnosticStatus | null;
  answered: number;
  total: number;
  result: DiagnosticResult | null;
}

export interface DiagnosticAnswerResult {
  answered: number;
  total: number;
  completed: boolean;
  result: DiagnosticResult | null;
}

// ─── Revisión del profesor ─────────────────────────────────────────────

export type DiagnosticFilter = 'pending' | 'confirmed' | 'in_progress' | 'all';

export interface DiagnosticListItem {
  attemptId: string;
  studentUserId: string;
  studentName: string;
  stage: DiagnosticStage;
  stageLabel: string;
  status: DiagnosticStatus;
  answered: number;
  total: number;
  startedAt: string;
  completedAt: string | null;
  suggested: LevelRef | null;
  confirmed: LevelRef | null;
}

export interface DiagnosticPage {
  items: DiagnosticListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DiagnosticAnswerReview {
  number: number;
  topic: string;
  levelLabel: string;
  prompt: string;
  answered: boolean;
  /** Lo que respondió (texto de la opción o el número); null si eligió «No lo sé» o aún no responde. */
  answer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
}

export interface DiagnosticReview {
  summary: DiagnosticListItem;
  result: DiagnosticResult | null;
  answers: DiagnosticAnswerReview[];
  confirmedByName: string | null;
  confirmedAt: string | null;
}
