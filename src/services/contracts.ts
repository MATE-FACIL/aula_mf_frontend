// Contratos de la capa de datos. Las pantallas y Server Actions dependen SOLO de estas interfaces;
// la implementación (mock en memoria o HTTP contra .NET) se elige en `services/index.ts`.
// Así se puede desarrollar el frontend sin backend y cambiar a la API real con una variable de entorno.

import type {
  AnswerCheck,
  AppNotification,
  AttendanceRecord,
  AttendanceSummary,
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
  AttendanceMark,
  CourseCategory,
  CourseOffering,
  CreatedInstructor,
  Enrollment,
  EnrollmentFilters,
  EnrollmentTransfer,
  Instructor,
  IssuedCredentials,
  MathLevel,
  NewGuardianInput,
  NewStudentInput,
  OfferingSeats,
  Page,
  Placement,
  ProvisionedLevels,
  SaveCourseInput,
  SaveOfferingInput,
  SessionAttendance,
  TransferFilters,
  UserListFilters,
} from '@/types/admin';
import type {
  DiagnosticAnswerResult,
  DiagnosticFilter,
  DiagnosticPage,
  DiagnosticReview,
  DiagnosticStage,
  DiagnosticStageSummary,
  StudentDiagnostic,
} from '@/types/diagnostic';
import type { FamilyConsent } from '@/types/consent';
import type { ContentLesson, ContentUnit, CourseContent, LessonPayload, UploadGrant, UploadKind } from '@/types/content';
import type { LessonPractice, PracticeAnswerResult, PracticeCourse } from '@/types/practice';
import type { TeacherGroup, TeacherGroupDetail } from '@/types/teacher';

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
  /** Totales reales del backend; null en datos de ejemplo. */
  attendanceSummary: AttendanceSummary | null;
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
  /** Consentimiento del padre para los datos de sus hijos (SCRUM-38): el texto vigente y cómo va cada hijo. */
  getConsent(ctx: RequestContext): Promise<FamilyConsent>;
  /** Acepta el texto vigente (`version`) por estos hijos: todos o ninguno. */
  acceptConsent(ctx: RequestContext, version: string, studentUserIds: string[]): Promise<FamilyConsent>;
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

  /**
   * Asignación a grupo (SCRUM-45). La ubicación ofrece los grupos de Matemáticas con su cupo, los del nivel que el
   * profesor confirmó en el diagnóstico primero. null si la persona no existe.
   */
  getPlacement(ctx: RequestContext, studentUserId: string): Promise<Placement | null>;
  /** Pasa al alumno a otro grupo: valida el cupo del destino, conserva el estado y deja el cambio registrado. */
  transferEnrollment(ctx: RequestContext, enrollmentId: string, input: { courseOfferingId: string; reason?: string }): Promise<EnrollmentTransfer>;
  listTransfers(ctx: RequestContext, filters: TransferFilters): Promise<Page<EnrollmentTransfer>>;

  /**
   * Contenido del curso (SCRUM-71): unidades con sus sesiones, video y materiales. Un video o un material es un
   * enlace https o un archivo ya subido (`fileId`). null si el curso no existe.
   */
  getCourseContent(ctx: RequestContext, courseId: string): Promise<CourseContent | null>;
  addUnit(ctx: RequestContext, courseId: string, title: string): Promise<ContentUnit>;
  renameUnit(ctx: RequestContext, courseId: string, unitId: string, title: string): Promise<ContentUnit>;
  /** Solo una unidad sin sesiones; con sesiones responde 409. */
  deleteUnit(ctx: RequestContext, courseId: string, unitId: string): Promise<void>;
  /** `ids`: TODAS las unidades, una vez cada una, en el orden nuevo. */
  reorderUnits(ctx: RequestContext, courseId: string, ids: string[]): Promise<CourseContent>;
  addLesson(ctx: RequestContext, courseId: string, unitId: string, input: LessonPayload): Promise<ContentLesson>;
  /** Con otro `unitId` la sesión pasa al final de esa unidad. */
  updateLesson(ctx: RequestContext, courseId: string, lessonId: string, unitId: string, input: LessonPayload): Promise<ContentLesson>;
  deleteLesson(ctx: RequestContext, courseId: string, lessonId: string): Promise<void>;
  reorderLessons(ctx: RequestContext, courseId: string, unitId: string, ids: string[]): Promise<CourseContent>;
  /** Permiso para subir un archivo directo al almacenamiento. La sesión tiene que existir antes. */
  grantLessonUpload(ctx: RequestContext, courseId: string, lessonId: string, request: { kind: UploadKind; contentType: string; size: number }): Promise<UploadGrant>;

  /** Grupos de un curso (SCRUM-41). null si el curso no existe. */
  listOfferings(ctx: RequestContext, courseId: string): Promise<CourseOffering[] | null>;
  getOffering(ctx: RequestContext, courseId: string, offeringId: string): Promise<CourseOffering | null>;
  createOffering(ctx: RequestContext, courseId: string, input: SaveOfferingInput): Promise<CourseOffering>;
  updateOffering(ctx: RequestContext, courseId: string, offeringId: string, input: SaveOfferingInput): Promise<CourseOffering>;
  publishOffering(ctx: RequestContext, courseId: string, offeringId: string): Promise<CourseOffering>;
  assignInstructors(ctx: RequestContext, courseId: string, offeringId: string, instructorIds: string[]): Promise<CourseOffering>;
  updateSessionLink(ctx: RequestContext, courseId: string, offeringId: string, sessionId: string, virtualLink: string | null): Promise<CourseOffering>;

  // Niveles de Matemáticas (SCRUM-39): crear los que faltan se puede repetir sin duplicar nada.
  listMathLevels(ctx: RequestContext): Promise<MathLevel[]>;
  provisionMathLevels(ctx: RequestContext): Promise<ProvisionedLevels>;

  // Asistencia de una clase (SCRUM-53): la lista se guarda completa en una sola petición.
  getSessionAttendance(ctx: RequestContext, sessionId: string): Promise<SessionAttendance | null>;
  markAttendance(ctx: RequestContext, sessionId: string, records: AttendanceMark[]): Promise<SessionAttendance>;

  listInstructors(ctx: RequestContext): Promise<Instructor[]>;
  createInstructor(ctx: RequestContext, input: NewGuardianInput): Promise<CreatedInstructor>;
}

/**
 * Práctica real del alumno (SCRUM-59/60/61): ejercicios de las lecciones publicadas de sus cursos con matrícula
 * ACTIVA. El servidor corrige y guarda cada intento; la respuesta correcta nunca viaja al navegador.
 */
export interface PracticeService {
  listCourses(ctx: RequestContext): Promise<PracticeCourse[]>;
  /** null si la lección no existe, está en borrador o el alumno no tiene matrícula activa en su curso. */
  getLesson(ctx: RequestContext, lessonId: string): Promise<LessonPractice | null>;
  /** `answer`: el índice de la opción («0», «1»…) o el número escrito por el alumno. */
  answer(ctx: RequestContext, exerciseId: string, answer: string): Promise<PracticeAnswerResult>;
}

/** Panel del profesor (SCRUM-69/70): solo sus grupos asignados. */
export interface TeacherService {
  listGroups(ctx: RequestContext): Promise<TeacherGroup[]>;
  /** null si el grupo no está asignado al profesor. */
  getGroup(ctx: RequestContext, offeringId: string): Promise<TeacherGroupDetail | null>;
  getSessionAttendance(ctx: RequestContext, sessionId: string): Promise<SessionAttendance | null>;
  markAttendance(ctx: RequestContext, sessionId: string, records: AttendanceMark[]): Promise<SessionAttendance>;
  /** «Asistencia en un clic»: quienes no tienen marca quedan presentes; lo ya marcado no cambia. */
  markRemainingPresent(ctx: RequestContext, sessionId: string): Promise<SessionAttendance>;
}

/**
 * Diagnóstico de entrada (SCRUM-48/49): el alumno lo rinde una vez por etapa y recibe el resultado por tema y un
 * nivel sugerido; el profesor (o el administrador) revisa cada respuesta y confirma el nivel.
 */
export interface DiagnosticService {
  overview(ctx: RequestContext): Promise<DiagnosticStageSummary[]>;
  /** Empieza el de la etapa o devuelve el que ya existe (también si ya terminó). */
  start(ctx: RequestContext, stage: DiagnosticStage): Promise<StudentDiagnostic>;
  /** null si no existe o es de otro alumno. */
  get(ctx: RequestContext, attemptId: string): Promise<StudentDiagnostic | null>;
  /** `skip`: «No lo sé» (cuenta como incorrecta). */
  answer(ctx: RequestContext, attemptId: string, questionId: string, answer: string | null, skip: boolean): Promise<DiagnosticAnswerResult>;
  listReviews(ctx: RequestContext, filter: DiagnosticFilter, page: number): Promise<DiagnosticPage>;
  /** null si no existe. */
  getReview(ctx: RequestContext, attemptId: string): Promise<DiagnosticReview | null>;
  confirm(ctx: RequestContext, attemptId: string, level: string): Promise<DiagnosticReview>;
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
  practice: PracticeService;
  teacher: TeacherService;
  diagnostic: DiagnosticService;
}
