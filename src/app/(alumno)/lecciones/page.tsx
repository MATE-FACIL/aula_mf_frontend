import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { CourseLessons } from '@/features/lessons/components/course-lessons';
import { initialCourse } from '@/features/lessons/rules';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Lecciones' };

export default function LessonsPage({ searchParams }: PageProps<'/lecciones'>) {
  return (
    <div className="page">
      <PageHeader title="Lecciones" description="Cambia entre la ruta de Matemáticas y la del laboratorio del mes.">
        <Link className="btn btn--primary" href="/lecciones/practica">Mis prácticas</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <LessonsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LessonsContent({ searchParams }: Pick<PageProps<'/lecciones'>, 'searchParams'>) {
  const ctx = await requireSession('student');
  const [{ ruta }, courses] = await Promise.all([searchParams, services.studentContent.listCourses(ctx)]);
  const first = initialCourse(courses, typeof ruta === 'string' ? ruta : undefined);

  if (!first) {
    return (
      <div className="card">
        <p>Todavía no tienes lecciones publicadas. Cuando tu profesor publique la primera sesión, la verás aquí.</p>
      </div>
    );
  }
  return <CourseLessons courses={courses} initialCourseId={first.courseId} />;
}
