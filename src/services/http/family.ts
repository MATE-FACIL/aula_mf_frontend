import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { ChildOverview } from '@/types/domain';
import type { RequestContext } from '../contracts';
import { toAttendance, type AttendanceReportDto } from './attendance';
import { toChildOverview, type FamilyChildDto } from './family-children';

/**
 * Hijos del padre de la sesión y su asistencia: DOS peticiones en paralelo (una sola espera). El backend arma
 * ambas a partir de los vínculos del padre, sin ningún id de alumno que se pueda alterar.
 */
export async function fetchChildren(ctx: RequestContext): Promise<ChildOverview[]> {
  const [children, attendance] = await Promise.all([
    apiRequest<FamilyChildDto[]>('/families/me/children', { token: ctx.token }),
    apiRequest<AttendanceReportDto[]>('/families/me/attendance', { token: ctx.token }),
  ]);
  const byStudent = new Map(attendance.map((report) => [report.studentUserId, toAttendance(report, ctx.user.timeZone)]));
  return children.map((child) => toChildOverview(child, byStudent.get(child.studentUserId)));
}
