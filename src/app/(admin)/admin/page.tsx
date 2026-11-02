import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Kpi, PageHeader, PageSkeleton, SectionTitle } from '@/components/ui/primitives';
import { UsersTable } from '@/features/admin/components/users-table';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Administración' };

export default function AdminHomePage() {
  return (
    <div className="page">
      <PageHeader title="Resumen" description="Usuarios nuevos, familias y estado del catálogo de cursos.">
        <Link className="btn btn--primary" href="/admin/usuarios/nuevo">+ Nuevo usuario</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <Summary />
      </Suspense>
    </div>
  );
}

async function Summary() {
  const ctx = await requireSession('admin');
  // Dos lecturas independientes en paralelo: una sola espera en vez de dos.
  const [summary, courses] = await Promise.all([services.admin.getSummary(ctx), services.admin.listCourses(ctx)]);
  const published = courses.filter((c) => c.isPublished).length;
  const byRole = summary.usersByRole;

  return (
    <>
      <div className="grid-4">
        <Kpi label="Nuevos (7 días)" value={summary.newUsersLast7Days} hint={`${summary.totalUsers} personas en total`} />
        <Kpi label="Alumnos" value={byRole.student ?? 0} hint={<Link className="link" href="/admin/usuarios?rol=student">Ver alumnos</Link>} />
        <Kpi label="Padres y tutores" value={byRole.guardian ?? 0} hint={<Link className="link" href="/admin/familias">Ver familias</Link>} />
        <Kpi label="Cursos publicados" value={`${published} / ${courses.length}`} hint={<Link className="link" href="/admin/cursos">Gestionar cursos</Link>} />
      </div>

      <section className="section">
        <SectionTitle title="Últimos registrados" action={<Link className="link" href="/admin/usuarios">Ver todos →</Link>} />
        <UsersTable users={summary.recentUsers} timeZone={ctx.user.timeZone} empty="Todavía no hay usuarios registrados." />
      </section>
    </>
  );
}
