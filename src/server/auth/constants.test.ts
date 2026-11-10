import { describe, expect, it } from 'vitest';
import { areaOf } from './constants';

describe('areaOf', () => {
  it('el diagnóstico del alumno es del área del alumno; su revisión, del profesor y del administrador', () => {
    expect(areaOf('/diagnostico')).toBe('student');
    expect(areaOf('/diagnostico/0b6e8f3c-0000-4000-8000-000000000001')).toBe('student');
    expect(areaOf('/profesor/diagnosticos')).toBe('teacher');
    expect(areaOf('/admin/diagnosticos')).toBe('admin');
  });
});
