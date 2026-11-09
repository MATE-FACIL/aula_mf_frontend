// Modelo de dominio del aula. Estos tipos son el CONTRATO con la API .NET:
// los servicios HTTP deben devolver exactamente estas formas (DTOs en camelCase).
// Fechas siempre en ISO 8601 UTC; la UI las muestra en la zona horaria del usuario.

/** Área del aula de la sesión. El backend la deriva de sus roles (student, guardian, instructor, administrator). */
export type Role = 'student' | 'family' | 'teacher' | 'admin';

export interface SessionUser {
  id: string;
  role: Role;
  displayName: string;
  /** Zona horaria IANA de la familia, p. ej. «America/Lima». */
  timeZone: string;
  /** Solo para cuentas familiares: ids de los hijos. */
  childIds?: string[];
}

// ─── Ruta de aprendizaje ────────────────────────────────────────────────

/** Matemáticas (curso pivote) en secundaria tiene 4 niveles. Primaria: en definición. */
export const MATH_LEVELS = ['Prebásico', 'Básico', 'Intermedio', 'Avanzado'] as const;
export type MathLevel = (typeof MATH_LEVELS)[number];

export type LabArea = 'Programación' | 'Inteligencia Artificial' | 'Habilidades digitales';
export type Stage = 'Primaria' | 'Secundaria';

export interface StudentProfile {
  id: string;
  firstName: string;
  age: number;
  grade: string;
  stage: Stage;
  avatar: string;
  timeZone: string;
  stars: number;
  streakDays: number;
  math: { level: MathLevel | null; startLevel: MathLevel | null; progress: number; note?: string };
  lab: { name: string; area: LabArea; month: string; progress: number };
}

export type LessonStatus = 'done' | 'current' | 'locked';

export interface LessonSummary {
  id: string;
  title: string;
  status: LessonStatus;
  duration: string;
  stars?: number;
  label?: string;
}

export interface Unit {
  id: string;
  name: string;
  track: 'math' | 'lab';
  level?: MathLevel;
  area?: LabArea;
  month?: string;
  lessons: LessonSummary[];
  nextUnits?: string;
}

export interface MonthlyLab {
  month: string;
  area: LabArea;
  name: string;
  status: 'done' | 'current' | 'upcoming';
}

export interface ClassFrequency {
  course: string;
  detail: string;
  days: string;
  track: 'math' | 'lab';
}

// ─── Lecciones ─────────────────────────────────────────────────────────

export interface VideoChapter {
  /** Segundo de inicio del capítulo. */
  start: number;
  title: string;
}

export interface Recording {
  label: string;
  durationSec: number;
  /** URL del reproductor (Vimeo/Bunny/Mux). Si falta, se muestra un marcador. */
  src?: string;
  chapters: VideoChapter[];
}

export interface Material {
  id: string;
  name: string;
  url: string;
}

/** Ejercicio de práctica tal como llega al navegador: SIN la respuesta. */
export interface PracticeExercise {
  id: string;
  prompt: string;
}

export interface MathLessonDetail {
  id: string;
  unitLabel: string;
  position: string;
  title: string;
  recording: Recording;
  materials: Material[];
  exercises: PracticeExercise[];
}

export interface LabLessonDetail {
  id: string;
  unitLabel: string;
  title: string;
  recording: Recording;
  challenge: string[];
  materials: Material[];
  taskId: string;
}

export interface AnswerCheck {
  correct: boolean;
  /** Mensaje para el alumno (formato, simplificación, ánimo…). */
  feedback: string;
  starsEarned: number;
  /** false si la respuesta no tenía un formato válido (no se cuenta como intento). */
  countsAsAttempt: boolean;
}

// ─── Tutor IA ──────────────────────────────────────────────────────────

export type TutorMode = 'hint' | 'concept' | 'plan' | 'teacher' | 'free';

export interface TutorRequest {
  /** Ejercicio en pantalla. Sin él, el tutor responde en modo general (sin pistas). */
  exerciseId?: string;
  mode: TutorMode;
  message?: string;
  /** Intentos fallidos del alumno en este ejercicio (el backend real lo verifica). */
  failedAttempts: number;
  hintsUsed: number;
}

export interface TutorReply {
  text: string;
  /** true si la respuesta consumió una pista (afecta las estrellas). */
  countsAsHint: boolean;
}

// ─── Evaluaciones ──────────────────────────────────────────────────────

export type EvaluationKind = 'Prueba de entrada' | 'Semanal' | 'Laboratorio';
export type EvaluationStatus = 'graded' | 'available' | 'upcoming';

export interface EvaluationSummary {
  id: string;
  kind: EvaluationKind;
  topic: string;
  dateLabel: string;
  score: number | null;
  resultLabel: string;
  status: EvaluationStatus;
}

export type QuizQuestion =
  | { id: string; type: 'choice'; text: string; options: string[] }
  | { id: string; type: 'fraction' | 'number'; text: string };

/** Intento iniciado: el servidor fija el límite de tiempo (deadline). */
export interface QuizAttempt {
  attemptId: string;
  title: string;
  questions: QuizQuestion[];
  durationSec: number;
  startedAt: string;
  deadline: string;
}

export type QuizAnswers = Record<string, string>;

export interface QuizQuestionResult {
  questionId: string;
  correct: boolean;
  explanation: string;
}

export interface QuizResult {
  score: number;
  correctCount: number;
  total: number;
  points: number;
  byCompetency: { competency: string; correct: number; total: number }[];
  questions: QuizQuestionResult[];
  /** Se envió después del límite de tiempo (con margen de gracia). */
  late: boolean;
}

// ─── Clases, tareas, asistencia ────────────────────────────────────────

export interface LiveClass {
  id: string;
  startsAt: string;
  durationMin: number;
  course: string;
  topic: string;
  teacher: string;
  track: 'math' | 'lab';
  /** null mientras el profesor no publica el enlace de Zoom/Meet de esa clase. */
  joinUrl: string | null;
}

export interface CalendarEvent {
  date: string;
  time: string;
  label: string;
  kind: 'math' | 'lab' | 'practice';
}

export type TaskStatus = 'pending' | 'submitted' | 'reviewed';

export interface Task {
  id: string;
  title: string;
  course: string;
  dueLabel: string;
  status: TaskStatus;
  teacherComment?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface AttendanceRecord {
  id: string;
  dateLabel: string;
  course: string;
  status: AttendanceStatus;
  note?: string;
}

/** Totales de todas las clases marcadas (la lista solo trae las más recientes). rate: % asistidas (tarde cuenta), null sin clases. */
export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number | null;
}

// ─── Logros ────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  detail: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  lab: string;
  dateLabel: string;
  note: string;
  area: LabArea;
  status: 'done' | 'in-progress';
}

export interface Certificate {
  id: string;
  name: string;
  dateLabel: string;
  code: string | null;
  downloadUrl?: string;
  requirement?: string;
}

// ─── Avisos y mensajes ─────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  kind: 'review' | 'class' | 'evaluation' | 'message';
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface ChatMessage {
  id: string;
  author: 'teacher' | 'family';
  authorName: string;
  text: string;
  sentAt: string;
}

// ─── Familia ───────────────────────────────────────────────────────────

export interface WeeklyReport {
  weekLabel: string;
  recordingsWatched: number;
  practice: { exercises: number; accuracy: number; minutes: number };
  tutor: { questions: number; escalated: number; topics: string[] };
  teacherComment: { author: string; text: string };
  alerts: string[];
  nextStep: string;
}

export interface Membership {
  plan: string;
  detail: string;
  renewalLabel: string;
  price: string | null;
}

/** Matrícula vigente de un hijo. */
export interface ChildEnrollment {
  id: string;
  courseTitle: string;
  offeringName: string;
  status: 'pending' | 'active';
  activatedAt: string | null;
}

export interface ChildOverview {
  id: string;
  displayName: string;
  enrollments: ChildEnrollment[];
  /** Próximas clases: solo de matrículas activas. */
  upcomingClasses: LiveClass[];
  /** null mientras el backend no tenga notas, avance y proyectos: esas secciones no se muestran. */
  profile: StudentProfile | null;
  report: WeeklyReport | null;
  evaluations: EvaluationSummary[];
  attendance: AttendanceRecord[];
  /** Totales reales del backend; null en datos de ejemplo (se calculan de la lista). */
  attendanceSummary: AttendanceSummary | null;
  portfolio: PortfolioItem[];
  certificates: Certificate[];
  badges: Badge[];
  weeklyAverage: number | null;
}

// ─── Panel del alumno ──────────────────────────────────────────────────

export interface StudentDashboard {
  profile: StudentProfile;
  mathUnit: Unit;
  labUnit: Unit;
  classes: LiveClass[];
  tasks: Task[];
  pendingEvaluation: EvaluationSummary | null;
  recentScores: { topic: string; score: number }[];
  notifications: AppNotification[];
}
