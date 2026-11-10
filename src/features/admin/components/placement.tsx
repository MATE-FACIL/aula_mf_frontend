import Link from 'next/link';
import { formatShortDate } from '@/lib/time';
import type { EnrollmentTransfer, OfferingSeats, Placement, PlacementDiagnostic } from '@/types/admin';
import styles from './admin.module.css';

// Asignación a grupo según el diagnóstico (SCRUM-45): qué dijo el diagnóstico del alumno, los grupos que conviene
// ofrecerle y los cambios de grupo ya hechos. Componentes de servidor (sin JavaScript en el navegador).

/** «5 de 8 cupos» con aviso cuando el grupo está lleno. */
export function seatsLabel(offering: Pick<OfferingSeats, 'freeSeats' | 'maximumCapacity' | 'takenSeats'>): string {
  return offering.freeSeats === 0
    ? `Lleno (${offering.maximumCapacity} de ${offering.maximumCapacity})`
    : `${offering.takenSeats} de ${offering.maximumCapacity} cupos`;
}

/** Un grupo se puede elegir si está publicado y le queda cupo. */
export const canJoin = (offering: OfferingSeats) => offering.isPublished && offering.freeSeats > 0;

function DiagnosticLine({ diagnostic }: { diagnostic: PlacementDiagnostic }) {
  const review = `/admin/diagnosticos/${diagnostic.attemptId}`;
  if (diagnostic.status === 'in_progress') {
    return (
      <li className={styles.listItem}>
        <span><b>{diagnostic.stageLabel}</b> · Diagnóstico en curso<span className={styles.sub}>Todavía no termina de responder.</span></span>
        <Link className="btn btn--sm" href={review}>Ver</Link>
      </li>
    );
  }
  if (diagnostic.confirmed) {
    return (
      <li className={styles.listItem}>
        <span>
          <b>{diagnostic.stageLabel}</b> · Nivel confirmado: <b>{diagnostic.confirmed.label}</b>
          <span className={styles.sub}>Los grupos de {diagnostic.stageLabel} · {diagnostic.confirmed.label} salen primero.</span>
        </span>
        <Link className="btn btn--sm" href={review}>Ver diagnóstico</Link>
      </li>
    );
  }
  return (
    <li className={styles.listItem}>
      <span>
        <b>{diagnostic.stageLabel}</b> · Terminado. Nivel sugerido: <b>{diagnostic.suggested?.label ?? '—'}</b>
        <span className={styles.sub}>Falta que el profesor confirme el nivel: hasta entonces no se recomienda ningún grupo.</span>
      </span>
      <Link className="btn btn--sm btn--primary" href={review}>Revisar y confirmar</Link>
    </li>
  );
}

export function PlacementSummary({ placement }: { placement: Placement }) {
  return (
    <div className="section" aria-labelledby="placement-title">
      <h3 id="placement-title">Ubicación según el diagnóstico</h3>
      {placement.diagnostics.length === 0 ? (
        <p className={styles.sub}>Todavía no rindió el diagnóstico de entrada. Puedes matricularlo igual, eligiendo el grupo a mano.</p>
      ) : (
        <ul className={styles.list} role="list">
          {placement.diagnostics.map((diagnostic) => <DiagnosticLine key={diagnostic.stage} diagnostic={diagnostic} />)}
        </ul>
      )}
    </div>
  );
}

/** Los cambios de grupo del alumno, del más reciente al más antiguo. */
export function TransferHistory({ transfers, timeZone }: { transfers: EnrollmentTransfer[]; timeZone: string }) {
  if (transfers.length === 0) return null;
  return (
    <div className="section" aria-labelledby="transfers-title">
      <h3 id="transfers-title">Cambios de grupo</h3>
      <ul className={styles.list} role="list">
        {transfers.map((transfer) => (
          <li key={transfer.id} className={styles.listItem}>
            <span>
              <b>{transfer.fromOfferingName}</b> → <b>{transfer.toOfferingName}</b>
              <span className={styles.sub}>
                {formatShortDate(transfer.transferredAt, timeZone)}{transfer.transferredByName ? ` · por ${transfer.transferredByName}` : ''}
                {transfer.reason ? ` · ${transfer.reason}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface OptionsProps {
  offerings: OfferingSeats[];
  /** Grupos del nivel que confirmó el diagnóstico: van primero, en su propio bloque. */
  recommendedIds?: ReadonlySet<string>;
  /** Grupos donde el alumno ya tiene matrícula viva. */
  heldIds?: ReadonlySet<string>;
  /** Un grupo que nunca se ofrece (el actual, al cambiar de grupo). */
  excludeId?: string;
}

/** Las opciones de un selector de grupos, con su cupo. Los borradores, llenos o ya matriculados quedan deshabilitados. */
export function GroupOptions({ offerings, recommendedIds, heldIds, excludeId }: OptionsProps) {
  const options = offerings.filter((offering) => offering.id !== excludeId);
  const render = (offering: OfferingSeats) => {
    const held = heldIds?.has(offering.id) ?? false;
    return (
      <option key={offering.id} value={offering.id} disabled={held || !canJoin(offering)}>
        {offering.courseTitle} · {offering.name} — {held ? 'ya matriculado' : offering.isPublished ? seatsLabel(offering) : 'en borrador'}
      </option>
    );
  };
  const recommended = options.filter((offering) => recommendedIds?.has(offering.id));
  if (recommended.length === 0) return <>{options.map(render)}</>;
  return (
    <>
      <optgroup label="Recomendados según el diagnóstico">{recommended.map(render)}</optgroup>
      <optgroup label="Otros grupos">{options.filter((offering) => !recommendedIds?.has(offering.id)).map(render)}</optgroup>
    </>
  );
}
