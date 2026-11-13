import { describe, expect, it } from 'vitest';
import type { ChildConsent } from '@/types/consent';
import { CONSENT_MAX_CHILDREN, CONSENT_VERSION_MAX, declarationFor, listNames, parseAcceptance, pendingChildren } from './consent';

const ID_A = '0b6e8f3c-0000-4000-8000-000000000001';
const ID_B = '0b6e8f3c-0000-4000-8000-000000000002';

const child = (studentUserId: string, status: ChildConsent['status']): ChildConsent => ({
  studentUserId, fullName: `Hijo ${studentUserId.slice(-1)}`, status, acceptedAt: null, acceptedByName: null,
});

describe('listNames', () => {
  it('une los nombres como se dice en español', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Ana'])).toBe('Ana');
    expect(listNames(['Ana', 'Beto'])).toBe('Ana y Beto');
    expect(listNames(['Ana', 'Beto', 'Eva'])).toBe('Ana, Beto y Eva');
  });
});

describe('pendingChildren y declarationFor', () => {
  it('solo cuenta a los hijos que faltan', () => {
    expect(pendingChildren({ children: [child(ID_A, 'accepted'), child(ID_B, 'pending')] }).map((c) => c.studentUserId)).toEqual([ID_B]);
    expect(pendingChildren({ children: [child(ID_A, 'accepted')] })).toEqual([]);
  });

  it('la declaración nombra a los hijos por los que se acepta', () => {
    expect(declarationFor(['Ana Quispe'])).toBe('Soy el padre, la madre o el tutor legal de Ana Quispe, leí este texto y lo acepto.');
    expect(declarationFor(['Ana Quispe', 'Beto Quispe'])).toContain('de Ana Quispe y Beto Quispe');
  });
});

describe('parseAcceptance', () => {
  it('acepta una versión y hijos válidos, sin repetidos', () => {
    expect(parseAcceptance('2026-11', [ID_A, ID_B, ID_A])).toEqual({ ok: true, version: '2026-11', studentUserIds: [ID_A, ID_B] });
  });

  it('rechaza una versión vacía, larga o que no es texto', () => {
    for (const version of ['', '   ', 'x'.repeat(CONSENT_VERSION_MAX + 1), 7, null, undefined]) {
      expect(parseAcceptance(version, [ID_A]).ok).toBe(false);
    }
    expect(parseAcceptance('x'.repeat(CONSENT_VERSION_MAX), [ID_A]).ok).toBe(true);
  });

  it('exige al menos un hijo y que cada uno sea un identificador válido', () => {
    expect(parseAcceptance('v1', [])).toEqual({ ok: false, error: 'Elige al menos un hijo.' });
    expect(parseAcceptance('v1', 'no-es-lista')).toEqual({ ok: false, error: 'Elige al menos un hijo.' });
    expect(parseAcceptance('v1', ['no-es-id']).ok).toBe(false);
    expect(parseAcceptance('v1', [ID_A, 42]).ok).toBe(false);
  });

  it('limita cuántos hijos se aceptan a la vez, igual que el backend', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `0b6e8f3c-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(parseAcceptance('v1', many(CONSENT_MAX_CHILDREN)).ok).toBe(true);
    expect(parseAcceptance('v1', many(CONSENT_MAX_CHILDREN + 1)).ok).toBe(false);
  });
});
