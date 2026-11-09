// Panel del profesor (SCRUM-69/70). Mismas formas que `GET /teachers/me/groups` de la API .NET.
import type { AttendanceSummary } from './domain';
import type { PracticeProgress } from './practice';

/** Un grupo asignado al profesor de la sesión. */
export interface TeacherGroup {
  offeringId: string;
  courseId: string;
  courseTitle: string;
  offeringName: string;
  isPublished: boolean;
  activeStudents: number;
  maximumCapacity: number;
  sessions: number;
  nextSessionId: string | null;
  nextSessionStartsAt: string | null;
}

/** Una clase del grupo con su asistencia contada (marked = asistió + tarde + faltó). */
export interface TeacherSession {
  sessionId: string;
  number: number;
  startsAt: string;
  endsAt: string;
  virtualLink: string | null;
  present: number;
  late: number;
  absent: number;
  marked: number;
}

/** Un alumno del grupo: su asistencia en el grupo y su avance de práctica en el curso. */
export interface TeacherStudent {
  studentUserId: string;
  fullName: string;
  attendance: AttendanceSummary;
  practice: PracticeProgress;
}

export interface TeacherGroupDetail {
  group: TeacherGroup;
  sessions: TeacherSession[];
  students: TeacherStudent[];
}
