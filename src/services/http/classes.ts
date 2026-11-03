import 'server-only';
import { apiRequest, query } from '@/lib/http/api-client';
import type { RequestContext, Schedule } from '../contracts';
import { calendarFrom, scheduleRange, toLiveClass, type StudentClassDto } from './live-schedule';

/**
 * Clases en vivo reales del alumno (SCRUM-50/51/52): UNA petición por pantalla. El backend solo devuelve
 * clases de grupos publicados con matrícula ACTIVA, desde el lunes de esta semana hasta 5 semanas después.
 */
export async function fetchLiveSchedule(ctx: RequestContext, now = Date.now()): Promise<Pick<Schedule, 'classes' | 'calendar' | 'weekStart'>> {
  const timeZone = ctx.user.timeZone;
  const { from, to, weekStart } = scheduleRange(now, timeZone);
  const dtos = await apiRequest<StudentClassDto[]>(`/students/me/classes${query({ from, to })}`, { token: ctx.token });
  const classes = dtos.map(toLiveClass);
  return { classes, calendar: calendarFrom(classes, timeZone), weekStart };
}
