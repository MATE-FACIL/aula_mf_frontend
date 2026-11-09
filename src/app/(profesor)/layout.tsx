import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { StatusSkeleton } from '@/features/account/components/user-status';
import { TeacherStatus } from '@/features/teacher/components/teacher-status';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      area="teacher"
      status={
        <Suspense fallback={<StatusSkeleton />}>
          <TeacherStatus />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
