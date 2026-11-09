import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { RequestContext } from '../contracts';
import { toAttendance, type AttendanceReportDto, type StudentAttendance } from './attendance';

/** Asistencia del alumno de la sesión (SCRUM-53): UNA petición, totales y clases recientes. */
export async function fetchStudentAttendance(ctx: RequestContext): Promise<StudentAttendance> {
  return toAttendance(await apiRequest<AttendanceReportDto>('/students/me/attendance', { token: ctx.token }), ctx.user.timeZone);
}
