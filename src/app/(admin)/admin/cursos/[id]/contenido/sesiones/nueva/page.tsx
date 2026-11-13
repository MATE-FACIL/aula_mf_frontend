import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { LessonForm } from '@/features/content/components/lesson-form';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Nueva sesión' };

export default function NewLessonPage({ params, searchParams }: PageProps<'/admin/cursos/[id]/contenido/sesiones/nueva'>) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <NewLesson params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewLesson({ params, searchParams }: PageProps<'/admin/cursos/[id]/contenido/sesiones/nueva'>) {
  const [ctx, { id }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id)) notFound();
  const content = await services.admin.getCourseContent(ctx, id);
  if (!content) notFound();
  const back = `/admin/cursos/${id}/contenido`;
  const units = content.units.map((unit) => ({ id: unit.id, title: unit.title }));
  const wanted = typeof query.unidad === 'string' ? query.unidad : '';

  return (
    <>
      <Link className="link" href={back}>← Contenido del curso</Link>
      <PageHeader title="Nueva sesión" description={content.courseTitle} />
      {units.length === 0 ? (
        <EmptyState>Primero crea una unidad en el <Link className="link" href={back}>contenido del curso</Link>.</EmptyState>
      ) : (
        <LessonForm courseId={id} units={units} defaultUnitId={units.find((unit) => unit.id === wanted)?.id ?? units[0].id} />
      )}
    </>
  );
}
