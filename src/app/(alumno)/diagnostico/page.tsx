import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { DiagnosticOverview } from '@/features/diagnostic/components/diagnostic-overview';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Diagnóstico de entrada' };

export default function DiagnosticPage({ searchParams }: PageProps<'/diagnostico'>) {
  return (
    <div className="page">
      <Link className="link" href="/ruta">← Mi ruta</Link>
      <PageHeader
        title="Diagnóstico de entrada"
        description="Unas preguntas para saber desde qué nivel de Matemáticas empiezas. No tiene nota: responde lo que sepas."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Overview({ searchParams }: Pick<PageProps<'/diagnostico'>, 'searchParams'>) {
  const [ctx, query] = await Promise.all([requireSession('student'), searchParams]);
  return <DiagnosticOverview stages={await services.diagnostic.overview(ctx)} error={query.error === 'no-disponible'} />;
}
