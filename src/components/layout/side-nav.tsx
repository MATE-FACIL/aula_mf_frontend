'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/config/navigation';
import { NavIcon } from './nav-icon';
import styles from './app-shell.module.css';

const matches = (item: NavItem, pathname: string) =>
  pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));

/**
 * El enlace de la página actual: si varios coinciden, gana el más específico (en /profesor/diagnosticos se marca
 * «Diagnósticos», no «Mis grupos»; en /profesor/grupos/… sigue marcándose «Mis grupos»).
 */
export function currentHref(items: NavItem[], pathname?: string): string | undefined {
  if (pathname === undefined) return undefined;
  return items.filter((item) => matches(item, pathname)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname?: string }) {
  const active = currentHref(items, pathname);
  return (
    <nav className={`${styles.nav} no-print`} aria-label="Aula">
      {items.map((item) => {
        const current = item.href === active;
        return (
          // aria-label: en móvil la etiqueta larga se oculta (display:none) y la corta es aria-hidden; sin esto el enlace no tendría nombre.
          <Link key={item.href} href={item.href} aria-label={item.label} aria-current={current ? 'page' : undefined} className={styles.navLink}>
            <span className={styles.navIcon}><NavIcon name={item.icon} /></span>
            <span className={styles.navLabel}>{item.label}</span>
            <span className={styles.navShort} aria-hidden="true">{item.short ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  return <NavLinks items={items} pathname={usePathname()} />;
}

/**
 * Misma barra sin marcar la página actual. Es el respaldo de <Suspense> en rutas dinámicas
 * (p. ej. /admin/usuarios/[id]), donde la ruta exacta solo se conoce al pedir la página.
 */
export function SideNavFallback({ items }: { items: NavItem[] }) {
  return <NavLinks items={items} />;
}
