import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { addDaysToKey, formatDayNumber, formatShortWeekday, formatTime, formatWeekdayDay, localDateKey, zonedDateTime } from '@/lib/time';
import type { AttendanceRecord, AttendanceSummary, CalendarEvent, LiveClass } from '@/types/domain';
import { LiveClasses, type LiveClassView } from './live-classes';
import styles from './schedule.module.css';

// Piezas de agenda que se resuelven en el servidor (formato de fecha en la zona de la familia).

const zoneLabel = (timeZone: string) => (timeZone === 'America/Lima' ? 'hora de Perú' : timeZone.split('/').pop()?.replace('_', ' ') ?? timeZone);

export function LiveClassesSection({ classes, timeZone, now, limit }: { classes: LiveClass[]; timeZone: string; now: number; limit?: number }) {
  const views: LiveClassView[] = classes.slice(0, limit).map((c) => {
    const start = new Date(c.startsAt).getTime();
    return {
      id: c.id,
      startsAtMs: start,
      endsAtMs: start + c.durationMin * 60_000,
      dayLabel: formatWeekdayDay(c.startsAt, timeZone),
      timeLabel: formatTime(c.startsAt, timeZone),
      zoneLabel: zoneLabel(timeZone),
      course: c.course,
      topic: c.topic,
      teacher: c.teacher,
      joinUrl: c.joinUrl,
    };
  });
  return <LiveClasses classes={views} serverNow={now} />;
}

export function WeekCalendar({ weekStart, events, timeZone, now }: { weekStart: string; events: CalendarEvent[]; timeZone: string; now: number }) {
  const today = localDateKey(new Date(now), timeZone);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const monthLabel = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone }).format(zonedDateTime(weekStart, 12, 0, timeZone));

  return (
    <div className={styles.calendar}>
      <p className={styles.calendarZone}>
        <span className={styles.capitalize}>{monthLabel}</span> · horario en {zoneLabel(timeZone)} <small>(cada familia ve su hora local)</small>
      </p>
      <ol role="list" className={styles.week}>
        {days.map((day) => {
          const noon = zonedDateTime(day, 12, 0, timeZone);
          return (
            <li key={day} className={cn(day === today && styles.today)} aria-current={day === today ? 'date' : undefined}>
              <span className={styles.day}>{formatShortWeekday(noon, timeZone)} <b>{formatDayNumber(noon, timeZone)}</b></span>
              {events.filter((e) => e.date === day).map((e) => (
                <span key={`${e.date}-${e.label}`} className={cn(styles.event, styles[`event_${e.kind}`])}>
                  <b>{e.time}</b>
                  {e.label}
                </span>
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ATTENDANCE_LABEL = { present: 'Asistió', late: 'Tarde', absent: 'Faltó' } as const;

/** Con `summary` (datos reales) los totales cubren todas las clases; sin él se calculan de la lista. */
export function AttendanceList({ records, summary }: { records: AttendanceRecord[]; summary?: AttendanceSummary | null }) {
  const attended = summary ? summary.present + summary.late : records.filter((r) => r.status !== 'absent').length;
  const total = summary ? summary.total : records.length;
  const pct = summary ? (summary.rate ?? 0) : total ? Math.round((attended / total) * 100) : 0;
  if (total === 0) return <p className={styles.attNote}>Todavía no hay clases con asistencia registrada.</p>;
  return (
    <div className={styles.attendance}>
      <div className={styles.attendanceSummary}>
        <b>{attended} de {total} clases</b>
        <span>{pct} % de asistencia{summary ? '' : ' en las últimas semanas'}</span>
        <ProgressBar value={pct} color="var(--ok)" label="Asistencia" />
      </div>
      <ol role="list" className={styles.attendanceList}>
        {records.map((r) => (
          <li key={r.id} className={styles[`att_${r.status}`]}>
            <span className={styles.attDate}>{r.dateLabel}</span>
            <span>{r.course}</span>
            <span className={styles.attStatus}>{ATTENDANCE_LABEL[r.status]}</span>
            {r.note && <small>{r.note}</small>}
          </li>
        ))}
      </ol>
      <p className={styles.attNote}>La registra el profesor en cada clase; «tarde» cuenta como asistencia.</p>
    </div>
  );
}
