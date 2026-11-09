// Tipos del panel de administración. Reflejan las respuestas JSON del backend .NET
// (módulo Administration: /admin/* y módulo Courses: /courses, /course-categories).

/** Códigos de rol del backend (catálogo de Authorization). */
export const BACKEND_ROLES = ['student', 'guardian', 'administrator', 'instructor'] as const;
export type BackendRole = (typeof BACKEND_ROLES)[number];

export type AccountStatus = 'active' | 'inactive' | 'no_account';

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string | null;
  documentNumber: string | null;
  /** Usuario (alumnos) o correo (familias y equipo) con el que ingresa. */
  loginIdentifier: string | null;
  roles: BackendRole[];
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  /** Hijos vinculados (si es padre/tutor) o tutores vinculados (si es alumno). */
  linkCount: number;
}

export interface AdminLinkedUser {
  id: string;
  fullName: string;
  loginIdentifier: string | null;
  status: AccountStatus;
}

export interface AdminUserDetail {
  id: string;
  givenNames: string;
  firstSurname: string;
  secondSurname: string | null;
  fullName: string;
  email: string | null;
  documentType: string | null;
  documentNumber: string | null;
  loginIdentifier: string | null;
  roles: BackendRole[];
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  students: AdminLinkedUser[];
  guardians: AdminLinkedUser[];
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminSummary {
  totalUsers: number;
  newUsersLast7Days: number;
  usersByRole: Partial<Record<BackendRole, number>>;
  recentUsers: AdminUserListItem[];
}

export interface UserListFilters {
  search?: string;
  role?: BackendRole;
  status?: Exclude<AccountStatus, 'no_account'>;
  page?: number;
  pageSize?: number;
}

export interface NewStudentInput {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string;
  email?: string;
  documentType: string;
  documentNumber: string;
  /** Vincula al alumno con este padre/tutor al crearlo. */
  guardianUserId?: string;
}

export interface NewGuardianInput {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string;
  email: string;
  documentType?: string;
  documentNumber?: string;
}

/** La contraseña inicial llega UNA sola vez: el backend solo guarda su hash. */
export interface IssuedCredentials {
  userId: string;
  loginIdentifier: string;
  initialPassword: string;
}

// ─── Cursos ────────────────────────────────────────────────────────────

export interface CourseCategory {
  id: string;
  name: string;
}

export interface AdminCourse {
  id: string;
  title: string;
  categoryId: string | null;
  isPublished: boolean;
  shortDescription: string | null;
  fullDescription: string | null;
  objectives: string | null;
  syllabus: string | null;
  targetAudience: string | null;
  prerequisites: string | null;
  coverUrl: string | null;
  coverOriginalFileName: string | null;
  /** Duración de cada clase en minutos (SCRUM-42). null = sin configurar (se usa 60). */
  sessionDurationMinutes: number | null;
}

export interface SaveCourseInput {
  title: string;
  categoryId: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  objectives: string | null;
  syllabus: string | null;
  targetAudience: string | null;
  prerequisites: string | null;
  sessionDurationMinutes: number | null;
}

// ─── Matrículas (SCRUM-44) ─────────────────────────────────────────────

export const ENROLLMENT_STATUSES = ['pending', 'active', 'withdrawn'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface Enrollment {
  id: string;
  studentUserId: string;
  studentName: string;
  studentDocument: string | null;
  courseOfferingId: string;
  courseTitle: string;
  offeringName: string;
  status: EnrollmentStatus;
  paymentNote: string | null;
  createdAt: string;
  createdByName: string | null;
  activatedAt: string | null;
  activatedByName: string | null;
  withdrawnAt: string | null;
  withdrawnByName: string | null;
}

/** Edición (grupo) con su cupo: los pendientes y activos ocupan lugar. */
export interface OfferingSeats {
  id: string;
  courseId: string;
  courseTitle: string;
  name: string;
  isPublished: boolean;
  maximumCapacity: number;
  takenSeats: number;
  freeSeats: number;
}

export interface EnrollmentFilters {
  courseOfferingId?: string;
  studentUserId?: string;
  status?: EnrollmentStatus;
  page?: number;
  pageSize?: number;
}

// ─── Grupos (ediciones) y profesores (SCRUM-41) ────────────────────────

export interface OfferingSession {
  id: string;
  startsAt: string;
  endsAt: string;
  virtualLink: string | null;
}

export interface CourseOffering {
  id: string;
  courseId: string;
  name: string;
  /** Solo los borradores se editan completos; publicados solo cambian el enlace de cada clase. */
  status: 'draft' | 'published';
  maximumCapacity: number;
  basePrice: number;
  currencyCode: string | null;
  plannedSessionCount: number;
  instructorIds: string[];
  sessions: OfferingSession[];
}

export interface SaveOfferingInput {
  name: string;
  maximumCapacity: number;
  basePrice: number;
  currencyCode: string;
  plannedSessionCount: number;
  /** `id` de las sesiones existentes que se conservan; null para las nuevas. */
  sessions: { id: string | null; startsAt: string; endsAt: string; virtualLink: string | null }[];
}

export interface Instructor {
  id: string;
  userId: string | null;
  fullName: string;
  email: string | null;
}

export interface CreatedInstructor {
  instructorId: string;
  userId: string;
  loginIdentifier: string;
  initialPassword: string;
}

// ─── Asistencia (SCRUM-53) ───────────────────────────────────────────

export type AttendanceMarkStatus = 'present' | 'late' | 'absent';

/** Un alumno en la lista de una clase. status null: sin marcar. enrolled false: dejó el grupo (se conserva su historial). */
export interface SessionAttendanceStudent {
  studentUserId: string;
  fullName: string;
  status: AttendanceMarkStatus | null;
  note: string | null;
  recordedAt: string | null;
  enrolled: boolean;
}

export interface SessionAttendance {
  sessionId: string;
  offeringId: string;
  courseTitle: string;
  offeringName: string;
  startsAt: string;
  endsAt: string;
  /** La asistencia se abre poco antes de empezar la clase. */
  opensAt: string;
  canMark: boolean;
  students: SessionAttendanceStudent[];
}

export interface AttendanceMark {
  studentUserId: string;
  status: AttendanceMarkStatus;
  note: string | null;
}
