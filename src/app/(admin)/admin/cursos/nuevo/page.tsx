import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { CourseForm } from '@/features/admin/components/course-form';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Nuevo curso' };

export default function NewCoursePage() {
  return (
    <div className="page">
      <PageHeader title="Nuevo curso" description="Se crea como borrador. Después podrás subir la portada y publicarlo.">
        <Link className="link" href="/admin/cursos">← Volver a cursos</Link>
      </PageHeader>
      <section className="card">
        <Suspense fallback={<Skeleton height="30rem" />}>
          <NewCourseForm />
        </Suspense>
      </section>
    </div>
  );
}

async function NewCourseForm() {
  const ctx = await requireSession('admin');
  return <CourseForm categories={await services.admin.listCategories(ctx)} />;
}
