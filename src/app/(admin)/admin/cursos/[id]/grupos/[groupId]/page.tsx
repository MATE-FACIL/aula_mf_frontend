import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton, SectionTitle } from '@/components/ui/primitives';
import styles from '@/features/admin/components/admin.module.css';
import { enrollmentsHref } from '@/features/admin/format';
import { OfferingForm } from '@/features/admin/components/offering-form';
import { InstructorPicker, OfferingStatusBadge, PublishOffering, scheduleSummary, SessionLinks } from '@/features/admin/components/offerings';
import { isUuid } from '@/features/admin/validation';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Grupo' };

export default function OfferingPage({ params, searchParams }: PageProps<'/admin/cursos/[id]/grupos/[groupId]'>) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Offering params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Offering({ params, searchParams }: PageProps<'/admin/cursos/[id]/grupos/[groupId]'>) {
  const [ctx, { id, groupId }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id) || !isUuid(groupId)) notFound();
  // Curso, grupo y profesores en paralelo: una sola espera.
  const [course, offering, instructors] = await Promise.all([
    services.admin.getCourse(ctx, id),
    services.admin.getOffering(ctx, id, groupId),
    services.admin.listInstructors(ctx),
  ]);
  if (!course || !offering) notFound();

  const isDraft = offering.status === 'draft';
  const teacherNames = instructors.filter((i) => offering.instructorIds.includes(i.id)).map((i) => i.fullName);

  return (
    <>
      <Link className="link" href={`/admin/cursos/${course.id}`}>← {course.title}</Link>
      <header className="page-header">
        <div>
          <h1>{offering.name}</h1>
          <p>
            <OfferingStatusBadge status={offering.status} /> · {scheduleSummary(offering)} (hora de Perú) · cupo {offering.maximumCapacity}
            {query.creado !== undefined && isDraft && <> · Grupo creado: asigna profesores y publícalo.</>}
          </p>
        </div>
        <span className={styles.actions}>
          <Link className="btn btn--sm" href={enrollmentsHref({ courseOfferingId: offering.id })}>Ver matrículas</Link>
          <PublishOffering courseId={course.id} offering={offering} />
        </span>
      </header>

      <section className="card section">
        <SectionTitle title="Profesores" action={<Link className="link" href="/admin/usuarios/nuevo?tipo=profesor">+ Nuevo profesor</Link>} />
        {isDraft
          ? <InstructorPicker courseId={course.id} offering={offering} instructors={instructors} />
          : <p>{teacherNames.join(', ') || 'Sin profesor asignado'}</p>}
      </section>

      <section className="card section">
        <SectionTitle title={isDraft ? 'Datos y horario' : `Clases (${offering.sessions.length})`} />
        {isDraft
          ? <OfferingForm courseId={course.id} courseSessionMinutes={course.sessionDurationMinutes} offering={offering} />
          : <SessionLinks courseId={course.id} offering={offering} />}
      </section>
    </>
  );
}
