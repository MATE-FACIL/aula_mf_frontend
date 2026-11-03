import { describe, expect, it } from 'vitest';
import { enrollmentsHref, parseEnrollmentFilters } from './format';

const GROUP = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('parseEnrollmentFilters', () => {
  it('lee estado, grupo y página válidos', () => {
    expect(parseEnrollmentFilters({ estado: 'pending', grupo: GROUP, pagina: '2' })).toEqual({
      status: 'pending',
      courseOfferingId: GROUP,
      page: 2,
      pageSize: 20,
    });
  });

  it('ignora estados desconocidos y grupos que no son un id', () => {
    expect(parseEnrollmentFilters({ estado: 'paid', grupo: "1' OR 1=1" })).toEqual({
      status: undefined,
      courseOfferingId: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});

describe('enrollmentsHref', () => {
  it('arma la URL omitiendo lo vacío', () => {
    expect(enrollmentsHref({})).toBe('/admin/matriculas');
    expect(enrollmentsHref({ status: 'active', courseOfferingId: GROUP }, 3)).toBe(`/admin/matriculas?estado=active&grupo=${GROUP}&pagina=3`);
  });
});
