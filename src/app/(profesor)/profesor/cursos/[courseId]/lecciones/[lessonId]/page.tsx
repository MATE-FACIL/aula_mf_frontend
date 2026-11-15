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

type Props = PageProps<'/profesor/cursos/[courseId]/lecciones/[lessonId]'>;

export default function TeacherLessonExercisesPage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Exercises params={params} />
      </Suspense>
    </div>
  );
}

async function Exercises({ params }: Pick<Props, 'params'>) {
  const [ctx, { courseId, lessonId }] = await Promise.all([requireSession('teacher'), params]);
  if (!isUuid(courseId) || !isUuid(lessonId)) notFound();
  const [exercises, content] = await Promise.all([services.teacher.getLessonExercises(ctx, courseId, lessonId), services.teacher.getCourseLessons(ctx, courseId)]);
  const lesson = content?.units.flatMap((unit) => unit.lessons).find((item) => item.id === lessonId);
  if (!exercises || !content || !lesson) notFound();

  return (
    <>
      <Link className="link" href={`/profesor/cursos/${courseId}`}>← Sesiones del curso</Link>
      <PageHeader title={`Ejercicios · ${lesson.title}`} description={content.courseTitle} />
      <ExerciseEditor key={JSON.stringify(exercises)} scope="teacher" courseId={courseId} lessonId={lessonId} exercises={exercises} />
    </>
  );
}
