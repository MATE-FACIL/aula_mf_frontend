import Link from 'next/link';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatLongDate, formatShortWeekday, formatTime } from '@/lib/time';
import type { CourseOffering, Instructor, OfferingSeats } from '@/types/admin';
import { assignInstructorsAction, publishOfferingAction, updateSessionLinkAction } from '../actions';
import { SCHEDULE_TIME_ZONE, sessionMinutes } from '../schedule';
import { ActionForm, SubmitButton } from './action-form';
import styles from './admin.module.css';
import { seatsLabel } from './enrollments';

// Grupos (ediciones) de un curso — SCRUM-41. Componentes de servidor: sin JavaScript extra en el navegador.

const TZ = SCHEDULE_TIME_ZONE;

export function OfferingStatusBadge({ status }: { status: CourseOffering['status'] }) {
  return (
    <span className={cn(styles.badge, status === 'published' ? styles.status_active : styles.status_no_account)}>
      {status === 'published' ? 'Publicado' : 'Borrador'}
    </span>
  );
}

/** «Lun y Mié · 5:00 p. m. · 90 min» a partir de las sesiones (hora de Perú). */
export function scheduleSummary(offering: CourseOffering): string {
  if (offering.sessions.length === 0) return 'Sin horario';
  const days = [...new Set(offering.sessions.map((s) => formatShortWeekday(s.startsAt, TZ)))];
  const first = offering.sessions[0];
  return `${days.join(' y ')} · ${formatTime(first.startsAt, TZ)} · ${sessionMinutes(first)} min`;
}

export function OfferingList({ courseId, offerings, seats, instructors }: { courseId: string; offerings: CourseOffering[]; seats: OfferingSeats[]; instructors: Instructor[] }) {
  if (offerings.length === 0) return <EmptyState>Este curso todavía no tiene grupos. Crea el primero para poder matricular.</EmptyState>;
  const seatsById = new Map(seats.map((s) => [s.id, s]));
  const teacher = new Map(instructors.map((i) => [i.id, i.fullName]));
  return (
    <ul className={styles.list} role="list">
      {offerings.map((offering) => {
        const seat = seatsById.get(offering.id);
        return (
          <li key={offering.id} className={styles.listItem}>
            <span>
              <Link href={`/admin/cursos/${courseId}/grupos/${offering.id}`}><b>{offering.name}</b></Link>
              <span className={styles.sub}>
                {scheduleSummary(offering)} · {offering.sessions.length} clases · desde {offering.sessions[0] ? formatLongDate(offering.sessions[0].startsAt, TZ) : '—'}
              </span>
              <span className={styles.sub}>
                {offering.instructorIds.length ? offering.instructorIds.map((id) => teacher.get(id) ?? 'Profesor').join(', ') : 'Sin profesor asignado'}
              </span>
            </span>
            <span className={styles.badges}>
              <OfferingStatusBadge status={offering.status} />
              {seat && <span className={cn(styles.badge, seat.freeSeats === 0 ? styles.status_inactive : styles.status_active)}>{seatsLabel(seat)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function InstructorPicker({ courseId, offering, instructors }: { courseId: string; offering: CourseOffering; instructors: Instructor[] }) {
  if (instructors.length === 0) {
    return <EmptyState>No hay profesores. <Link className="link" href="/admin/usuarios/nuevo?tipo=profesor">Crea el primero</Link>.</EmptyState>;
  }
  const assigned = new Set(offering.instructorIds);
  return (
    <ActionForm action={assignInstructorsAction} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="offeringId" value={offering.id} />
      <span className={styles.actions} role="group" aria-label="Profesores del grupo">
        {instructors.map((i) => (
          <label key={i.id} className={styles.inline}>
            <input type="checkbox" name="instructorIds" value={i.id} defaultChecked={assigned.has(i.id)} /> {i.fullName}
          </label>
        ))}
      </span>
      <SubmitButton className="btn--sm" pendingLabel="Guardando…">Guardar profesores</SubmitButton>
    </ActionForm>
  );
}

/** Requisitos del backend para publicar, mostrados antes de intentar. */
export function PublishOffering({ courseId, offering }: { courseId: string; offering: CourseOffering }) {
  if (offering.status === 'published') return null;
  const missing = [
    offering.instructorIds.length === 0 && 'asignar al menos un profesor',
    offering.sessions.length !== offering.plannedSessionCount && 'completar el horario',
    !offering.currencyCode && 'elegir la moneda',
  ].filter(Boolean);
  return (
    <ActionForm action={publishOfferingAction} confirmMessage="¿Publicar el grupo? Después solo se podrán cambiar los enlaces de las clases.">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="offeringId" value={offering.id} />
      <SubmitButton className="btn--primary" pendingLabel="Publicando…">Publicar grupo</SubmitButton>
      {missing.length > 0 && <span className={styles.hint}>Antes falta: {missing.join(', ')}.</span>}
    </ActionForm>
  );
}

/** Grupo publicado: el horario queda fijo y solo se edita el enlace de cada clase (Zoom/Meet). */
export function SessionLinks({ courseId, offering }: { courseId: string; offering: CourseOffering }) {
  return (
    <ol className={styles.list}>
      {offering.sessions.map((session, index) => (
        <li key={session.id} className={styles.listItem}>
          <span>
            <b>Clase {index + 1}</b>
            <span className={styles.sub}>{formatLongDate(session.startsAt, TZ)}, {formatTime(session.startsAt, TZ)} – {formatTime(session.endsAt, TZ)} (hora de Perú)</span>
          </span>
          <ActionForm action={updateSessionLinkAction}>
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="offeringId" value={offering.id} />
            <input type="hidden" name="sessionId" value={session.id} />
            <input className="input" type="url" name="virtualLink" defaultValue={session.virtualLink ?? ''} placeholder="https://…" aria-label={`Enlace de la clase ${index + 1}`} />
            <SubmitButton className="btn--sm" pendingLabel="…">Guardar</SubmitButton>
          </ActionForm>
        </li>
      ))}
    </ol>
  );
}
