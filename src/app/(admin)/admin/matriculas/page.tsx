import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton, SectionTitle } from '@/components/ui/primitives';
import styles from '@/features/admin/components/admin.module.css';
import { EnrollmentsTable, seatsLabel } from '@/features/admin/components/enrollments';
import { ENROLLMENT_STATUS_LABEL, enrollmentsHref, pageCount, parseEnrollmentFilters } from '@/features/admin/format';
import { cn } from '@/lib/cn';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import { ENROLLMENT_STATUSES } from '@/types/admin';

export const metadata: Metadata = { title: 'Matrículas' };

export default function EnrollmentsPage({ searchParams }: PageProps<'/admin/matriculas'>) {
  return (
    <div className="page">
      <PageHeader
        title="Matrículas"
        description="Activación manual: registra al alumno en un grupo, confirma el pago y actívalo. Las pendientes ya ocupan cupo."
      >
        <Link className="btn btn--primary" href="/admin/usuarios?rol=student">Matricular a un alumno</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <Enrollments searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Enrollments({ searchParams }: Pick<PageProps<'/admin/matriculas'>, 'searchParams'>) {
  const [ctx, params] = await Promise.all([requireSession('admin'), searchParams]);
  const filters = parseEnrollmentFilters(params);
  // Cupos por grupo y la página de matrículas: dos lecturas independientes en paralelo.
  const [offerings, page] = await Promise.all([services.admin.listOfferingSeats(ctx), services.admin.listEnrollments(ctx, filters)]);
  const pages = pageCount(page.total, page.pageSize);
  const current = filters.page ?? 1;

  return (
    <>
      {offerings.length > 0 && (
        <section className="section">
          <SectionTitle title="Cupos por grupo" />
          <div className="grid-3">
            {offerings.map((offering) => (
              <Link key={offering.id} href={enrollmentsHref({ courseOfferingId: offering.id })} className={cn('card', styles.seatCard)} aria-current={filters.courseOfferingId === offering.id ? 'true' : undefined}>
                <b>{offering.courseTitle}</b>
                <span className={styles.sub}>{offering.name}</span>
                <span className={cn(styles.badge, offering.freeSeats === 0 ? styles.status_inactive : styles.status_active)}>{seatsLabel(offering)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <form className={styles.filters} action="/admin/matriculas">
        <label className="label">
          Estado
          <select className="input" name="estado" defaultValue={filters.status ?? ''}>
            <option value="">Todas</option>
            {ENROLLMENT_STATUSES.map((status) => <option key={status} value={status}>{ENROLLMENT_STATUS_LABEL[status]}</option>)}
          </select>
        </label>
        <label className={cn('label', styles.grow)}>
          Grupo
          <select className="input" name="grupo" defaultValue={filters.courseOfferingId ?? ''}>
            <option value="">Todos los grupos</option>
            {offerings.map((o) => <option key={o.id} value={o.id}>{o.courseTitle} · {o.name}</option>)}
          </select>
        </label>
        <div className={styles.actions}>
          <button className="btn btn--dark" type="submit">Filtrar</button>
          {(filters.status || filters.courseOfferingId) && <Link className="link" href="/admin/matriculas">Quitar filtros</Link>}
        </div>
      </form>

      <EnrollmentsTable enrollments={page.items} timeZone={ctx.user.timeZone} move={{ offerings }} />

      {page.total > 0 && (
        <nav className={styles.pager} aria-label="Páginas">
          <span>{page.total} {page.total === 1 ? 'matrícula' : 'matrículas'} · página {Math.min(current, pages)} de {pages}</span>
          <span className={styles.pagerLinks}>
            <Link className={cn('btn btn--sm', current <= 1 && styles.disabled)} href={enrollmentsHref(filters, current - 1)} aria-disabled={current <= 1}>← Anterior</Link>
            <Link className={cn('btn btn--sm', current >= pages && styles.disabled)} href={enrollmentsHref(filters, current + 1)} aria-disabled={current >= pages}>Siguiente →</Link>
          </span>
        </nav>
      )}
    </>
  );
}
