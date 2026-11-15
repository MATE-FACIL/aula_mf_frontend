import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Ejercicios del curso' };

type Props = PageProps<'/profesor/cursos/[courseId]'>;

export default function TeacherCoursePage({ params }: Props) {
  return (
    <div className="page">
      <Link className="link" href="/profesor">← Mis grupos</Link>
      <Suspense fallback={<PageSkeleton />}>
        <Lessons params={params} />
      </Suspense>
    </div>
  );
}

async function Lessons({ params }: Pick<Props, 'params'>) {
  const [ctx, { courseId }] = await Promise.all([requireSession('teacher'), params]);
  if (!isUuid(courseId)) notFound();
  // El backend responde 404 si no enseñas ese curso: no se distingue de uno que no existe.
  const content = await services.teacher.getCourseLessons(ctx, courseId);
  if (!content) notFound();
  const units = content.units.filter((unit) => unit.lessons.length > 0);

  return (
    <>
      <PageHeader title="Ejercicios de práctica" description={`${content.courseTitle} · elige la sesión cuyos ejercicios quieres editar.`} />
      {units.length === 0 && <p className="card">Este curso aún no tiene sesiones publicadas. Cuando el equipo publique la primera, la verás aquí.</p>}
      {units.map((unit) => (
        <section key={unit.id} className="card section">
          <h2>{unit.title}</h2>
          <ol role="list" className="stack">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link className="link" href={`/profesor/cursos/${courseId}/lecciones/${lesson.id}`}>
                  {lesson.number}. {lesson.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
