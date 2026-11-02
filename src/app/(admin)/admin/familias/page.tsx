import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { UserDirectory } from '@/features/admin/components/user-directory';

export const metadata: Metadata = { title: 'Familias' };

export default function FamiliesPage({ searchParams }: PageProps<'/admin/familias'>) {
  return (
    <div className="page">
      <PageHeader title="Familias" description="Padres y tutores con sus hijos vinculados. Abre una ficha para vincular o quitar alumnos.">
        <Link className="btn btn--primary" href="/admin/usuarios/nuevo?tipo=tutor">+ Nuevo padre o tutor</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <UserDirectory basePath="/admin/familias" searchParams={searchParams} fixedRole="guardian" linksLabel="Hijos" />
      </Suspense>
    </div>
  );
}
