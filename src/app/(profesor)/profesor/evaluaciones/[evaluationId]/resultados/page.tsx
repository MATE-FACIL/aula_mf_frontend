import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { ResultsView } from '@/features/evaluations/components/teacher-evaluations';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Resultados de la evaluación' };

type Props = PageProps<'/profesor/evaluaciones/[evaluationId]/resultados'>;

export default function EvaluationResultsPage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

async function Results({ params }: Pick<Props, 'params'>) {
  const [ctx, { evaluationId }] = await Promise.all([requireSession('teacher'), params]);
  if (!isUuid(evaluationId)) notFound();
  // UNA petición: el backend arma notas y competencias con un número fijo de consultas.
  const results = await services.teacher.getEvaluationResults(ctx, evaluationId);
  if (!results) notFound();
  return (
    <>
      <Link className="link" href={`/profesor/evaluaciones/${evaluationId}`}>← {results.evaluation.title}</Link>
      <PageHeader title={`Resultados · ${results.evaluation.title}`} description="Nota sobre 20 y aciertos por competencia de cada alumno." />
      <ResultsView results={results} />
    </>
  );
}
