import Link from 'next/link';
import { EmptyState, ProgressBar } from '@/components/ui/primitives';
import admin from '@/features/admin/components/admin.module.css';
import { SCHEDULE_TIME_ZONE } from '@/features/admin/schedule';
import { progressLabel } from '@/features/practice/answer';
import { cn } from '@/lib/cn';
import { formatShortDate, formatShortWeekday, formatTime, formatWeekdayDay } from '@/lib/time';
import type { TeacherGroup, TeacherGroupDetail, TeacherSession } from '@/types/teacher';
import styles from './teacher.module.css';

// Pantallas del profesor (SCRUM-70): sus grupos, las clases con la asistencia y sus alumnos con asistencia y avance
// de práctica. Componentes de servidor (sin JavaScript en el navegador). Las horas, en la de Perú, como el horario.

const tz = SCHEDULE_TIME_ZONE;
const when = (iso: string) => `${formatShortWeekday(iso, tz)} ${formatShortDate(iso, tz)} · ${formatTime(iso, tz)}`;

export const groupHref = (offeringId: string) => `/profesor/grupos/${offeringId}`;
export const classHref = (offeringId: string, sessionId: string, number: number) => `${groupHref(offeringId)}/clases/${sessionId}?n=${number}`;

export function GroupCards({ groups }: { groups: TeacherGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState>Todavía no tienes grupos asignados. Cuando el equipo te asigne uno, aparecerá aquí.</EmptyState>;
  }
  return (
    <ul className={styles.groups}>
      {groups.map((g) => (
        <li key={g.offeringId}>
          <Link className={cn('card', styles.group)} href={groupHref(g.offeringId)}>
            <span className={styles.course}>{g.courseTitle}</span>
            <b className={styles.groupName}>{g.offeringName}</b>
            {!g.isPublished && <span className={cn(admin.badge, styles.draft)}>Borrador</span>}
            <span className={styles.meta}>
              <span><b>{g.activeStudents}</b> de {g.maximumCapacity} alumnos</span>
              <span><b>{g.sessions}</b> {g.sessions === 1 ? 'clase' : 'clases'}</span>
            </span>
            <span className={styles.next}>
              {g.nextSessionStartsAt ? <>Próxima clase: <b>{formatWeekdayDay(g.nextSessionStartsAt, tz)}, {formatTime(g.nextSessionStartsAt, tz)}</b></> : 'Sin clases pendientes'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SessionState({ session, activeStudents, now }: { session: TeacherSession; activeStudents: number; now: number }) {
  if (Date.parse(session.startsAt) - 15 * 60_000 > now) return <span className={styles.muted}>Aún no empieza</span>;
  if (session.marked === 0) return <span className={cn(admin.badge, styles.pending)}>Por tomar</span>;
  const missing = Math.max(0, activeStudents - session.marked);
  return (
    <span className={styles.tally}>
      <span title="Asistió">✔ {session.present}</span>
      <span title="Tarde">⏱ {session.late}</span>
      <span title="Faltó">✖ {session.absent}</span>
      {missing > 0 && <span className={styles.missing}>{missing} sin marcar</span>}
    </span>
  );
}

export function SessionsTable({ detail, now }: { detail: TeacherGroupDetail; now: number }) {
  const { group, sessions } = detail;
  if (sessions.length === 0) return <EmptyState>Este grupo todavía no tiene clases programadas.</EmptyState>;
  return (
    <div className={admin.tableWrap}>
      <table className={admin.table}>
        <thead>
          <tr><th>Clase</th><th>Fecha (hora de Perú)</th><th>Asistencia</th><th><span className="visually-hidden">Acciones</span></th></tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const open = Date.parse(s.startsAt) - 15 * 60_000 <= now;
            return (
              <tr key={s.sessionId} className={s.sessionId === group.nextSessionId ? styles.nextRow : undefined}>
                <td data-label="Clase"><b>Clase {s.number}</b>{s.sessionId === group.nextSessionId && <span className={styles.nextTag}>Próxima</span>}</td>
                <td data-label="Fecha">{when(s.startsAt)} – {formatTime(s.endsAt, tz)}</td>
                <td data-label="Asistencia"><SessionState session={s} activeStudents={group.activeStudents} now={now} /></td>
                <td data-label="">
                  <span className={admin.actions}>
                    {open && (
                      <Link className={cn('btn btn--sm', s.marked === 0 && 'btn--primary')} href={classHref(group.offeringId, s.sessionId, s.number)}>
                        {s.marked === 0 ? 'Tomar asistencia' : 'Ver o corregir'}<span className="visually-hidden"> de la clase {s.number}</span>
                      </Link>
                    )}
                    {s.virtualLink && Date.parse(s.endsAt) > now && (
                      <a className="btn btn--sm" href={s.virtualLink} target="_blank" rel="noreferrer">Abrir enlace<span className="visually-hidden"> de la clase {s.number}</span></a>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StudentsTable({ detail }: { detail: TeacherGroupDetail }) {
  if (detail.students.length === 0) return <EmptyState>Este grupo todavía no tiene alumnos con matrícula activa.</EmptyState>;
  return (
    <div className={admin.tableWrap}>
      <table className={admin.table}>
        <thead>
          <tr><th>Alumno</th><th>Asistencia</th><th>Práctica</th></tr>
        </thead>
        <tbody>
          {detail.students.map((s) => (
            <tr key={s.studentUserId}>
              <td data-label="Alumno"><b>{s.fullName}</b></td>
              <td data-label="Asistencia">
                {s.attendance.rate === null ? (
                  <span className={styles.muted}>Sin clases marcadas</span>
                ) : (
                  <span className={cn(styles.rate, s.attendance.rate < 75 && styles.low)}>
                    <b>{s.attendance.rate} %</b>
                    <small>{s.attendance.present + s.attendance.late} de {s.attendance.total}{s.attendance.late > 0 ? ` (${s.attendance.late} tarde)` : ''}</small>
                  </span>
                )}
              </td>
              <td data-label="Práctica">
                <span className={styles.practice}>
                  <ProgressBar value={s.practice.percent ?? 0} label={`Práctica de ${s.fullName}`} />
                  <small>{progressLabel(s.practice)}</small>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
