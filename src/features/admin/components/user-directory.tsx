import type { BackendRole } from '@/types/admin';
import { parseUserFilters } from '../format';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import { Pagination, UserFilters, UsersTable } from './users-table';

// Lista paginada y filtrable, compartida por «Usuarios» y «Familias».
// Los filtros salen de la URL → cada página es UNA petición al backend, que pagina en la base de datos.

interface Props {
  basePath: '/admin/usuarios' | '/admin/familias';
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  fixedRole?: BackendRole;
  linksLabel?: string;
}

export async function UserDirectory({ basePath, searchParams, fixedRole, linksLabel }: Props) {
  const [ctx, params] = await Promise.all([requireSession('admin'), searchParams]);
  const filters = parseUserFilters(params, fixedRole);
  const page = await services.admin.listUsers(ctx, filters);
  return (
    <>
      <UserFilters basePath={basePath} filters={filters} showRole={!fixedRole} />
      <UsersTable users={page.items} timeZone={ctx.user.timeZone} linksLabel={linksLabel} />
      <Pagination basePath={basePath} filters={filters} total={page.total} />
    </>
  );
}
