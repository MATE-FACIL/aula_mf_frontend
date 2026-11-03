import {
  BACKEND_ROLES,
  ENROLLMENT_STATUSES,
  type AccountStatus,
  type BackendRole,
  type EnrollmentFilters,
  type EnrollmentStatus,
  type UserListFilters,
} from '@/types/admin';

// Etiquetas y lectura de filtros del panel. Sin dependencias de servidor: se prueba con Vitest.

export const ROLE_LABEL: Record<BackendRole, string> = {
  student: 'Alumno',
  guardian: 'Padre/tutor',
  administrator: 'Administración',
  instructor: 'Profesor',
};

export const STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Activa',
  inactive: 'Desactivada',
  no_account: 'Sin cuenta',
};

export const DOCUMENT_TYPES = ['DNI', 'CE', 'Pasaporte'] as const;

export const PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const isRole = (value: string | undefined): value is BackendRole => BACKEND_ROLES.includes(value as BackendRole);

/**
 * Filtros de la lista de usuarios leídos de la URL (`?q=&rol=&estado=&pagina=`).
 * Valores desconocidos se ignoran en vez de fallar: la URL la puede escribir cualquiera.
 */
export function parseUserFilters(params: SearchParams, fixedRole?: BackendRole): UserListFilters {
  const search = first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const role = fixedRole ?? (isRole(first(params.rol)) ? (first(params.rol) as BackendRole) : undefined);
  const rawStatus = first(params.estado);
  const status = rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus : undefined;
  const page = Number.parseInt(first(params.pagina) ?? '', 10);
  return { search, role, status, page: Number.isInteger(page) && page > 0 ? page : 1, pageSize: PAGE_SIZE };
}

/** URL de la lista con los filtros dados (omite los vacíos y la página 1). */
export function usersHref(basePath: string, filters: UserListFilters, page = filters.page ?? 1): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.role && basePath === '/admin/usuarios') params.set('rol', filters.role);
  if (filters.status) params.set('estado', filters.status);
  if (page > 1) params.set('pagina', String(page));
  const text = params.toString();
  return text ? `${basePath}?${text}` : basePath;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// ─── Matrículas ────────────────────────────────────────────────────────

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending: 'Pendiente de pago',
  active: 'Activa',
  withdrawn: 'Retirada',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filtros de la lista de matrículas desde la URL (`?estado=&grupo=&pagina=`). */
export function parseEnrollmentFilters(params: SearchParams): EnrollmentFilters {
  const rawStatus = first(params.estado);
  const status = ENROLLMENT_STATUSES.includes(rawStatus as EnrollmentStatus) ? (rawStatus as EnrollmentStatus) : undefined;
  const group = first(params.grupo);
  const page = Number.parseInt(first(params.pagina) ?? '', 10);
  return {
    status,
    courseOfferingId: group && UUID_RE.test(group) ? group : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE,
  };
}

export function enrollmentsHref(filters: EnrollmentFilters, page = filters.page ?? 1): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('estado', filters.status);
  if (filters.courseOfferingId) params.set('grupo', filters.courseOfferingId);
  if (page > 1) params.set('pagina', String(page));
  const text = params.toString();
  return text ? `/admin/matriculas?${text}` : '/admin/matriculas';
}
