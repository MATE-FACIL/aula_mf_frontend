import { describe, expect, it } from 'vitest';
import { checkCover, parseCourseForm, parseGuardianForm, parseStudentForm } from './validation';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('parseStudentForm', () => {
  it('limpia espacios y omite opcionales vacíos', () => {
    const result = parseStudentForm(form({ givenNames: ' Ana ', firstSurname: 'Quispe', secondSurname: ' ', documentNumber: '77340061', email: '' }));
    expect(result).toEqual({
      ok: true,
      value: { givenNames: 'Ana', firstSurname: 'Quispe', secondSurname: undefined, email: undefined, documentType: 'DNI', documentNumber: '77340061', guardianUserId: undefined },
    });
  });

  it('exige nombres, apellido y documento, y valida el correo', () => {
    const result = parseStudentForm(form({ email: 'no-es-correo', documentNumber: '12' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(['documentNumber', 'email', 'firstSurname', 'givenNames']);
  });

  it('rechaza un tutor que no es un id válido', () => {
    const result = parseStudentForm(form({ givenNames: 'Ana', firstSurname: 'Quispe', documentNumber: '77340061', guardianUserId: "1' OR 1=1" }));
    expect(result.ok).toBe(false);
  });
});

describe('parseGuardianForm', () => {
  it('el correo es obligatorio y el documento opcional', () => {
    expect(parseGuardianForm(form({ givenNames: 'Rosa', firstSurname: 'Roque' })).ok).toBe(false);
    expect(parseGuardianForm(form({ givenNames: 'Rosa', firstSurname: 'Roque', email: 'rosa@correo.pe' }))).toEqual({
      ok: true,
      value: { givenNames: 'Rosa', firstSurname: 'Roque', secondSurname: undefined, email: 'rosa@correo.pe', documentType: undefined, documentNumber: undefined },
    });
  });
});

describe('parseCourseForm', () => {
  it('convierte textos vacíos en null y exige título', () => {
    expect(parseCourseForm(form({ title: '' })).ok).toBe(false);
    const result = parseCourseForm(form({ title: 'Mate', shortDescription: 'Corta', syllabus: '  ' }));
    expect(result.ok && result.value).toMatchObject({ title: 'Mate', categoryId: null, shortDescription: 'Corta', syllabus: null });
  });
});

describe('checkCover', () => {
  it('acepta imágenes livianas y rechaza otros tipos o tamaños', () => {
    expect(checkCover({ size: 1000, type: 'image/webp' })).toBeNull();
    expect(checkCover({ size: 1000, type: 'image/gif' })).toMatch(/JPG/);
    expect(checkCover({ size: 6 * 1024 * 1024, type: 'image/png' })).toMatch(/5 MB/);
    expect(checkCover(null)).toMatch(/Elige/);
  });
});
