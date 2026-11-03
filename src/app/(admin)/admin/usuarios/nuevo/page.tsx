import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { CreatePersonForms, type GuardianOption } from '@/features/admin/components/create-person-forms';
import { isUuid } from '@/features/admin/validation';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Nuevo usuario' };

export default function NewUserPage({ searchParams }: PageProps<'/admin/usuarios/nuevo'>) {
  return (
    <div className="page">
      <PageHeader title="Nuevo usuario" description="Crea la cuenta de un alumno, un padre o tutor, o un profesor. La contraseña inicial se genera automáticamente.">
        <Link className="link" href="/admin/usuarios">← Volver a usuarios</Link>
      </PageHeader>
      <section className="card">
        <Suspense fallback={<Skeleton height="24rem" />}>
          <NewUserForms searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function NewUserForms({ searchParams }: Pick<PageProps<'/admin/usuarios/nuevo'>, 'searchParams'>) {
  const [ctx, params] = await Promise.all([requireSession('admin'), searchParams]);
  const tutorId = typeof params.tutor === 'string' && isUuid(params.tutor) ? params.tutor : null;

  // «Agregar hijo» desde la ficha de un padre: el alumno nuevo queda vinculado al crearse.
  let guardian: GuardianOption | undefined;
  if (tutorId) {
    const person = await services.admin.getUser(ctx, tutorId);
    if (person?.roles.includes('guardian')) guardian = { id: person.id, fullName: person.fullName };
  }

  const tab = params.tipo === 'tutor' ? 'guardian' : params.tipo === 'profesor' ? 'instructor' : 'student';
  return <CreatePersonForms guardian={guardian} defaultTab={tab} />;
}
