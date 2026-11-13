import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { ChildReport } from '@/features/family/components/child-report';
import { ConsentBanner } from '@/features/family/components/consent-banner';
import type { MessageView } from '@/features/family/components/message-thread';
import { PrintButton } from '@/features/family/components/print-button';
import { formatTime, formatWeekdayDay } from '@/lib/time';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import type { ChildOverview } from '@/types/domain';

export const metadata: Metadata = { title: 'Familia' };

/** Con perfil (edad, etapa) la etiqueta es más rica; un hijo real por ahora solo tiene su nombre. */
const childLabel = ({ displayName, profile }: ChildOverview) =>
  profile ? `${profile.avatar} ${profile.firstName} · ${profile.age} años · ${profile.stage}` : displayName;

export default function FamilyPage() {
  return (
    <div className="page">
      <PageHeader title="Panel de la familia" description="Informe semanal por hijo, mensajes con los profesores y membresía.">
        <PrintButton />
      </PageHeader>
      <Suspense fallback={<PageSkeleton />}>
        <FamilyContent />
      </Suspense>
    </div>
  );
}

async function FamilyContent() {
  const ctx = await requireSession('family');
  const [children, messages, membership, consent] = await Promise.all([
    services.family.getChildren(ctx),
    services.family.getMessages(ctx),
    services.family.getMembership(ctx),
    services.family.getConsent(ctx),
  ]);
  if (children.length === 0) {
    return <EmptyState>Todavía no hay hijos vinculados a tu cuenta. Escríbenos y los agregamos.</EmptyState>;
  }

  const tz = ctx.user.timeZone;
  const messageViews: MessageView[] = messages.map((m) => ({
    id: m.id,
    author: m.author,
    authorName: m.authorName,
    text: m.text,
    timeLabel: `${formatWeekdayDay(m.sentAt, tz)} · ${formatTime(m.sentAt, tz)}`,
  }));

  return (
    <>
      <ConsentBanner consent={consent} />
      <Tabs
        label="Elegir hijo"
        variant="pills"
        items={children.map((child) => ({
          id: child.id,
          label: childLabel(child),
          panel: <ChildReport child={child} messages={messageViews} membership={membership} timeZone={tz} />,
        }))}
      />
    </>
  );
}
