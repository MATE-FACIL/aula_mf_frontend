// Práctica con corrección en el servidor (SCRUM-59/60/61). Mismas formas que la API .NET (camelCase):
// el alumno nunca recibe la respuesta correcta ni la explicación antes de responder.

export type ExerciseKind = 'multiple_choice' | 'numeric';

/** Un ejercicio tal como lo ve el equipo y el profesor: CON la respuesta correcta y la explicación (SCRUM-59). */
export interface ExerciseAdmin {
  id: string;
  number: number;
  kind: ExerciseKind;
  prompt: string;
  options: string[];
  correctOption: number | null;
  correctNumber: number | null;
  tolerance: number;
  explanation: string | null;
}

/** Lo que se guarda de un ejercicio. `id` conserva un ejercicio existente (y el historial de sus alumnos). */
export interface ExerciseInput {
  id: string | null;
  kind: ExerciseKind;
  prompt: string;
  options: string[] | null;
  correctOption: number | null;
  correctNumber: number | null;
  tolerance: number | null;
  explanation: string | null;
}

/** percent: resueltos sobre disponibles; null cuando no hay ejercicios. */
export interface PracticeProgress {
  solved: number;
  total: number;
  percent: number | null;
}

export interface PracticeExerciseView {
  id: string;
  number: number;
  kind: ExerciseKind;
  prompt: string;
  /** Opciones de una pregunta de opción múltiple; vacío en las numéricas. */
  options: string[];
  attempts: number;
  /** true si ya lo respondió bien al menos una vez. */
  solved: boolean;
}

export interface LessonPractice {
  lessonId: string;
  lessonTitle: string;
  progress: PracticeProgress;
  exercises: PracticeExerciseView[];
}

/** Resultado de una respuesta: correcta o no, la explicación y el avance de la lección después de ella. */
export interface PracticeAnswerResult {
  isCorrect: boolean;
  explanation: string | null;
  lessonProgress: PracticeProgress;
  attempts: number;
}

export interface PracticeLessonProgress {
  lessonId: string;
  title: string;
  progress: PracticeProgress;
}

/** Un curso del alumno (un nivel de Matemáticas es un curso) con el avance de cada lección publicada. */
export interface PracticeCourse {
  courseId: string;
  courseTitle: string;
  offeringName: string;
  /** «Primaria · Básico», o null si el curso no es un nivel de Matemáticas. */
  levelLabel: string | null;
  progress: PracticeProgress;
  lessons: PracticeLessonProgress[];
}
