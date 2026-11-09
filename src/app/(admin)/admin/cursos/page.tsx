import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import styles from '@/features/admin/components/admin.module.css';
import { cn } from '@/lib/cn';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Cursos' };

export default function CoursesPage() {
  return (
    <div className="page">
      <PageHeader title="Cursos" description="Catálogo de cursos: textos, categoría, portada y publicación en la web.">
        <Link className="btn" href="/admin/cursos/niveles">Niveles de Matemáticas</Link>
        <Link className="btn btn--primary" href="/admin/cursos/nuevo">+ Nuevo curso</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <CourseList />
      </Suspense>
    </div>
  );
}

async function CourseList() {
  const ctx = await requireSession('admin');
  const [courses, categories] = await Promise.all([services.admin.listCourses(ctx), services.admin.listCategories(ctx)]);
  if (courses.length === 0) return <EmptyState>Todavía no hay cursos. Crea el primero con «Nuevo curso».</EmptyState>;

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...courses].sort((a, b) => Number(b.isPublished) - Number(a.isPublished) || a.title.localeCompare(b.title, 'es'));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Curso</th>
            <th scope="col">Categoría</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((course) => (
            <tr key={course.id}>
              <td data-label="">
                <Link href={`/admin/cursos/${course.id}`}>{course.title}</Link>
                {course.shortDescription && <span className={styles.sub}>{course.shortDescription}</span>}
              </td>
              <td data-label="Categoría">{(course.categoryId && categoryName.get(course.categoryId)) ?? '—'}</td>
              <td data-label="Estado">
                <span className={cn(styles.badge, course.isPublished ? styles.status_active : styles.status_no_account)}>
                  {course.isPublished ? 'Publicado' : 'Borrador'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
