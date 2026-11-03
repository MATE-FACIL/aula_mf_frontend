import { addDaysToKey, weekdayOfKey, zonedDateTime } from '@/lib/time';

// Generador del calendario de un grupo (SCRUM-41/42): fecha de inicio + días de la semana + hora local
// + duración → sesiones en UTC (el backend exige offset cero). Puro y sin dependencias: se prueba con Vitest.

export const SCHEDULE_TIME_ZONE = 'America/Lima';
export const DEFAULT_SESSION_MINUTES = 60;
export const MAX_SESSIONS = 60;
/** Tope de búsqueda de días: evita bucles largos si los datos no tienen sentido. */
const MAX_DAYS_SCANNED = 366 * 2;

export const WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
] as const;

export interface ScheduleInput {
  /** AAAA-MM-DD en la zona horaria del grupo. */
  startDate: string;
  /** 0 = domingo … 6 = sábado. */
  weekdays: number[];
  /** HH:MM en la zona horaria del grupo. */
  time: string;
  durationMinutes: number;
  count: number;
  timeZone?: string;
}

export interface PlannedSession {
  startsAt: string;
  endsAt: string;
}

export type ScheduleResult = { ok: true; sessions: PlannedSession[] } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function generateSessions(input: ScheduleInput): ScheduleResult {
  const { startDate, time, durationMinutes, count, timeZone = SCHEDULE_TIME_ZONE } = input;
  const weekdays = new Set(input.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  const clock = TIME_RE.exec(time);

  if (!DATE_RE.test(startDate) || Number.isNaN(Date.parse(startDate))) return { ok: false, error: 'Elige la fecha de inicio.' };
  if (weekdays.size === 0) return { ok: false, error: 'Marca al menos un día de clase.' };
  if (!clock) return { ok: false, error: 'Escribe la hora de inicio (HH:MM).' };
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240) {
    return { ok: false, error: 'La duración debe estar entre 30 y 240 minutos.' };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_SESSIONS) {
    return { ok: false, error: `La cantidad de clases debe estar entre 1 y ${MAX_SESSIONS}.` };
  }

  const [hour, minute] = [Number(clock[1]), Number(clock[2])];
  const sessions: PlannedSession[] = [];
  for (let offset = 0; sessions.length < count && offset < MAX_DAYS_SCANNED; offset++) {
    const day = addDaysToKey(startDate, offset);
    if (!weekdays.has(weekdayOfKey(day))) continue;
    const starts = zonedDateTime(day, hour, minute, timeZone);
    sessions.push({ startsAt: starts.toISOString(), endsAt: new Date(starts.getTime() + durationMinutes * 60_000).toISOString() });
  }
  return { ok: true, sessions };
}

/** Duración en minutos de una sesión ya guardada (para mostrar y para prellenar). */
export function sessionMinutes(session: PlannedSession): number {
  return Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
}
