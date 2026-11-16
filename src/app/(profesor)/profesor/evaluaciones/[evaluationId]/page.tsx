import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { EvaluationForm } from '@/features/evaluations/components/evaluation-form';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Evaluación' };

type Props = PageProps<'/profesor/evaluaciones/[evaluationId]'>;

export default function EditEvaluationPage({ params, searchParams }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <EditEvaluation params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditEvaluation({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [ctx, { evaluationId }, query] = await Promise.all([requireSession('teacher'), params, searchParams]);
  if (!isUuid(evaluationId)) notFound();
  const [detail, competencies] = await Promise.all([services.teacher.getEvaluation(ctx, evaluationId), services.teacher.listCompetencies(ctx)]);
  if (!detail) notFound();
  const { evaluation } = detail;

  // Al guardar, la clave cambia y el formulario se monta de nuevo con lo guardado.
  return (
    <>
      <Link className="link" href={`/profesor/grupos/${evaluation.offeringId}`}>← Evaluaciones del grupo</Link>
      <PageHeader title={evaluation.title} description={evaluation.isPublished ? 'Publicada' : 'Borrador: los alumnos todavía no la ven'}>
        <Link className="btn btn--sm" href={`/profesor/evaluaciones/${evaluationId}/resultados`}>Ver resultados</Link>
      </PageHeader>
      {query.creada !== undefined && <p role="status" className="card">Evaluación creada. Revisa las preguntas y publícala cuando esté lista.</p>}
      <EvaluationForm key={JSON.stringify(detail)} offeringId={evaluation.offeringId} detail={detail} competencies={competencies}
        defaults={{ opens: '', closes: '' }} />
    </>
  );
}
