import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { GroupCards } from '@/features/teacher/components/teacher';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Mis grupos' };

export default function TeacherHomePage() {
  return (
    <div className="page">
      <PageHeader title="Mis grupos" description="Tus grupos, sus clases y cómo va cada alumno. Solo ves los grupos que tienes asignados." />
      <Suspense fallback={<PageSkeleton />}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Groups() {
  const ctx = await requireSession('teacher');
  return <GroupCards groups={await services.teacher.listGroups(ctx)} />;
}
