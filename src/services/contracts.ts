// Contratos de la capa de datos. Las pantallas y Server Actions dependen SOLO de estas interfaces;
// la implementación (mock en memoria o HTTP contra .NET) se elige en `services/index.ts`.
// Así se puede desarrollar el frontend sin backend y cambiar a la API real con una variable de entorno.

import type {
  AnswerCheck,
  AppNotification,
  AttendanceRecord,
  Badge,
  CalendarEvent,
  Certificate,
  ChatMessage,
  ChildOverview,
  ClassFrequency,
  EvaluationSummary,
  LabLessonDetail,
  LiveClass,
  Material,
  MathLessonDetail,
  Membership,
  MonthlyLab,
  PortfolioItem,
  QuizAnswers,
  QuizAttempt,
  QuizResult,
  SessionUser,
  StudentDashboard,
  StudentProfile,
  Task,
  TutorReply,
  TutorRequest,
  Unit,
} from '@/types/domain';
import type {
  AdminCourse,
  AdminSummary,
  AdminUserDetail,
  AdminUserListItem,
  CourseCategory,
  CourseOffering,
  CreatedInstructor,
  Enrollment,
  EnrollmentFilters,
  Instructor,
  IssuedCredentials,
  NewGuardianInput,
  NewStudentInput,
  OfferingSeats,
  Page,
  SaveCourseInput,
  SaveOfferingInput,
  UserListFilters,
} from '@/types/admin';

/** Contexto de cada llamada: el token de la sesión y el usuario ya verificado. */
export interface RequestContext {
  token: string;
  user: SessionUser;
}

export interface AuthResult {
  token: string;
  user: SessionUser;
  /** Vigencia del token en segundos. */
  expiresIn: number;
  /** Token de renovación del backend real (SCRUM-36). No existe en modo mock. */
  refreshToken?: string | null;
}

export interface AuthService {
  loginStudent(input: { username: string; pictograms?: string[]; password?: string }): Promise<AuthResult | null>;
  /** Ingreso con correo: familias y equipo. El rol (familia o admin) lo decide el backend, no el formulario. */
  loginFamily(input: { email: string; password: string }): Promise<AuthResult | null>;
  /** Devuelve el usuario del token o null si el token no es válido / venció. */
  me(token: string): Promise<SessionUser | null>;
  /** Con el token de renovación, el backend revoca la sesión de ESTE dispositivo. */
  logout(token: string, refreshToken?: string): Promise<void>;
}

export interface LearningPath {
  profile: StudentProfile;
  mathUnit: Unit;
  labUnit: Unit;
  labs: MonthlyLab[];
  frequency: ClassFrequency[];
}

export interface Achievements {
  profile: StudentProfile;
  badges: Badge[];
  portfolio: PortfolioItem[];
  certificates: Certificate[];
}

export interface StudentService {
  getProfile(ctx: RequestContext): Promise<StudentProfile>;
  getDashboard(ctx: RequestContext): Promise<StudentDashboard>;
  getLearningPath(ctx: RequestContext): Promise<LearningPath>;
  getAchievements(ctx: RequestContext): Promise<Achievements>;
}

export interface NotificationService {
  list(ctx: RequestContext): Promise<AppNotification[]>;
  markAllRead(ctx: RequestContext): Promise<void>;
}

export interface PracticeContext {
  attempts: number;
  hintsUsed: number;
}

export interface LessonService {
  getCurrentMathLesson(ctx: RequestContext): Promise<{ lesson: MathLessonDetail; unit: Unit }>;
  getCurrentLabLesson(ctx: RequestContext): Promise<{ lesson: LabLessonDetail; unit: Unit }>;
  /** Corrige en el servidor: las respuestas correctas nunca llegan al navegador. */
  checkAnswer(ctx: RequestContext, exerciseId: string, answer: string, practice: PracticeContext): Promise<AnswerCheck>;
}

export interface TutorService {
  ask(ctx: RequestContext, request: TutorRequest): Promise<TutorReply>;
}

export interface AssessmentService {
  list(ctx: RequestContext): Promise<EvaluationSummary[]>;
  /** Inicia un intento con límite de tiempo fijado por el servidor. */
  start(ctx: RequestContext, evaluationId: string): Promise<QuizAttempt>;
  submit(ctx: RequestContext, attemptId: string, answers: QuizAnswers): Promise<QuizResult>;
}

export interface Schedule {
  classes: LiveClass[];
  calendar: CalendarEvent[];
  weekStart: string;
  tasks: Task[];
  attendance: AttendanceRecord[];
  materials: Material[];
}

export interface ScheduleService {
  getSchedule(ctx: RequestContext): Promise<Schedule>;
  submitTask(ctx: RequestContext, taskId: string, submission: { note: string; fileNames: string[] }): Promise<Task>;
}

export interface FamilyService {
  getChildren(ctx: RequestContext): Promise<ChildOverview[]>;
  getMessages(ctx: RequestContext): Promise<ChatMessage[]>;
  sendMessage(ctx: RequestContext, text: string): Promise<ChatMessage>;
  getMembership(ctx: RequestContext): Promise<Membership>;
}

/** Panel de administración. Toda operación exige la sesión de un administrador. */
export interface AdminService {
  getSummary(ctx: RequestContext): Promise<AdminSummary>;
  listUsers(ctx: RequestContext, filters: UserListFilters): Promise<Page<AdminUserListItem>>;
  /** null si la persona no existe. */
  getUser(ctx: RequestContext, userId: string): Promise<AdminUserDetail | null>;
  createStudent(ctx: RequestContext, input: NewStudentInput): Promise<IssuedCredentials>;
  createGuardian(ctx: RequestContext, input: NewGuardianInput): Promise<IssuedCredentials>;
  setUserActive(ctx: RequestContext, userId: string, active: boolean): Promise<void>;
  linkStudent(ctx: RequestContext, guardianId: string, studentId: string): Promise<void>;
  unlinkStudent(ctx: RequestContext, guardianId: string, studentId: string): Promise<void>;

  listCourses(ctx: RequestContext): Promise<AdminCourse[]>;
  /** null si el curso no existe. */
  getCourse(ctx: RequestContext, courseId: string): Promise<AdminCourse | null>;
  createCourse(ctx: RequestContext, input: SaveCourseInput): Promise<AdminCourse>;
  updateCourse(ctx: RequestContext, courseId: string, input: SaveCourseInput): Promise<AdminCourse>;
  setCoursePublished(ctx: RequestContext, courseId: string, published: boolean): Promise<AdminCourse>;
  replaceCourseCover(ctx: RequestContext, courseId: string, file: File): Promise<AdminCourse>;

  listCategories(ctx: RequestContext): Promise<CourseCategory[]>;
  createCategory(ctx: RequestContext, name: string): Promise<CourseCategory>;
  renameCategory(ctx: RequestContext, categoryId: string, name: string): Promise<CourseCategory>;
  deleteCategory(ctx: RequestContext, categoryId: string): Promise<void>;

  /** Matrícula con activación manual: pendiente → activa (pago confirmado) o retirada. */
  listEnrollments(ctx: RequestContext, filters: EnrollmentFilters): Promise<Page<Enrollment>>;
  listOfferingSeats(ctx: RequestContext): Promise<OfferingSeats[]>;
  enroll(ctx: RequestContext, input: { studentUserId: string; courseOfferingId: string; paymentNote?: string }): Promise<Enrollment>;
  activateEnrollment(ctx: RequestContext, enrollmentId: string, paymentNote?: string): Promise<Enrollment>;
  withdrawEnrollment(ctx: RequestContext, enrollmentId: string): Promise<Enrollment>;

  /** Grupos de un curso (SCRUM-41). null si el curso no existe. */
  listOfferings(ctx: RequestContext, courseId: string): Promise<CourseOffering[] | null>;
  getOffering(ctx: RequestContext, courseId: string, offeringId: string): Promise<CourseOffering | null>;
  createOffering(ctx: RequestContext, courseId: string, input: SaveOfferingInput): Promise<CourseOffering>;
  updateOffering(ctx: RequestContext, courseId: string, offeringId: string, input: SaveOfferingInput): Promise<CourseOffering>;
  publishOffering(ctx: RequestContext, courseId: string, offeringId: string): Promise<CourseOffering>;
  assignInstructors(ctx: RequestContext, courseId: string, offeringId: string, instructorIds: string[]): Promise<CourseOffering>;
  updateSessionLink(ctx: RequestContext, courseId: string, offeringId: string, sessionId: string, virtualLink: string | null): Promise<CourseOffering>;

  listInstructors(ctx: RequestContext): Promise<Instructor[]>;
  createInstructor(ctx: RequestContext, input: NewGuardianInput): Promise<CreatedInstructor>;
}

export interface Services {
  auth: AuthService;
  students: StudentService;
  notifications: NotificationService;
  lessons: LessonService;
  tutor: TutorService;
  assessments: AssessmentService;
  schedule: ScheduleService;
  family: FamilyService;
  admin: AdminService;
}
