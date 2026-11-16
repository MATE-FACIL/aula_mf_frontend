import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { EvaluationForm } from '@/features/evaluations/components/evaluation-form';
import { toLocalInput } from '@/features/evaluations/rules';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Nueva evaluación' };

type Props = PageProps<'/profesor/grupos/[offeringId]/evaluaciones/nueva'>;

const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

export default function NewEvaluationPage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<PageSkeleton />}>
        <NewEvaluation params={params} />
      </Suspense>
    </div>
  );
}

async function NewEvaluation({ params }: Pick<Props, 'params'>) {
  const [ctx, { offeringId }] = await Promise.all([requireSession('teacher'), params]);
  if (!isUuid(offeringId)) notFound();
  const [group, competencies] = await Promise.all([services.teacher.getGroup(ctx, offeringId), services.teacher.listCompetencies(ctx)]);
  if (!group) notFound();

  // Por defecto: abre en la próxima hora en punto y cierra una semana después.
  const opens = Math.ceil(ctx.requestedAt / HOUR_MS) * HOUR_MS;
  const defaults = { opens: toLocalInput(new Date(opens).toISOString()), closes: toLocalInput(new Date(opens + WEEK_MS).toISOString()) };
  return (
    <>
      <Link className="link" href={`/profesor/grupos/${offeringId}`}>← {group.group.offeringName}</Link>
      <PageHeader title="Nueva evaluación" description={`${group.group.courseTitle} · ${group.group.offeringName}`} />
      <EvaluationForm offeringId={offeringId} competencies={competencies} defaults={defaults} />
    </>
  );
}
