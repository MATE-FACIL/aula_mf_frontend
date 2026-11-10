import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { DiagnosticRunner } from '@/features/diagnostic/components/diagnostic-runner';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Diagnóstico' };

type Props = PageProps<'/diagnostico/[attemptId]'>;

const BACK = '/diagnostico';

export default function DiagnosticAttemptPage({ params }: Props) {
  return (
    <div className="page">
      <Link className="link" href={BACK}>← Diagnóstico de entrada</Link>
      <Suspense fallback={<PageSkeleton />}>
        <Attempt params={params} />
      </Suspense>
    </div>
  );
}

async function Attempt({ params }: Pick<Props, 'params'>) {
  const [ctx, { attemptId }] = await Promise.all([requireSession('student'), params]);
  if (!isUuid(attemptId)) notFound();
  const diagnostic = await services.diagnostic.get(ctx, attemptId);
  if (!diagnostic) notFound();
  // key: al volver se parte del estado del servidor, no del que quedó en memoria.
  return <DiagnosticRunner key={diagnostic.attemptId} diagnostic={diagnostic} backHref={BACK} />;
}
