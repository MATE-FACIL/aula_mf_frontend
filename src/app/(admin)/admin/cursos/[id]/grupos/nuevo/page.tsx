import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { OfferingForm } from '@/features/admin/components/offering-form';
import { isUuid } from '@/features/admin/validation';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Nuevo grupo' };

export default function NewOfferingPage({ params }: PageProps<'/admin/cursos/[id]/grupos/nuevo'>) {
  return (
    <div className="page">
      <Suspense fallback={<Skeleton height="36rem" />}>
        <NewOffering params={params} />
      </Suspense>
    </div>
  );
}

async function NewOffering({ params }: Pick<PageProps<'/admin/cursos/[id]/grupos/nuevo'>, 'params'>) {
  const [ctx, { id }] = await Promise.all([requireSession('admin'), params]);
  if (!isUuid(id)) notFound();
  const course = await services.admin.getCourse(ctx, id);
  if (!course) notFound();

  return (
    <>
      <PageHeader title="Nuevo grupo" description={`${course.title}. Se crea como borrador; después asignas profesores y lo publicas.`}>
        <Link className="link" href={`/admin/cursos/${course.id}`}>← Volver al curso</Link>
      </PageHeader>
      <section className="card">
        <OfferingForm courseId={course.id} courseSessionMinutes={course.sessionDurationMinutes} />
      </section>
    </>
  );
}
