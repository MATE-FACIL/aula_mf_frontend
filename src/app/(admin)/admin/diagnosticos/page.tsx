import type { Metadata } from 'next';
import { DiagnosticListPage } from '@/features/diagnostic/components/review-pages';

export const metadata: Metadata = { title: 'Diagnósticos' };

export default function AdminDiagnosticsPage({ searchParams }: PageProps<'/admin/diagnosticos'>) {
  return <DiagnosticListPage role="admin" basePath="/admin/diagnosticos" searchParams={searchParams} />;
}
