import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { setCoursePublishedAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import styles from '@/features/admin/components/admin.module.css';
import { CourseForm, CoverUploader } from '@/features/admin/components/course-form';
import { OfferingList } from '@/features/admin/components/offerings';
import { isUuid } from '@/features/admin/validation';
import { cn } from '@/lib/cn';
import { requireSession, type Session } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Editar curso' };

export default function CoursePage({ params, searchParams }: PageProps<'/admin/cursos/[id]'>) {
  return (
    <div className="page">
      <Link className="link" href="/admin/cursos">← Volver a cursos</Link>
      <Suspense fallback={<PageSkeleton />}>
        <CourseEditor params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CourseEditor({ params, searchParams }: PageProps<'/admin/cursos/[id]'>) {
  const [ctx, { id }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id)) notFound();
  const [course, categories] = await Promise.all([services.admin.getCourse(ctx, id), services.admin.listCategories(ctx)]);
  if (!course) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p>
            <span className={cn(styles.badge, course.isPublished ? styles.status_active : styles.status_no_account)}>
              {course.isPublished ? 'Publicado en la web' : 'Borrador'}
            </span>
            {query.creado !== undefined && <> · Curso creado. Completa los datos, sube la portada y publícalo.</>}
          </p>
        </div>
        <ActionForm
          action={setCoursePublishedAction}
          confirmMessage={course.isPublished ? '¿Pasar el curso a borrador? Dejará de verse en el catálogo público.' : undefined}
        >
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="published" value={String(!course.isPublished)} />
          <SubmitButton className={course.isPublished ? undefined : 'btn--primary'} pendingLabel="Guardando…">
            {course.isPublished ? 'Pasar a borrador' : 'Publicar curso'}
          </SubmitButton>
        </ActionForm>
      </header>

      <div className="split-aside">
        <section className="card">
          <CourseForm course={course} categories={categories} />
        </section>
        <aside className="card section">
          <SectionTitle as="h2" title="Portada" />
          <CoverUploader courseId={course.id} coverUrl={course.coverUrl} title={course.title} />
        </aside>
      </div>

      <section className="card section">
        <SectionTitle title="Contenido" action={<Link className="btn btn--sm btn--primary" href={`/admin/cursos/${course.id}/contenido`}>Administrar contenido</Link>} />
        <p className="muted small">Las unidades y sesiones del curso, con su video y materiales (enlaces o archivos). No hace falta programar.</p>
      </section>

      <section className="card section">
        <SectionTitle title="Grupos" action={<Link className="btn btn--sm btn--primary" href={`/admin/cursos/${course.id}/grupos/nuevo`}>+ Nuevo grupo</Link>} />
        {/* Se carga aparte: el formulario del curso no espera a los grupos. */}
        <Suspense fallback={<Skeleton height="8rem" />}>
          <CourseOfferings ctx={ctx} courseId={course.id} />
        </Suspense>
      </section>
    </>
  );
}

async function CourseOfferings({ ctx, courseId }: { ctx: Session; courseId: string }) {
  // Tres lecturas independientes en paralelo: grupos con horario, cupos ocupados y nombres de profesores.
  const [offerings, seats, instructors] = await Promise.all([
    services.admin.listOfferings(ctx, courseId),
    services.admin.listOfferingSeats(ctx),
    services.admin.listInstructors(ctx),
  ]);
  return <OfferingList courseId={courseId} offerings={offerings ?? []} seats={seats} instructors={instructors} />;
}
