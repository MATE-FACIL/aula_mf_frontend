import type { Metadata } from 'next';
import { DiagnosticDetailPage } from '@/features/diagnostic/components/review-pages';

export const metadata: Metadata = { title: 'Diagnóstico' };

export default function TeacherDiagnosticPage({ params }: PageProps<'/profesor/diagnosticos/[attemptId]'>) {
  return <DiagnosticDetailPage role="teacher" basePath="/profesor/diagnosticos" attemptId={params.then((p) => p.attemptId)} />;
}
