import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { MaterialsList } from '@/features/lessons/components/materials';
import { AttendanceList, LiveClassesSection, WeekCalendar } from '@/features/schedule/components/schedule';
import { TaskList } from '@/features/schedule/components/task-list';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Clases y tareas' };

export default function ClassesPage() {
  return (
    <div className="page">
      <PageHeader title="Clases y tareas" description="Agenda de la semana, entregas, materiales y registro de asistencia." />
      <Suspense fallback={<PageSkeleton />}>
        <ClassesContent />
      </Suspense>
    </div>
  );
}

async function ClassesContent() {
  const ctx = await requireSession('student');
  const schedule = await services.schedule.getSchedule(ctx);
  const tz = ctx.user.timeZone;

  return (
    <>
      <section className="card" aria-label="Calendario de la semana">
        <WeekCalendar weekStart={schedule.weekStart} events={schedule.calendar} timeZone={tz} now={ctx.requestedAt} />
      </section>
      <div className="split">
        <section className="section">
          <h2>Entregas</h2>
          <TaskList initial={schedule.tasks} />
          <h2>Materiales</h2>
          <div className="card"><MaterialsList materials={schedule.materials} /></div>
        </section>
        <section className="section">
          <h2>Clases en vivo</h2>
          <LiveClassesSection classes={schedule.classes} timeZone={tz} now={ctx.requestedAt} />
          <h2>Asistencia</h2>
          <AttendanceList records={schedule.attendance} summary={schedule.attendanceSummary} />
        </section>
      </div>
    </>
  );
}
