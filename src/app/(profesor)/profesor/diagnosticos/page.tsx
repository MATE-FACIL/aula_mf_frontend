import type { Metadata } from 'next';
import { DiagnosticListPage } from '@/features/diagnostic/components/review-pages';

export const metadata: Metadata = { title: 'Diagnósticos' };

export default function TeacherDiagnosticsPage({ searchParams }: PageProps<'/profesor/diagnosticos'>) {
  return <DiagnosticListPage role="teacher" basePath="/profesor/diagnosticos" searchParams={searchParams} />;
}
