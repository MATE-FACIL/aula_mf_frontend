import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { LabLessonPanel, MathLessonPanel, TrackLabel, trackTabClass } from '@/features/lessons/components/lesson-panels';
import { Tutor } from '@/features/lessons/components/tutor';
import { StudySessionProvider } from '@/features/lessons/study-session';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Lecciones' };

export default function LessonsPage({ searchParams }: PageProps<'/lecciones'>) {
  return (
    <div className="page">
      <PageHeader title="Lecciones" description="Cambia entre la ruta de Matemáticas y la del laboratorio del mes.">
        <Link className="btn btn--primary" href="/lecciones/practica">Mis prácticas</Link>
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <LessonsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LessonsContent({ searchParams }: Pick<PageProps<'/lecciones'>, 'searchParams'>) {
  const ctx = await requireSession('student');
  const [{ ruta }, math, lab, profile] = await Promise.all([
    searchParams,
    services.lessons.getCurrentMathLesson(ctx),
    services.lessons.getCurrentLabLesson(ctx),
    services.students.getProfile(ctx),
  ]);

  return (
    <StudySessionProvider>
      <div className="split-aside">
        <Tabs
          label="Elegir ruta"
          variant="cards"
          defaultTab={ruta === 'lab' ? 'lab' : 'math'}
          items={[
            {
              id: 'math',
              label: <TrackLabel title="Matemáticas" detail={`${profile.math.level ?? 'Primaria'} · ${math.unit.name}`} />,
              tabClassName: trackTabClass.math,
              panel: <MathLessonPanel lesson={math.lesson} unit={math.unit} />,
            },
            {
              id: 'lab',
              label: <TrackLabel title={`Lab de ${profile.lab.month.toLowerCase()}`} detail={`${profile.lab.area} · semana actual`} />,
              tabClassName: trackTabClass.lab,
              panel: <LabLessonPanel lesson={lab.lesson} unit={lab.unit} />,
            },
          ]}
        />
        <Tutor studentName={profile.firstName} defaultExerciseId={math.lesson.exercises[0]?.id} />
      </div>
    </StudySessionProvider>
  );
}
