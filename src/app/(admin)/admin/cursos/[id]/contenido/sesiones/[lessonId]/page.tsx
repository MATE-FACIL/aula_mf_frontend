import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import styles from '@/features/content/components/content.module.css';
import { LessonForm } from '@/features/content/components/lesson-form';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Editar sesión' };

type Props = PageProps<'/admin/cursos/[id]/contenido/sesiones/[lessonId]'>;

export default function EditLessonPage({ params, searchParams }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <EditLesson params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditLesson({ params, searchParams }: Props) {
  const [ctx, { id, lessonId }, query] = await Promise.all([requireSession('admin'), params, searchParams]);
  if (!isUuid(id) || !isUuid(lessonId)) notFound();
  const content = await services.admin.getCourseContent(ctx, id);
  const lesson = content?.units.flatMap((unit) => unit.lessons).find((item) => item.id === lessonId);
  if (!content || !lesson) notFound();

  // Los enlaces firmados de los archivos cambian en cada lectura: la clave solo mira lo que el administrador guarda.
  const key = [lesson.id, lesson.unitId, lesson.title, lesson.summary, lesson.isPublished, lesson.videoUrl && !lesson.videoFileId ? lesson.videoUrl : '', lesson.videoFileId,
    ...lesson.materials.map((m) => `${m.title}|${m.fileId ?? m.url}`)].join('~');
  return (
    <>
      <Link className="link" href={`/admin/cursos/${id}/contenido`}>← Contenido del curso</Link>
      <PageHeader title={`Sesión ${lesson.number}`} description={content.courseTitle} />
      {query.creada !== undefined && (
        <p className={styles.note} role="status">Sesión creada. Ahora puedes subir el video y los materiales como archivos.</p>
      )}
      <LessonForm key={key} courseId={id} units={content.units.map((unit) => ({ id: unit.id, title: unit.title }))} lesson={lesson} defaultUnitId={lesson.unitId} />
    </>
  );
}
