import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { ConsentPanel } from '@/features/family/components/consent';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';

export const metadata: Metadata = { title: 'Términos y privacidad' };

export default function ConsentPage() {
  return (
    <div className="page">
      <Link className="link" href="/familia">← Panel de la familia</Link>
      <PageHeader
        title="Términos y privacidad"
        description="Para activar la cuenta de tu hijo o hija necesitamos que leas cómo usamos sus datos y que lo aceptes."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Consent />
      </Suspense>
    </div>
  );
}

async function Consent() {
  const ctx = await requireSession('family');
  // key: al volver se parte del estado del servidor, no del que quedó en memoria.
  const consent = await services.family.getConsent(ctx);
  return <ConsentPanel key={consent.text.version} consent={consent} timeZone={ctx.user.timeZone} />;
}
