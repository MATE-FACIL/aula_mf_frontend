import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { PracticeRunner } from '@/features/practice/components/practice-runner';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Práctica' };

type Props = PageProps<'/lecciones/practica/[lessonId]'>;

const BACK = '/lecciones/practica';

export default function LessonPracticePage({ params }: Props) {
  return (
    <div className="page">
      <Link className="link" href={BACK}>← Mis prácticas</Link>
      <Suspense fallback={<PageSkeleton />}>
        <LessonPractice params={params} />
      </Suspense>
    </div>
  );
}

async function LessonPractice({ params }: Pick<Props, 'params'>) {
  const [ctx, { lessonId }] = await Promise.all([requireSession('student'), params]);
  if (!isUuid(lessonId)) notFound();
  const practice = await services.practice.getLesson(ctx, lessonId);
  if (!practice) notFound();
  // key: al volver a la misma lección se parte del estado del servidor, no del que quedó en memoria.
  return <PracticeRunner key={practice.lessonId} practice={practice} backHref={BACK} />;
}
