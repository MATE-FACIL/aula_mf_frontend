// Evaluaciones con nota automática y plazo (SCRUM-62/63). Mismas formas que la API .NET (camelCase).

export type EvaluationKindCode = 'weekly' | 'midterm' | 'final';

export interface Competency {
  code: string;
  label: string;
}

/** Una evaluación de un grupo, tal como la ve su profesor. */
export interface TeacherEvaluation {
  id: string;
  offeringId: string;
  courseId: string;
  kind: EvaluationKindCode;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  isPublished: boolean;
  questionCount: number;
  /** Alumnos que ya empezaron / que ya enviaron, y alumnos activos del grupo. */
  started: number;
  submitted: number;
  enrolled: number;
}

export interface EvaluationQuestionAdmin {
  id: string;
  number: number;
  competency: string;
  competencyLabel: string;
  kind: 'multiple_choice' | 'numeric';
  prompt: string;
  options: string[];
  correctOption: number | null;
  correctNumber: number | null;
  tolerance: number;
  explanation: string | null;
}

export interface TeacherEvaluationDetail {
  evaluation: TeacherEvaluation;
  questions: EvaluationQuestionAdmin[];
}

/** Lo que se guarda de una evaluación: sus datos y la lista completa de preguntas. */
export interface EvaluationPayload {
  kind: EvaluationKindCode;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  isPublished: boolean;
  questions: {
    competency: string | null;
    kind: 'multiple_choice' | 'numeric';
    prompt: string;
    options: string[] | null;
    correctOption: number | null;
    correctNumber: number | null;
    tolerance: number | null;
    explanation: string | null;
  }[];
}

export interface CompetencyScore {
  competency: string;
  label: string;
  correct: number;
  total: number;
}

export interface StudentEvaluationResult {
  studentUserId: string;
  fullName: string;
  status: 'graded' | 'in_progress' | 'not_started';
  /** Sobre 20. */
  score: number | null;
  percent: number | null;
  submittedAt: string | null;
  isLate: boolean;
  byCompetency: CompetencyScore[];
}

export interface EvaluationResults {
  evaluation: TeacherEvaluation;
  averageScore: number | null;
  byCompetency: CompetencyScore[];
  students: StudentEvaluationResult[];
}
