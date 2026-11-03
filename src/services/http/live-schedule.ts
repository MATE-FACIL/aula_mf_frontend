import { addDaysToKey, formatTime, localDateKey, weekdayOfKey, zonedDateTime } from '@/lib/time';
import type { CalendarEvent, LiveClass } from '@/types/domain';

// Clases reales del alumno (SCRUM-50/51/52): conversión de `GET /students/me/classes` al formato de las pantallas.
// Puro (sin red ni `server-only`): se prueba con Vitest.

export interface StudentClassDto {
  sessionId: string;
  offeringId: string;
  courseTitle: string;
  offeringName: string;
  categoryName: string | null;
  startsAt: string;
  endsAt: string;
  virtualLink: string | null;
  teachers: string[];
}

/** Rango que se pide al backend: desde el lunes de esta semana hasta 5 semanas después. */
export const SCHEDULE_WEEKS = 5;
/** En «Inicio» se muestran solo las próximas clases. */
export const DASHBOARD_CLASSES = 3;

const LAB_RE = /lab|program|robl|intelig|\bia\b|digital|tecno/i;

export function weekStartOf(now: number, timeZone: string): string {
  const today = localDateKey(new Date(now), timeZone);
  return addDaysToKey(today, -((weekdayOfKey(today) + 6) % 7));
}

export function scheduleRange(now: number, timeZone: string): { from: string; to: string; weekStart: string } {
  const weekStart = weekStartOf(now, timeZone);
  return {
    weekStart,
    from: zonedDateTime(weekStart, 0, 0, timeZone).toISOString(),
    to: zonedDateTime(addDaysToKey(weekStart, SCHEDULE_WEEKS * 7), 0, 0, timeZone).toISOString(),
  };
}

export function toLiveClass(dto: StudentClassDto): LiveClass {
  return {
    id: dto.sessionId,
    startsAt: dto.startsAt,
    durationMin: Math.max(1, Math.round((Date.parse(dto.endsAt) - Date.parse(dto.startsAt)) / 60_000)),
    course: dto.courseTitle,
    topic: dto.offeringName,
    teacher: dto.teachers.join(', ') || 'Profesor por confirmar',
    track: LAB_RE.test(`${dto.categoryName ?? ''} ${dto.courseTitle}`) ? 'lab' : 'math',
    joinUrl: dto.virtualLink,
  };
}

export function calendarFrom(classes: LiveClass[], timeZone: string): CalendarEvent[] {
  return classes.map((c) => ({
    date: localDateKey(c.startsAt, timeZone),
    time: formatTime(c.startsAt, timeZone),
    label: c.course,
    kind: c.track,
  }));
}

/** Las que aún no terminan, en orden: para «Inicio». */
export function upcoming(classes: LiveClass[], now: number, limit = DASHBOARD_CLASSES): LiveClass[] {
  return classes.filter((c) => Date.parse(c.startsAt) + c.durationMin * 60_000 > now).slice(0, limit);
}
