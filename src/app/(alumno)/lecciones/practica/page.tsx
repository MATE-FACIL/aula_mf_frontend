import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { PracticeCourses } from '@/features/practice/components/practice-courses';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Mis prácticas' };

export default function PracticeListPage() {
  return (
    <div className="page">
      <Link className="link" href="/lecciones">← Lecciones</Link>
      <PageHeader title="Mis prácticas" description="Ejercicios de cada lección. Se corrigen al momento y te explican el porqué." />
      <Suspense fallback={<PageSkeleton />}>
        <Courses />
      </Suspense>
    </div>
  );
}

async function Courses() {
  const ctx = await requireSession('student');
  return <PracticeCourses courses={await services.practice.listCourses(ctx)} />;
}
