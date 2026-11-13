import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { ContentOutline } from '@/features/content/components/content-outline';
import styles from '@/features/content/components/content.module.css';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Contenido del curso' };

export default function CourseContentPage({ params, searchParams }: PageProps<'/admin/cursos/[id]/contenido'>) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <CourseContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CourseContent({ params, searchParams }: PageProps<'/admin/cursos/[id]/contenido'>) {
  const [ctx, { id }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id)) notFound();
  // UNA petición: el backend arma el curso completo (unidades, sesiones y materiales) con un número fijo de consultas.
  const content = await services.admin.getCourseContent(ctx, id);
  if (!content) notFound();

  const lessons = content.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  return (
    <>
      <Link className="link" href={`/admin/cursos/${id}`}>← {content.courseTitle}</Link>
      <PageHeader
        title="Contenido del curso"
        description={`${content.units.length} ${content.units.length === 1 ? 'unidad' : 'unidades'} y ${lessons} ${lessons === 1 ? 'sesión' : 'sesiones'}. Una sesión en borrador solo la ve el equipo; al publicarla la ven los alumnos con matrícula activa.`}
      />
      {query.borrada !== undefined && <p className={styles.note} role="status">Sesión borrada.</p>}
      <ContentOutline content={content} />
    </>
  );
}
