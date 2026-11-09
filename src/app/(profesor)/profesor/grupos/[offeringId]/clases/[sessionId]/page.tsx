import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/primitives';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import admin from '@/features/admin/components/admin.module.css';
import { AttendanceSheet, attendanceCounts } from '@/features/admin/components/attendance';
import { SCHEDULE_TIME_ZONE } from '@/features/admin/schedule';
import { isUuid } from '@/features/admin/validation';
import { markRemainingPresentAction, markTeacherAttendanceAction } from '@/features/teacher/actions';
import { groupHref } from '@/features/teacher/components/teacher';
import styles from '@/features/teacher/components/teacher.module.css';
import { formatLongDate, formatTime } from '@/lib/time';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Asistencia' };

type Props = PageProps<'/profesor/grupos/[offeringId]/clases/[sessionId]'>;

/** El número de la clase llega en el enlace (?n=3): solo es un rótulo, y así no se pide el grupo entero. */
const classNumber = (raw: string | string[] | undefined) => (typeof raw === 'string' && /^[1-9]\d{0,2}$/.test(raw) ? raw : null);

export default function TeacherAttendancePage({ params, searchParams }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Attendance params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Attendance({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [ctx, { offeringId, sessionId }, { n }] = await Promise.all([requireSession('teacher'), params, searchParams]);
  if (![offeringId, sessionId].every(isUuid)) notFound();
  // UNA petición: el backend solo entrega la lista si la clase es de un grupo del profesor (si no, 403).
  const attendance = await services.teacher.getSessionAttendance(ctx, sessionId);
  if (!attendance || attendance.offeringId !== offeringId) notFound();

  const number = classNumber(n);
  const counts = attendanceCounts(attendance);
  const tz = SCHEDULE_TIME_ZONE;

  return (
    <>
      <Link className="link" href={groupHref(offeringId)}>← {attendance.offeringName}</Link>
      <header className="page-header">
        <div>
          <h1>Asistencia{number ? ` · clase ${number}` : ''}</h1>
          <p>
            {attendance.courseTitle} · {formatLongDate(attendance.startsAt, tz)}, {formatTime(attendance.startsAt, tz)} – {formatTime(attendance.endsAt, tz)} (hora de Perú)
          </p>
        </div>
      </header>
      <p className={admin.counts} aria-label="Resumen de la clase">
        <span>Asistió <b>{counts.present}</b></span>
        <span>Tarde <b>{counts.late}</b></span>
        <span>Faltó <b>{counts.absent}</b></span>
        <span>Sin marcar <b>{counts.pending}</b></span>
      </p>
      {attendance.canMark && counts.pending > 0 && (
        <ActionForm action={markRemainingPresentAction} className={styles.quick}>
          <input type="hidden" name="sessionId" value={attendance.sessionId} />
          <p>¿Vinieron todos? Marca como {counts.pending === 1 ? 'presente al alumno que falta' : `presentes a los ${counts.pending} que faltan`} en un clic; lo que ya marcaste no cambia.</p>
          <SubmitButton className="btn--dark" pendingLabel="Marcando…">Todos presentes</SubmitButton>
        </ActionForm>
      )}
      <section className="card section">
        <AttendanceSheet attendance={attendance} action={markTeacherAttendanceAction} />
      </section>
    </>
  );
}
