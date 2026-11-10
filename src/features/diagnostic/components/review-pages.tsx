import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { isUuid } from '@/features/admin/validation';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import { isFilter } from '../rules';
import { DiagnosticList, DiagnosticReviewDetail } from './diagnostic-review';

// Páginas de revisión del diagnóstico, iguales para el profesor (/profesor/diagnosticos) y el administrador
// (/admin/diagnosticos). Cada página es UNA petición al backend.

type Reviewer = 'teacher' | 'admin';
type Query = Promise<Record<string, string | string[] | undefined>>;

async function List({ role, basePath, searchParams }: { role: Reviewer; basePath: string; searchParams: Query }) {
  const [ctx, query] = await Promise.all([requireSession(role), searchParams]);
  const filter = isFilter(query.estado) ? query.estado : 'pending';
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(query.pagina ?? '1'), 10) || 1));
  return <DiagnosticList page={await services.diagnostic.listReviews(ctx, filter, page)} filter={filter} basePath={basePath} />;
}

export function DiagnosticListPage(props: { role: Reviewer; basePath: string; searchParams: Query }) {
  return (
    <div className="page">
      <PageHeader
        title="Diagnósticos de entrada"
        description="El resultado de cada alumno por tema y el nivel que sugiere el sistema. Revisa las respuestas y confirma el nivel con el que empieza."
      />
      <Suspense fallback={<PageSkeleton />}>
        <List {...props} />
      </Suspense>
    </div>
  );
}

async function Detail({ role, attemptId }: { role: Reviewer; attemptId: Promise<string> }) {
  const [ctx, id] = await Promise.all([requireSession(role), attemptId]);
  if (!isUuid(id)) notFound();
  const review = await services.diagnostic.getReview(ctx, id);
  if (!review) notFound();
  return <DiagnosticReviewDetail review={review} />;
}

export function DiagnosticDetailPage({ role, basePath, attemptId }: { role: Reviewer; basePath: string; attemptId: Promise<string> }) {
  return (
    <div className="page">
      <Link className="link" href={basePath}>← Diagnósticos</Link>
      <Suspense fallback={<PageSkeleton />}>
        <Detail role={role} attemptId={attemptId} />
      </Suspense>
    </div>
  );
}
