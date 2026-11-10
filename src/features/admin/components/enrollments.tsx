import Link from 'next/link';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/time';
import type { Enrollment, EnrollmentStatus, EnrollmentTransfer, OfferingSeats } from '@/types/admin';
import { activateEnrollmentAction, enrollAction, transferEnrollmentAction, withdrawEnrollmentAction } from '../actions';
import { ENROLLMENT_STATUS_LABEL } from '../format';
import { ActionForm, SubmitButton } from './action-form';
import styles from './admin.module.css';
import { GroupOptions, seatsLabel } from './placement';

export { seatsLabel };

// Matrícula con activación manual (SCRUM-44): pendiente → activa (pago confirmado) o retirada.
// Componentes de servidor; los botones son formularios con Server Actions (funcionan sin JavaScript).

const STATUS_STYLE: Record<EnrollmentStatus, string> = {
  pending: styles.status_no_account,
  active: styles.status_active,
  withdrawn: styles.status_inactive,
};

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  return <span className={cn(styles.badge, STATUS_STYLE[status])}>{ENROLLMENT_STATUS_LABEL[status]}</span>;
}

/** Para poder cambiar de grupo: los grupos entre los que elegir y, si se conoce, cuáles recomienda el diagnóstico. */
export interface MoveOptions {
  offerings: OfferingSeats[];
  recommendedIds?: ReadonlySet<string>;
  /** Grupos donde el alumno ya tiene matrícula viva (solo se conocen en su ficha). */
  heldIds?: ReadonlySet<string>;
}

/** Cambio de grupo (SCRUM-45): el backend valida el cupo del destino y deja el cambio registrado. */
function MoveForm({ enrollment, move }: { enrollment: Enrollment; move: MoveOptions }) {
  if (move.offerings.every((offering) => offering.id === enrollment.courseOfferingId)) return null;
  return (
    <details className={styles.move}>
      <summary className="btn btn--sm">Cambiar de grupo</summary>
      <ActionForm action={transferEnrollmentAction} className={styles.moveForm}>
        <input type="hidden" name="enrollmentId" value={enrollment.id} />
        <label className="label">
          Grupo de destino
          <select className="input" name="courseOfferingId" required defaultValue="" aria-label={`Grupo de destino de ${enrollment.studentName}`}>
            <option value="" disabled>Elige curso y grupo…</option>
            <GroupOptions offerings={move.offerings} recommendedIds={move.recommendedIds} heldIds={move.heldIds} excludeId={enrollment.courseOfferingId} />
          </select>
        </label>
        <label className="label">
          Motivo (opcional)
          <input className="input" name="reason" maxLength={300} placeholder="Ej.: el diagnóstico confirmó Básico" aria-label={`Motivo del cambio de ${enrollment.studentName}`} />
        </label>
        <SubmitButton className="btn--sm btn--primary" pendingLabel="Cambiando…">Pasar al grupo elegido</SubmitButton>
      </ActionForm>
    </details>
  );
}

function EnrollmentActions({ enrollment, move }: { enrollment: Enrollment; move?: MoveOptions }) {
  if (enrollment.status === 'withdrawn') return null;
  return (
    <span className={styles.actions}>
      {enrollment.status === 'pending' && (
        <ActionForm action={activateEnrollmentAction}>
          <input type="hidden" name="enrollmentId" value={enrollment.id} />
          <input className="input" name="paymentNote" maxLength={300} placeholder="Pago: Yape, op. 123…" aria-label={`Nota de pago de ${enrollment.studentName}`} defaultValue={enrollment.paymentNote ?? ''} />
          <SubmitButton className="btn--sm btn--primary" pendingLabel="Activando…">Confirmar pago y activar</SubmitButton>
        </ActionForm>
      )}
      {move && <MoveForm enrollment={enrollment} move={move} />}
      <ActionForm action={withdrawEnrollmentAction} confirmMessage={`¿Retirar a ${enrollment.studentName} de «${enrollment.offeringName}»? Su cupo quedará libre.`}>
        <input type="hidden" name="enrollmentId" value={enrollment.id} />
        <SubmitButton className="btn--sm" pendingLabel="Retirando…">Retirar</SubmitButton>
      </ActionForm>
    </span>
  );
}

function History({ enrollment, timeZone, movedTo }: { enrollment: Enrollment; timeZone: string; movedTo?: EnrollmentTransfer }) {
  const by = (name: string | null) => (name ? ` por ${name}` : '');
  return (
    <span className={styles.sub}>
      Registrada {formatShortDate(enrollment.createdAt, timeZone)}{by(enrollment.createdByName)}
      {enrollment.activatedAt && <> · activada {formatShortDate(enrollment.activatedAt, timeZone)}{by(enrollment.activatedByName)}</>}
      {movedTo
        ? <> · cambió a «{movedTo.toOfferingName}» el {formatShortDate(movedTo.transferredAt, timeZone)}{by(movedTo.transferredByName)}</>
        : enrollment.withdrawnAt && <> · retirada {formatShortDate(enrollment.withdrawnAt, timeZone)}{by(enrollment.withdrawnByName)}</>}
    </span>
  );
}

interface TableProps {
  enrollments: Enrollment[];
  timeZone: string;
  /** En la ficha del alumno no hace falta repetir su nombre. */
  showStudent?: boolean;
  empty?: string;
  /** Si se pasa, cada matrícula viva ofrece «Cambiar de grupo». */
  move?: MoveOptions;
  /** Cambios ya hechos, por matrícula de origen: su fila dice «cambió a…» en vez de «retirada». */
  transfersByFrom?: ReadonlyMap<string, EnrollmentTransfer>;
}

export function EnrollmentsTable({ enrollments, timeZone, showStudent = true, empty = 'No hay matrículas con esos filtros.', move, transfersByFrom }: TableProps) {
  if (enrollments.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {showStudent && <th scope="col">Alumno</th>}
            <th scope="col">Curso y grupo</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id}>
              {showStudent && (
                <td data-label="">
                  <Link href={`/admin/usuarios/${enrollment.studentUserId}`}>{enrollment.studentName}</Link>
                  {enrollment.studentDocument && <span className={styles.sub}>Doc. {enrollment.studentDocument}</span>}
                </td>
              )}
              <td data-label="Curso y grupo">
                <span>
                  {enrollment.courseTitle}
                  <span className={styles.sub}>{enrollment.offeringName}</span>
                </span>
              </td>
              <td data-label="Estado">
                <span>
                  <EnrollmentBadge status={enrollment.status} />
                  {enrollment.paymentNote && <span className={styles.sub}>{enrollment.paymentNote}</span>}
                  <History enrollment={enrollment} timeZone={timeZone} movedTo={transfersByFrom?.get(enrollment.id)} />
                </span>
              </td>
              <td data-label=""><EnrollmentActions enrollment={enrollment} move={move} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Matricular a un alumno: los grupos en borrador, llenos o donde ya está matriculado aparecen deshabilitados. */
export function EnrollForm({ studentUserId, offerings, enrolledOfferingIds, recommendedIds }: {
  studentUserId: string;
  offerings: OfferingSeats[];
  enrolledOfferingIds: Set<string>;
  /** Grupos del nivel que confirmó el diagnóstico: aparecen primero. */
  recommendedIds?: ReadonlySet<string>;
}) {
  if (offerings.length === 0) {
    return <EmptyState>Todavía no hay grupos. Crea una edición del curso para poder matricular.</EmptyState>;
  }
  return (
    <ActionForm action={enrollAction} className={styles.filters}>
      <input type="hidden" name="studentUserId" value={studentUserId} />
      <label className={cn('label', styles.grow)}>
        Grupo
        <select className="input" name="courseOfferingId" required defaultValue="">
          <option value="" disabled>Elige curso y grupo…</option>
          <GroupOptions offerings={offerings} recommendedIds={recommendedIds} heldIds={enrolledOfferingIds} />
        </select>
      </label>
      <label className="label">
        Nota de pago (opcional)
        <input className="input" name="paymentNote" maxLength={300} placeholder="Yape, Plin o transferencia…" />
      </label>
      <SubmitButton className="btn--primary" pendingLabel="Matriculando…">Matricular</SubmitButton>
    </ActionForm>
  );
}
