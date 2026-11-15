import { describe, expect, it } from 'vitest';
import type { ExerciseAdmin } from '@/types/practice';
import { blankDraft, MAX_EXERCISES, parseInputs, parseNumber, removeOption, toDrafts, toInputs, validateDrafts } from './editor-rules';

const choice = (extra = {}) => ({ ...blankDraft(), prompt: '¿1/2 + 1/4?', options: ['3/4', '2/6'], correctOption: 0, ...extra });
const numeric = (extra = {}) => ({ ...blankDraft('numeric'), prompt: '¿7 ÷ 2?', correctNumber: '3,5', ...extra });

describe('parseNumber', () => {
  it('acepta coma o punto y rechaza lo que no es un número', () => {
    expect(parseNumber('3,5')).toBe(3.5);
    expect(parseNumber(' -0.25 ')).toBe(-0.25);
    for (const bad of ['', 'abc', '1,2,3', '1/2', '3,']) expect(parseNumber(bad)).toBeNull();
  });
});

describe('validateDrafts', () => {
  it('un ejercicio completo no tiene errores', () => {
    expect(validateDrafts([choice(), numeric()])).toEqual({});
  });

  it('dice qué falta en cada ejercicio, por su posición', () => {
    const errors = validateDrafts([
      choice({ prompt: '  ' }), choice({ options: ['a', ''] }), choice({ options: ['A', 'a'] }), choice({ correctOption: null }),
      numeric({ correctNumber: '' }), numeric({ tolerance: '-1' }), choice({ prompt: 'x'.repeat(1001) }),
    ]);
    expect(errors[0]).toBe('Escribe el enunciado.');
    expect(errors[1]).toContain('Completa todas las opciones');
    expect(errors[2]).toBe('Las opciones no se pueden repetir.');
    expect(errors[3]).toContain('Marca cuál');
    expect(errors[4]).toBe('Escribe el número correcto.');
    expect(errors[5]).toContain('tolerancia');
    expect(errors[6]).toContain('1000');
  });

  it('limita la cantidad por lección', () => {
    expect(validateDrafts(Array.from({ length: MAX_EXERCISES + 1 }, () => numeric()))[-1]).toContain('30');
  });
});

describe('removeOption', () => {
  it('quita una opción y mueve la marca de la correcta', () => {
    expect(removeOption(choice({ options: ['a', 'b', 'c'], correctOption: 2 }), 0)).toMatchObject({ options: ['b', 'c'], correctOption: 1 });
    expect(removeOption(choice({ options: ['a', 'b', 'c'], correctOption: 1 }), 1).correctOption).toBeNull();
    expect(removeOption(choice({ options: ['a', 'b', 'c'], correctOption: 0 }), 2).correctOption).toBe(0);
  });

  it('no deja menos de dos opciones', () => {
    const draft = choice();
    expect(removeOption(draft, 0)).toBe(draft);
  });
});

describe('toDrafts y toInputs', () => {
  const stored: ExerciseAdmin[] = [
    { id: '0b6e8f3c-0000-4000-8000-000000000001', number: 1, kind: 'multiple_choice', prompt: 'P', options: ['a', 'b'], correctOption: 1, correctNumber: null, tolerance: 0, explanation: null },
    { id: '0b6e8f3c-0000-4000-8000-000000000002', number: 2, kind: 'numeric', prompt: 'Q', options: [], correctOption: null, correctNumber: 3.5, tolerance: 0.1, explanation: 'Porque sí' },
  ];

  it('ida y vuelta conserva el id (y con él el historial de los alumnos)', () => {
    const inputs = toInputs(toDrafts(stored));
    expect(inputs[0]).toMatchObject({ id: stored[0].id, kind: 'multiple_choice', options: ['a', 'b'], correctOption: 1, explanation: null });
    expect(inputs[1]).toMatchObject({ id: stored[1].id, kind: 'numeric', correctNumber: 3.5, tolerance: 0.1, explanation: 'Porque sí' });
  });

  it('un ejercicio nuevo no lleva id y descarta lo del otro tipo', () => {
    expect(toInputs([choice({ correctNumber: '9' })])[0]).toMatchObject({ id: null, correctNumber: null, tolerance: null });
  });
});

describe('parseInputs (lo que recibe el servidor)', () => {
  const ok = { id: null, kind: 'numeric', prompt: ' P ', correctNumber: 2, tolerance: 0, explanation: null };

  it('acepta un envío válido y limpia espacios', () => {
    expect(parseInputs(JSON.stringify([ok]))?.[0]).toMatchObject({ prompt: 'P', correctNumber: 2, options: null });
    expect(parseInputs('[]')).toEqual([]);
  });

  it('rechaza lo mal formado', () => {
    const bad = [
      'no json', '{}', JSON.stringify([{ ...ok, kind: 'otro' }]), JSON.stringify([{ ...ok, prompt: ' ' }]), JSON.stringify([{ ...ok, id: 'x' }]),
      JSON.stringify([{ ...ok, correctNumber: '2' }]), JSON.stringify([{ ...ok, tolerance: -1 }]),
      JSON.stringify([{ id: null, kind: 'multiple_choice', prompt: 'P', options: ['a'], correctOption: 0 }]),
      JSON.stringify([{ id: null, kind: 'multiple_choice', prompt: 'P', options: ['a', 'b'], correctOption: 2 }]),
      JSON.stringify(Array.from({ length: 31 }, () => ok)), 42, undefined,
    ];
    for (const value of bad) expect(parseInputs(value)).toBeNull();
  });
});
