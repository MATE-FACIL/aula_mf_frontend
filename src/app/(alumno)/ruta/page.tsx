import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { TRACK_COLOR } from '@/config/areas';
import { FrequencyList, LessonList, MathLevels, MonthlyLabs } from '@/features/learning/components/learning';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Mi ruta' };

export default function RoutePage() {
  return (
    <div className="page">
      <PageHeader
        title="Mi ruta de aprendizaje"
        description="Matemáticas es el curso pivote y avanza por nivel. En paralelo, cada mes, un laboratorio de IA, habilidades digitales o programación."
      />
      <section className="card section">
        <div className="section-title">
          <h2>Diagnóstico de entrada</h2>
          <Link className="btn btn--primary btn--sm" href="/diagnostico">Ir al diagnóstico</Link>
        </div>
        <p className="muted small">Unas preguntas para saber desde qué nivel de Matemáticas empiezas. Tu profesor revisa el resultado y confirma tu nivel.</p>
      </section>
      <Suspense fallback={<PageSkeleton />}>
        <RouteContent />
      </Suspense>
    </div>
  );
}

async function RouteContent() {
  const ctx = await requireSession('student');
  const { profile, mathUnit, labUnit, labs, frequency } = await services.students.getLearningPath(ctx);

  return (
    <>
      <section className="card section">
        <div className="section-title">
          <h2>Matemáticas · nivel de {profile.stage.toLowerCase()}</h2>
          <span className="muted small">Prueba de entrada: {profile.math.startLevel} · Hoy: {profile.math.level} ({profile.math.progress} %)</span>
        </div>
        <MathLevels level={profile.math.level} startLevel={profile.math.startLevel} progress={profile.math.progress} />
      </section>

      <section className="section">
        <h2>Frecuencia y laboratorios del año</h2>
        <FrequencyList items={frequency} />
        <MonthlyLabs labs={labs} />
      </section>

      <div className="grid-2">
        <section className="section">
          <h2>Matemáticas · {mathUnit.level}</h2>
          <p><b>Unidad: {mathUnit.name}</b></p>
          <LessonList lessons={mathUnit.lessons} color={TRACK_COLOR.math} />
          {mathUnit.nextUnits && <p className="muted small">Siguientes unidades: {mathUnit.nextUnits}.</p>}
        </section>
        <section className="section">
          <h2>Lab de {labUnit.month?.toLowerCase()} · {labUnit.area}</h2>
          <p><b>{labUnit.name} · 1 lección por semana</b></p>
          <LessonList lessons={labUnit.lessons} color={TRACK_COLOR.lab} href="/lecciones?ruta=lab" />
          {labUnit.nextUnits && <p className="muted small">{labUnit.nextUnits}.</p>}
        </section>
      </div>
    </>
  );
}
