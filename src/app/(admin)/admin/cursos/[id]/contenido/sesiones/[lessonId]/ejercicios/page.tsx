import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { ExerciseEditor } from '@/features/practice/components/exercise-editor';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Ejercicios de la sesión' };

type Props = PageProps<'/admin/cursos/[id]/contenido/sesiones/[lessonId]/ejercicios'>;

export default function LessonExercisesPage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Exercises params={params} />
      </Suspense>
    </div>
  );
}

async function Exercises({ params }: Pick<Props, 'params'>) {
  const [ctx, { id, lessonId }] = await Promise.all([requireSession('admin'), params]);
  if (!isUuid(id) || !isUuid(lessonId)) notFound();
  const [exercises, content] = await Promise.all([services.admin.getLessonExercises(ctx, id, lessonId), services.admin.getCourseContent(ctx, id)]);
  const lesson = content?.units.flatMap((unit) => unit.lessons).find((item) => item.id === lessonId);
  if (!exercises || !content || !lesson) notFound();

  // Al guardar, la clave cambia y el editor se monta de nuevo con lo guardado (y los identificadores nuevos).
  return (
    <>
      <Link className="link" href={`/admin/cursos/${id}/contenido/sesiones/${lessonId}`}>← Sesión {lesson.number}</Link>
      <PageHeader title={`Ejercicios · ${lesson.title}`} description={content.courseTitle} />
      <ExerciseEditor key={JSON.stringify(exercises)} scope="admin" courseId={id} lessonId={lessonId} exercises={exercises} />
    </>
  );
}
