import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { ChildOverview } from '@/types/domain';
import type { RequestContext } from '../contracts';
import { toChildOverview, type FamilyChildDto } from './family-children';

/** UNA petición: el backend arma los hijos del padre de la sesión, sin ningún id de alumno que se pueda alterar. */
export async function fetchChildren({ token }: RequestContext): Promise<ChildOverview[]> {
  const children = await apiRequest<FamilyChildDto[]>('/families/me/children', { token });
  return children.map(toChildOverview);
}
