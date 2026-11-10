import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, TEACHER_NAV } from '@/config/navigation';
import { currentHref } from './side-nav';

describe('currentHref', () => {
  it('marca el enlace más específico', () => {
    expect(currentHref(TEACHER_NAV, '/profesor/diagnosticos/abc')).toBe('/profesor/diagnosticos');
    expect(currentHref(TEACHER_NAV, '/profesor/grupos/abc')).toBe('/profesor');
    expect(currentHref(TEACHER_NAV, '/profesor')).toBe('/profesor');
  });

  it('respeta los enlaces exactos y no marca nada sin ruta', () => {
    expect(currentHref(ADMIN_NAV, '/admin/diagnosticos')).toBe('/admin/diagnosticos');
    expect(currentHref(ADMIN_NAV, '/admin')).toBe('/admin');
    expect(currentHref(ADMIN_NAV, undefined)).toBeUndefined();
  });
});
