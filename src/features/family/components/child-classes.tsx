import { EmptyState } from '@/components/ui/primitives';
import { formatLongDate, formatTime } from '@/lib/time';
import type { ChildOverview } from '@/types/domain';
import styles from './family.module.css';

// Matrículas y próximas clases de un hijo (SCRUM-67/68). Componente de servidor: sin JavaScript en el navegador.

const ENROLLMENT_LABEL = { active: 'Activa', pending: 'Pendiente de pago' } as const;

export function ChildClasses({ child, timeZone }: { child: ChildOverview; timeZone: string }) {
  const { enrollments, upcomingClasses } = child;
  const hasPending = enrollments.some((e) => e.status === 'pending');

  return (
    <div className={styles.grid}>
      <article className={styles.cardF}>
        <h3>Matrículas</h3>
        {enrollments.length === 0 ? (
          <EmptyState>Todavía no tiene matrículas.</EmptyState>
        ) : (
          <ul role="list" className={styles.rows}>
            {enrollments.map((e) => (
              <li key={e.id}>
                <b>{e.courseTitle}</b>
                <small>{e.offeringName} · {ENROLLMENT_LABEL[e.status]}</small>
              </li>
            ))}
          </ul>
        )}
        {hasPending && <p className={styles.note}>Las clases de una matrícula pendiente aparecen cuando se confirma el pago.</p>}
      </article>

      <article className={styles.cardF}>
        <h3>Próximas clases</h3>
        {upcomingClasses.length === 0 ? (
          <EmptyState>No hay clases programadas por ahora.</EmptyState>
        ) : (
          <ul role="list" className={styles.rows}>
            {upcomingClasses.map((c) => (
              <li key={c.id}>
                <b>{formatLongDate(c.startsAt, timeZone)}, {formatTime(c.startsAt, timeZone)}</b>
                <small>{c.course} · {c.teacher}</small>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
