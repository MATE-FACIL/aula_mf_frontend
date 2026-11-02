import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { StatusSkeleton } from '@/features/account/components/user-status';
import { AdminStatus } from '@/features/admin/components/admin-status';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      area="admin"
      status={
        <Suspense fallback={<StatusSkeleton />}>
          <AdminStatus />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
