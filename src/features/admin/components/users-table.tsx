import Link from 'next/link';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/time';
import type { AccountStatus, AdminUserListItem, BackendRole, UserListFilters } from '@/types/admin';
import { ROLE_LABEL, STATUS_LABEL, pageCount, usersHref } from '../format';
import styles from './admin.module.css';

// Piezas de servidor del panel (sin JavaScript en el navegador).

export function RoleBadges({ roles }: { roles: BackendRole[] }) {
  if (roles.length === 0) return <span className={cn(styles.badge, styles.status_no_account)}>Sin rol</span>;
  return (
    <span className={styles.badges}>
      {roles.map((role) => (
        <span key={role} className={cn(styles.badge, styles[`role_${role}`])}>{ROLE_LABEL[role]}</span>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={cn(styles.badge, styles[`status_${status}`])}>{STATUS_LABEL[status]}</span>;
}

interface TableProps {
  users: AdminUserListItem[];
  timeZone: string;
  /** Título de la columna de vínculos: «Hijos» en familias, «Vínculos» en general. */
  linksLabel?: string;
  empty?: string;
}

export function UsersTable({ users, timeZone, linksLabel = 'Vínculos', empty = 'No hay personas que coincidan con la búsqueda.' }: TableProps) {
  if (users.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Persona</th>
            <th scope="col">Rol</th>
            <th scope="col">Usuario</th>
            <th scope="col">Cuenta</th>
            <th scope="col" className={styles.num}>{linksLabel}</th>
            <th scope="col">Registro</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="">
                <Link href={`/admin/usuarios/${user.id}`}>{user.fullName}</Link>
                {user.documentNumber && <span className={styles.sub}>Doc. {user.documentNumber}</span>}
              </td>
              <td data-label="Rol"><RoleBadges roles={user.roles} /></td>
              <td data-label="Usuario" className={styles.mono}>{user.loginIdentifier ?? '—'}</td>
              <td data-label="Cuenta"><StatusBadge status={user.status} /></td>
              <td data-label={linksLabel} className={styles.num}>{user.linkCount}</td>
              <td data-label="Registro">
                <span>
                {formatShortDate(user.createdAt, timeZone)}
                <span className={styles.sub}>{user.lastLoginAt ? `Último ingreso: ${formatShortDate(user.lastLoginAt, timeZone)}` : 'Nunca ingresó'}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FiltersProps {
  basePath: string;
  filters: UserListFilters;
  /** Oculta el selector de rol cuando la página ya fija uno (p. ej. Familias). */
  showRole?: boolean;
}

/** Formulario GET: los filtros viven en la URL (se pueden compartir y funcionan sin JavaScript). */
export function UserFilters({ basePath, filters, showRole = true }: FiltersProps) {
  const hasFilters = Boolean(filters.search || (showRole && filters.role) || filters.status);
  return (
    <form className={styles.filters} action={basePath} role="search">
      <label className={cn('label', styles.grow)}>
        Buscar
        <input className="input" type="search" name="q" defaultValue={filters.search} placeholder="Nombre, correo o documento" maxLength={100} />
      </label>
      {showRole && (
        <label className="label">
          Rol
          <select className="input" name="rol" defaultValue={filters.role ?? ''}>
            <option value="">Todos</option>
            {(Object.keys(ROLE_LABEL) as BackendRole[]).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
          </select>
        </label>
      )}
      <label className="label">
        Cuenta
        <select className="input" name="estado" defaultValue={filters.status ?? ''}>
          <option value="">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Desactivadas</option>
        </select>
      </label>
      <div className={styles.actions}>
        <button className="btn btn--dark" type="submit">Filtrar</button>
        {hasFilters && <Link className="link" href={basePath}>Quitar filtros</Link>}
      </div>
    </form>
  );
}

export function Pagination({ basePath, filters, total }: { basePath: string; filters: UserListFilters; total: number }) {
  const page = filters.page ?? 1;
  const pages = pageCount(total, filters.pageSize ?? 20);
  if (total === 0) return null;
  return (
    <nav className={styles.pager} aria-label="Páginas">
      <span>{total} {total === 1 ? 'persona' : 'personas'} · página {Math.min(page, pages)} de {pages}</span>
      <span className={styles.pagerLinks}>
        <Link className={cn('btn btn--sm', page <= 1 && styles.disabled)} href={usersHref(basePath, filters, page - 1)} aria-disabled={page <= 1}>← Anterior</Link>
        <Link className={cn('btn btn--sm', page >= pages && styles.disabled)} href={usersHref(basePath, filters, page + 1)} aria-disabled={page >= pages}>Siguiente →</Link>
      </span>
    </nav>
  );
}
