import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import styles from '@/features/admin/components/admin.module.css';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Categorías' };

export default function CategoriesPage() {
  return (
    <div className="page">
      <PageHeader title="Categorías" description="Agrupan los cursos en el catálogo. Una categoría con cursos asignados no se puede borrar." />
      <section className="card section">
        <ActionForm action={createCategoryAction} resetOnSuccess>
          <label className="label">
            Nueva categoría
            <input className="input" name="name" required maxLength={150} placeholder="Ej.: Matemáticas" />
          </label>
          <SubmitButton className="btn--primary" pendingLabel="Creando…">Crear</SubmitButton>
        </ActionForm>
      </section>
      <Suspense fallback={<PageSkeleton />}>
        <CategoryList />
      </Suspense>
    </div>
  );
}

async function CategoryList() {
  const ctx = await requireSession('admin');
  const [categories, courses] = await Promise.all([services.admin.listCategories(ctx), services.admin.listCourses(ctx)]);
  if (categories.length === 0) return <EmptyState>Todavía no hay categorías.</EmptyState>;

  const usage = new Map<string, number>();
  for (const course of courses) if (course.categoryId) usage.set(course.categoryId, (usage.get(course.categoryId) ?? 0) + 1);

  return (
    <ul className={styles.list} role="list">
      {categories.map((category) => {
        const count = usage.get(category.id) ?? 0;
        return (
          <li key={category.id} className={styles.listItem}>
            <ActionForm action={renameCategoryAction}>
              <input type="hidden" name="categoryId" value={category.id} />
              <input className="input" name="name" defaultValue={category.name} required maxLength={150} aria-label={`Nombre de la categoría ${category.name}`} />
              <SubmitButton className="btn--sm" pendingLabel="…">Renombrar</SubmitButton>
            </ActionForm>
            <span className={styles.actions}>
              <span className={styles.sub}>{count} {count === 1 ? 'curso' : 'cursos'}</span>
              {count === 0 && (
                <ActionForm action={deleteCategoryAction} confirmMessage={`¿Borrar la categoría «${category.name}»?`}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <SubmitButton className="btn--sm" pendingLabel="Borrando…">Borrar</SubmitButton>
                </ActionForm>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
