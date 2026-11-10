import type { Metadata } from 'next';
import { DiagnosticDetailPage } from '@/features/diagnostic/components/review-pages';

export const metadata: Metadata = { title: 'Diagnóstico' };

export default function AdminDiagnosticPage({ params }: PageProps<'/admin/diagnosticos/[attemptId]'>) {
  return <DiagnosticDetailPage role="admin" basePath="/admin/diagnosticos" attemptId={params.then((p) => p.attemptId)} />;
}
