import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState, PageSkeleton, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { linkStudentAction, setUserActiveAction, unlinkStudentAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import styles from '@/features/admin/components/admin.module.css';
import { EnrollForm, EnrollmentsTable } from '@/features/admin/components/enrollments';
import { PlacementSummary, TransferHistory } from '@/features/admin/components/placement';
import { RoleBadges, StatusBadge } from '@/features/admin/components/users-table';
import { isUuid } from '@/features/admin/validation';
import { formatShortDate } from '@/lib/time';
import { requireSession, type Session } from '@/server/auth/dal';
import { services } from '@/services';
import type { AdminLinkedUser, AdminUserDetail } from '@/types/admin';

export const metadata: Metadata = { title: 'Ficha de usuario' };

const SEARCH_RESULTS = 8;

export default function UserDetailPage({ params, searchParams }: PageProps<'/admin/usuarios/[id]'>) {
  return (
    <div className="page">
      <Link className="link" href="/admin/usuarios">← Volver a usuarios</Link>
      <Suspense fallback={<PageSkeleton />}>
        <UserDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UserDetail({ params, searchParams }: PageProps<'/admin/usuarios/[id]'>) {
  const [ctx, { id }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id)) notFound();
  const user = await services.admin.getUser(ctx, id);
  if (!user) notFound();

  const tz = ctx.user.timeZone;
  const isGuardian = user.roles.includes('guardian');
  const isStudent = user.roles.includes('student');
  const search = typeof query.buscar === 'string' ? query.buscar.trim().slice(0, 100) : '';

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{user.fullName}</h1>
          <p className={styles.badges}><RoleBadges roles={user.roles} /> <StatusBadge status={user.status} /></p>
        </div>
        <StatusToggle user={user} isSelf={user.id === ctx.user.id} />
      </header>

      <div className="split">
        <section className="card section">
          <SectionTitle title="Datos" />
          <dl className={styles.facts}>
            <dt>Usuario</dt><dd className={styles.mono}>{user.loginIdentifier ?? 'Sin cuenta de acceso'}</dd>
            <dt>Correo</dt><dd>{user.email ?? '—'}</dd>
            <dt>Documento</dt><dd>{user.documentNumber ? `${user.documentType ?? ''} ${user.documentNumber}` : '—'}</dd>
            <dt>Registro</dt><dd>{formatShortDate(user.createdAt, tz)}</dd>
            <dt>Último ingreso</dt><dd>{user.lastLoginAt ? formatShortDate(user.lastLoginAt, tz) : 'Nunca ingresó'}</dd>
          </dl>
        </section>

        {isStudent && (
          <section className="card section">
            <SectionTitle title="Padres o tutores" />
            <LinkedList people={user.guardians} empty="Sin padre o tutor vinculado. Vincúlalo desde la ficha del padre." unlink={(guardian) => ({ guardianId: guardian.id, studentId: user.id })} />
          </section>
        )}
      </div>

      {isStudent && (
        <section className="card section">
          <SectionTitle title="Matrículas" />
          {/* Se carga aparte: la ficha no espera a la matrícula para mostrarse. */}
          <Suspense fallback={<Skeleton height="8rem" />}>
            <StudentEnrollments ctx={ctx} studentId={user.id} />
          </Suspense>
        </section>
      )}

      {isGuardian && (
        <section className="card section">
          <SectionTitle title={`Hijos vinculados (${user.students.length})`} action={<Link className="btn btn--sm" href={`/admin/usuarios/nuevo?tutor=${user.id}`}>+ Alumno nuevo para esta familia</Link>} />
          <LinkedList people={user.students} empty="Todavía no tiene hijos vinculados." unlink={(student) => ({ guardianId: user.id, studentId: student.id })} />
          <LinkExistingStudent ctx={ctx} guardian={user} search={search} />
        </section>
      )}
    </>
  );
}

function StatusToggle({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  if (user.status === 'no_account' || (isSelf && user.status === 'active')) return null;
  const activate = user.status === 'inactive';
  return (
    <ActionForm action={setUserActiveAction} confirmMessage={activate ? undefined : `¿Desactivar la cuenta de ${user.fullName}? Se cerrarán sus sesiones y no podrá ingresar.`}>
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="active" value={String(activate)} />
      <SubmitButton className={activate ? 'btn--primary' : styles.danger} pendingLabel={activate ? 'Activando…' : 'Desactivando…'}>
        {activate ? 'Activar cuenta' : 'Desactivar cuenta'}
      </SubmitButton>
    </ActionForm>
  );
}

function LinkedList({ people, empty, unlink }: { people: AdminLinkedUser[]; empty: string; unlink: (person: AdminLinkedUser) => { guardianId: string; studentId: string } }) {
  if (people.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className={styles.list} role="list">
      {people.map((person) => {
        const pair = unlink(person);
        return (
          <li key={person.id} className={styles.listItem}>
            <span>
              <Link href={`/admin/usuarios/${person.id}`}><b>{person.fullName}</b></Link>
              <span className={styles.sub}>{person.loginIdentifier ?? 'Sin cuenta'} · <StatusBadge status={person.status} /></span>
            </span>
            <ActionForm action={unlinkStudentAction} confirmMessage={`¿Quitar el vínculo con ${person.fullName}?`}>
              <input type="hidden" name="guardianId" value={pair.guardianId} />
              <input type="hidden" name="studentId" value={pair.studentId} />
              <SubmitButton className="btn--sm" pendingLabel="Quitando…">Quitar</SubmitButton>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}

async function LinkExistingStudent({ ctx, guardian, search }: { ctx: Session; guardian: AdminUserDetail; search: string }) {
  const linked = new Set(guardian.students.map((s) => s.id));
  // Solo se consulta si el administrador buscó algo: la ficha no paga una lista que nadie pidió.
  const results = search
    ? (await services.admin.listUsers(ctx, { search, role: 'student', page: 1, pageSize: SEARCH_RESULTS })).items.filter((s) => !linked.has(s.id))
    : [];

  return (
    <div className="section">
      <SectionTitle as="h3" title="Vincular un alumno existente" />
      <form className={styles.filters} role="search">
        <label className={`label ${styles.grow}`}>
          Buscar alumno
          <input className="input" type="search" name="buscar" defaultValue={search} placeholder="Nombre o documento del alumno" maxLength={100} />
        </label>
        <button className="btn btn--dark" type="submit">Buscar</button>
      </form>
      {search && results.length === 0 && <EmptyState>No hay alumnos sin vincular que coincidan con «{search}».</EmptyState>}
      {results.length > 0 && (
        <ul className={styles.list} role="list">
          {results.map((student) => (
            <li key={student.id} className={styles.listItem}>
              <span>
                <b>{student.fullName}</b>
                <span className={styles.sub}>{student.loginIdentifier ?? 'Sin cuenta'}{student.documentNumber ? ` · Doc. ${student.documentNumber}` : ''}</span>
              </span>
              <ActionForm action={linkStudentAction}>
                <input type="hidden" name="guardianId" value={guardian.id} />
                <input type="hidden" name="studentId" value={student.id} />
                <SubmitButton className="btn--sm btn--primary" pendingLabel="Vinculando…">Vincular</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STUDENT_ENROLLMENTS = 50;

async function StudentEnrollments({ ctx, studentId }: { ctx: Session; studentId: string }) {
  // Cuatro lecturas independientes, en paralelo: una sola espera.
  const [page, offerings, placement, transfers] = await Promise.all([
    services.admin.listEnrollments(ctx, { studentUserId: studentId, page: 1, pageSize: STUDENT_ENROLLMENTS }),
    services.admin.listOfferingSeats(ctx),
    services.admin.getPlacement(ctx, studentId),
    services.admin.listTransfers(ctx, { studentUserId: studentId, page: 1, pageSize: STUDENT_ENROLLMENTS }),
  ]);
  const live = new Set(page.items.filter((e) => e.status !== 'withdrawn').map((e) => e.courseOfferingId));
  const recommended = new Set(placement?.groups.filter((group) => group.recommended).map((group) => group.offeringId));
  const byFrom = new Map(transfers.items.map((transfer) => [transfer.fromEnrollmentId, transfer]));
  return (
    <>
      {placement && <PlacementSummary placement={placement} />}
      <EnrollForm studentUserId={studentId} offerings={offerings} enrolledOfferingIds={live} recommendedIds={recommended} />
      <EnrollmentsTable
        enrollments={page.items}
        timeZone={ctx.user.timeZone}
        showStudent={false}
        empty="Todavía no tiene matrículas."
        move={{ offerings, recommendedIds: recommended, heldIds: live }}
        transfersByFrom={byFrom}
      />
      <TransferHistory transfers={transfers.items} timeZone={ctx.user.timeZone} />
    </>
  );
}
