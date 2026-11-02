import { describe, expect, it } from 'vitest';
import { pageCount, parseUserFilters, usersHref } from './format';

describe('parseUserFilters', () => {
  it('lee búsqueda, rol, estado y página válidos', () => {
    expect(parseUserFilters({ q: '  ana quispe ', rol: 'guardian', estado: 'inactive', pagina: '3' })).toEqual({
      search: 'ana quispe',
      role: 'guardian',
      status: 'inactive',
      page: 3,
      pageSize: 20,
    });
  });

  it('ignora valores desconocidos o mal formados', () => {
    expect(parseUserFilters({ q: '   ', rol: 'superuser', estado: 'deleted', pagina: '-2' })).toEqual({
      search: undefined,
      role: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(parseUserFilters({ pagina: 'abc' }).page).toBe(1);
  });

  it('usa el primer valor si un parámetro se repite y recorta búsquedas largas', () => {
    const filters = parseUserFilters({ q: ['x'.repeat(300), 'otro'], rol: ['student', 'guardian'] });
    expect(filters.search).toHaveLength(100);
    expect(filters.role).toBe('student');
  });

  it('un rol fijo (p. ej. la página de familias) gana sobre la URL', () => {
    expect(parseUserFilters({ rol: 'student' }, 'guardian').role).toBe('guardian');
  });
});

describe('usersHref', () => {
  it('omite filtros vacíos y la página 1', () => {
    expect(usersHref('/admin/usuarios', { page: 1 })).toBe('/admin/usuarios');
    expect(usersHref('/admin/usuarios', { search: 'ana', role: 'student', status: 'active' }, 2)).toBe(
      '/admin/usuarios?q=ana&rol=student&estado=active&pagina=2',
    );
  });

  it('no repite el rol en páginas que ya lo fijan', () => {
    expect(usersHref('/admin/familias', { role: 'guardian', search: 'rosa' }, 1)).toBe('/admin/familias?q=rosa');
  });
});

describe('pageCount', () => {
  it('siempre hay al menos una página', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
});
