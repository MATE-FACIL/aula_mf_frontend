import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { UserDirectory } from '@/features/admin/components/user-directory';

export const metadata: Metadata = { title: 'Usuarios' };

export default function UsersPage({ searchParams }: PageProps<'/admin/usuarios'>) {
  return (
    <div className="page">
      <PageHeader title="Usuarios" description="Alumnos, padres y tutores, y equipo. Los más recientes primero.">
        <Link className="btn btn--primary" href="/admin/usuarios/nuevo">+ Nuevo usuario</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <UserDirectory basePath="/admin/usuarios" searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
