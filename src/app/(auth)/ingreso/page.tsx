import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { Skeleton } from '@/components/ui/primitives';
import { LoginForms } from '@/features/auth/components/login-forms';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import styles from '@/features/auth/components/login.module.css';
import { getSession } from '@/server/auth/dal';
import { HOME_BY_ROLE } from '@/server/auth/constants';
import { isMockMode, usesPasswordLogin } from '@/services';
import { DEMO_CREDENTIALS } from '@/services/mock/data';

export const metadata: Metadata = { title: 'Ingresar' };

// Destino del botón «Aula virtual» de la web pública.
// La tarjeta es estática (llega al instante); solo los formularios esperan a leer la petición.

export default function LoginPage({ searchParams }: PageProps<'/ingreso'>) {
  return (
    <main className={styles.screen}>
      <ThemeToggle floating />
      <div className={styles.card}>
        <div className={styles.brand}><Logo size="hero" withLabel={false} /></div>
        <h1>¡Hola! Entra a tu aula</h1>
        <p className={styles.lead}>Clases en vivo, tus retos y tu progreso en un solo lugar.</p>
        <Suspense fallback={<Skeleton height="22rem" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<'/ingreso'>, 'searchParams'>) {
  const params = await searchParams;
  const expired = params.expirada !== undefined;

  // Si ya hay una sesión válida, no tiene sentido mostrar el formulario.
  if (!expired) {
    const session = await getSession();
    if (session) redirect(HOME_BY_ROLE[session.user.role]);
  }

  const next = typeof params.next === 'string' ? params.next : undefined;
  return <LoginForms next={next} expired={expired} demo={isMockMode ? DEMO_CREDENTIALS : undefined} passwordLogin={usesPasswordLogin} />;
}
