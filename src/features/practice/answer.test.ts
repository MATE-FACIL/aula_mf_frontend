import { describe, expect, it } from 'vitest';
import { answerFormatError, firstPending, PRACTICE_ANSWER_MAX, progressLabel } from './answer';

const choice = { kind: 'multiple_choice' as const, options: ['3/4', '2/6', '1/6'] };
const numeric = { kind: 'numeric' as const, options: [] };

describe('answerFormatError', () => {
  it('opción múltiple: solo un índice de las opciones', () => {
    expect(answerFormatError(choice, '0')).toBeNull();
    expect(answerFormatError(choice, '2')).toBeNull();
    expect(answerFormatError(choice, '3')).toBe('Elige una de las opciones.');
    expect(answerFormatError(choice, '')).toBe('Elige una de las opciones.');
    expect(answerFormatError(choice, '-1')).toBe('Elige una de las opciones.');
    expect(answerFormatError(choice, '1.5')).toBe('Elige una de las opciones.');
  });

  it('numérica: acepta coma o punto decimal y signo, como el backend', () => {
    for (const ok of ['3', '3,5', '3.5', '-2', ' 0,75 ', '+4']) expect(answerFormatError(numeric, ok)).toBeNull();
  });

  it('numérica: rechaza texto, fracciones, miles y respuestas largas sin gastar una petición', () => {
    expect(answerFormatError(numeric, '')).toBe('Escribe tu respuesta.');
    for (const bad of ['tres', '3/4', '1,000.5', '3,', '1e3']) expect(answerFormatError(numeric, bad)).toBe('Escribe un número, por ejemplo 3,5.');
    expect(answerFormatError(numeric, '1'.repeat(PRACTICE_ANSWER_MAX + 1))).not.toBeNull();
  });
});

describe('firstPending', () => {
  it('retoma en el primer ejercicio sin resolver', () => {
    expect(firstPending([{ solved: true }, { solved: false }, { solved: false }])).toBe(1);
  });
  it('si ya resolvió todos, empieza por el primero', () => {
    expect(firstPending([{ solved: true }, { solved: true }])).toBe(0);
    expect(firstPending([])).toBe(0);
  });
});

describe('progressLabel', () => {
  it('cuenta resueltos y porcentaje', () => {
    expect(progressLabel({ solved: 2, total: 3, percent: 67 })).toBe('2 de 3 resueltos · 67 %');
    expect(progressLabel({ solved: 1, total: 1, percent: 100 })).toBe('1 de 1 resuelto · 100 %');
  });
  it('sin ejercicios no muestra 0 %', () => {
    expect(progressLabel({ solved: 0, total: 0, percent: null })).toBe('Sin ejercicios todavía');
  });
});
