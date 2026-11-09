import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/primitives';
import styles from '@/features/admin/components/admin.module.css';
import { AttendanceSheet, attendanceCounts } from '@/features/admin/components/attendance';
import { SCHEDULE_TIME_ZONE } from '@/features/admin/schedule';
import { isUuid } from '@/features/admin/validation';
import { formatLongDate, formatTime } from '@/lib/time';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Asistencia' };

type Props = PageProps<'/admin/cursos/[id]/grupos/[groupId]/clases/[sessionId]'>;

export default function AttendancePage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Attendance params={params} />
      </Suspense>
    </div>
  );
}

async function Attendance({ params }: Pick<Props, 'params'>) {
  const [ctx, { id, groupId, sessionId }] = await Promise.all([requireSession('admin'), params]);
  if (![id, groupId, sessionId].every(isUuid)) notFound();
  // El grupo (para el número de clase) y la lista, en paralelo: una sola espera.
  const [offering, attendance] = await Promise.all([
    services.admin.getOffering(ctx, id, groupId),
    services.admin.getSessionAttendance(ctx, sessionId),
  ]);
  if (!offering || !attendance || attendance.offeringId !== offering.id) notFound();

  const number = [...offering.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).findIndex((s) => s.id === sessionId) + 1;
  const counts = attendanceCounts(attendance);
  const tz = SCHEDULE_TIME_ZONE;

  return (
    <>
      <Link className="link" href={`/admin/cursos/${id}/grupos/${groupId}`}>← {attendance.offeringName}</Link>
      <header className="page-header">
        <div>
          <h1>Asistencia · clase {number}</h1>
          <p>
            {attendance.courseTitle} · {formatLongDate(attendance.startsAt, tz)}, {formatTime(attendance.startsAt, tz)} – {formatTime(attendance.endsAt, tz)} (hora de Perú)
          </p>
        </div>
      </header>
      <p className={styles.counts} aria-label="Resumen de la clase">
        <span>Asistió <b>{counts.present}</b></span>
        <span>Tarde <b>{counts.late}</b></span>
        <span>Faltó <b>{counts.absent}</b></span>
        <span>Sin marcar <b>{counts.pending}</b></span>
      </p>
      <section className="card section">
        <AttendanceSheet attendance={attendance} />
      </section>
    </>
  );
}
