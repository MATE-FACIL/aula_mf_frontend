import { formatShortDate, formatShortWeekday } from '@/lib/time';
import type { AttendanceRecord, AttendanceStatus, AttendanceSummary } from '@/types/domain';

// Asistencia real (SCRUM-53): conversión de `GET /students/me/attendance` y `GET /families/me/attendance`.
// Puro (sin red ni `server-only`): se prueba con Vitest.

export interface AttendanceReportDto {
  studentUserId: string;
  summary: AttendanceSummary;
  recent: {
    sessionId: string;
    courseTitle: string;
    offeringName: string;
    startsAt: string;
    status: AttendanceStatus;
    note: string | null;
  }[];
}

export interface StudentAttendance {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export const EMPTY_ATTENDANCE: StudentAttendance = {
  summary: { present: 0, late: 0, absent: 0, total: 0, rate: null },
  records: [],
};

/** La fecha se muestra en la zona horaria de quien mira (cada familia ve su hora local). */
export function toAttendance(dto: AttendanceReportDto, timeZone: string): StudentAttendance {
  return {
    summary: dto.summary,
    records: dto.recent.map((item) => ({
      id: item.sessionId,
      dateLabel: `${formatShortWeekday(item.startsAt, timeZone)} ${formatShortDate(item.startsAt, timeZone)}`,
      course: item.offeringName ? `${item.courseTitle} · ${item.offeringName}` : item.courseTitle,
      status: item.status,
      ...(item.note ? { note: item.note } : {}),
    })),
  };
}

