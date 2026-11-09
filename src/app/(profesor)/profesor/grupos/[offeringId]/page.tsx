import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Kpi, PageSkeleton, SectionTitle } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { SessionsTable, StudentsTable } from '@/features/teacher/components/teacher';
import styles from '@/features/teacher/components/teacher.module.css';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Grupo' };

type Props = PageProps<'/profesor/grupos/[offeringId]'>;

export default function TeacherGroupPage({ params }: Props) {
  return (
    <div className="page">
      <Link className="link" href="/profesor">← Mis grupos</Link>
      <Suspense fallback={<PageSkeleton />}>
        <Group params={params} />
      </Suspense>
    </div>
  );
}

async function Group({ params }: Pick<Props, 'params'>) {
  const [ctx, { offeringId }] = await Promise.all([requireSession('teacher'), params]);
  if (!isUuid(offeringId)) notFound();
  // UNA petición: el backend arma clases, asistencia y avance de práctica con un número fijo de consultas.
  const detail = await services.teacher.getGroup(ctx, offeringId);
  if (!detail) notFound();

  const { group, students, sessions } = detail;
  const rated = students.filter((s) => s.attendance.rate !== null);
  const averageRate = rated.length ? Math.round(rated.reduce((sum, s) => sum + (s.attendance.rate ?? 0), 0) / rated.length) : null;
  const marked = sessions.filter((s) => s.marked > 0).length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{group.offeringName}</h1>
          <p>{group.courseTitle}</p>
        </div>
      </header>
      <div className={styles.summary}>
        <Kpi label="Alumnos" value={group.activeStudents} hint={`de ${group.maximumCapacity} cupos`} />
        <Kpi label="Clases con asistencia" value={`${marked} / ${sessions.length}`} />
        <Kpi label="Asistencia promedio" value={averageRate === null ? '—' : `${averageRate} %`} />
      </div>
      <section className="section" aria-labelledby="classes-title">
        <SectionTitle title={<span id="classes-title">Clases</span>} />
        <SessionsTable detail={detail} now={ctx.requestedAt} />
      </section>
      <section className="section" aria-labelledby="students-title">
        <SectionTitle title={<span id="students-title">Alumnos</span>} />
        <StudentsTable detail={detail} />
      </section>
    </>
  );
}
