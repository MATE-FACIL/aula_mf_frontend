import { Suspense, type ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { ADMIN_NAV, STUDENT_NAV, TEACHER_NAV, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { OfflineBanner } from '@/features/pwa/offline-banner';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import styles from './app-shell.module.css';
import { SideNav, SideNavFallback } from './side-nav';

// Armazón estático del aula: se prerenderiza y llega al instante.
// La parte que depende de la sesión (estrellas, avisos, perfil) entra por `status` dentro de un <Suspense>.

type Area = 'student' | 'family' | 'teacher' | 'admin';

interface Props {
  area: Area;
  status: ReactNode;
  children: ReactNode;
}

const AREAS: Record<Area, { home: string; label: string; nav?: NavItem[] }> = {
  student: { home: '/inicio', label: 'Alumno', nav: STUDENT_NAV },
  family: { home: '/familia', label: 'Familia' },
  teacher: { home: '/profesor', label: 'Profesor', nav: TEACHER_NAV },
  admin: { home: '/admin', label: 'Administración', nav: ADMIN_NAV },
};

export function AppShell({ area, status, children }: Props) {
  const { home, label, nav } = AREAS[area];
  return (
    <div className={cn(styles.shell, area === 'family' && styles.family)}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className={cn(styles.topbar, 'no-print')}>
        <Logo href={home} />
        <span className={styles.area}>{label}</span>
        <div className={styles.status}>
          <ThemeToggle />
          {status}
        </div>
      </header>
      <div className={styles.frame}>
        {nav && (
          <Suspense fallback={<SideNavFallback items={nav} />}>
            <SideNav items={nav} />
          </Suspense>
        )}
        <main id="contenido" className={styles.content}>
          <OfflineBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
