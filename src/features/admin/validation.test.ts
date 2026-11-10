import { describe, expect, it } from 'vitest';
import { checkCover, parseCourseForm, parseGuardianForm, parseOfferingForm, parseStudentForm, parseTransferForm, TRANSFER_REASON_MAX } from './validation';

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
    expect(result.ok && result.value).toMatchObject({ title: 'Mate', categoryId: null, shortDescription: 'Corta', syllabus: null, sessionDurationMinutes: null });
  });

  it('acepta la duración de clase por etapa y rechaza valores fuera de rango', () => {
    const ok = parseCourseForm(form({ title: 'Mate', sessionDurationMinutes: '90' }));
    expect(ok.ok && ok.value.sessionDurationMinutes).toBe(90);
    expect(parseCourseForm(form({ title: 'Mate', sessionDurationMinutes: '15' })).ok).toBe(false);
    expect(parseCourseForm(form({ title: 'Mate', sessionDurationMinutes: 'abc' })).ok).toBe(false);
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

describe('parseOfferingForm', () => {
  const session = { id: null, startsAt: '2026-11-02T22:00:00.000Z', endsAt: '2026-11-02T23:30:00.000Z', virtualLink: 'https://meet.example.com/a' };
  const valid = { name: 'Grupo A', maximumCapacity: '8', basePrice: '180', currencyCode: 'PEN', sessions: JSON.stringify([session]) };

  it('arma el grupo con la cantidad de clases del horario', () => {
    const result = parseOfferingForm(form(valid));
    expect(result.ok && result.value).toEqual({ name: 'Grupo A', maximumCapacity: 8, basePrice: 180, currencyCode: 'PEN', plannedSessionCount: 1, sessions: [session] });
  });

  it('rechaza horarios mal formados, enlaces no http y cupos inválidos', () => {
    expect(parseOfferingForm(form({ ...valid, sessions: 'no-json' })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, sessions: '[]' })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, sessions: JSON.stringify([{ ...session, endsAt: session.startsAt }]) })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, sessions: JSON.stringify([{ ...session, virtualLink: 'javascript:alert(1)' }]) })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, sessions: JSON.stringify([{ ...session, id: 'x' }]) })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, maximumCapacity: '0' })).ok).toBe(false);
    expect(parseOfferingForm(form({ ...valid, currencyCode: 'EUR' })).ok).toBe(false);
  });
});

describe('parseTransferForm (SCRUM-45)', () => {
  const ENROLLMENT = '0b6e8f3c-0000-4000-8000-000000000001';
  const GROUP = '0b6e8f3c-0000-4000-8000-000000000002';

  it('limpia el motivo y lo omite si queda vacío', () => {
    expect(parseTransferForm(form({ enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: '  El diagnóstico confirmó Básico  ' })))
      .toEqual({ ok: true, value: { enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: 'El diagnóstico confirmó Básico' } });
    expect(parseTransferForm(form({ enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: '   ' })))
      .toEqual({ ok: true, value: { enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: undefined } });
  });

  it('exige una matrícula y un grupo de destino válidos', () => {
    expect(parseTransferForm(form({ courseOfferingId: GROUP }))).toEqual({ ok: false, fieldErrors: { enrollmentId: 'La solicitud no es válida. Recarga la página.' } });
    expect(parseTransferForm(form({ enrollmentId: ENROLLMENT, courseOfferingId: 'no-es-id' }))).toEqual({ ok: false, fieldErrors: { courseOfferingId: 'Elige el grupo de destino.' } });
  });

  it('rechaza un motivo demasiado largo (igual que el backend)', () => {
    const result = parseTransferForm(form({ enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: 'x'.repeat(TRANSFER_REASON_MAX + 1) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.reason).toContain('300');
    expect(parseTransferForm(form({ enrollmentId: ENROLLMENT, courseOfferingId: GROUP, reason: 'x'.repeat(TRANSFER_REASON_MAX) })).ok).toBe(true);
  });
});
