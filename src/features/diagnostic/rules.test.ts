import { describe, expect, it } from 'vitest';
import { answeredLabel, decimalComma, firstUnanswered, isFilter, isLevelCode, scoreDiagnostic } from './rules';

const a = (level: 'prebasic' | 'basic' | 'intermediate' | 'advanced', topic: string, correct: boolean) => ({ level, topic, correct });

describe('scoreDiagnostic', () => {
  it('sugiere el primer nivel que aún no domina (igual que el backend)', () => {
    const score = scoreDiagnostic([
      a('prebasic', 'Conteo', true), a('prebasic', 'Conteo', true),
      a('basic', 'Fracciones', true), a('basic', 'Fracciones', true),
      a('intermediate', 'Decimales', true), a('intermediate', 'Decimales', false),
    ]);
    expect(score.suggested).toBe('intermediate');
    expect(score.levels.map((line) => line.percent)).toEqual([100, 100, 50]);
  });

  it('con el 60 % domina el nivel', () => {
    const score = scoreDiagnostic([
      a('prebasic', 'Conteo', true), a('prebasic', 'Conteo', true), a('prebasic', 'Conteo', true),
      a('prebasic', 'Conteo', false), a('prebasic', 'Conteo', false), a('basic', 'Fracciones', false),
    ]);
    expect(score.suggested).toBe('basic');
  });

  it('si domina todos, sugiere el más alto medido; si falla el primero, el primero', () => {
    expect(scoreDiagnostic([a('prebasic', 'X', true), a('basic', 'Y', true)]).suggested).toBe('basic');
    expect(scoreDiagnostic([a('prebasic', 'X', false), a('basic', 'Y', true)]).suggested).toBe('prebasic');
  });

  it('los temas conservan su orden y se juntan sin importar mayúsculas', () => {
    const score = scoreDiagnostic([a('prebasic', 'Fracciones', true), a('prebasic', 'Geometría', false), a('basic', 'fracciones', false)]);
    expect(score.topics).toEqual([
      { label: 'Fracciones', correct: 1, total: 2, percent: 50 },
      { label: 'Geometría', correct: 0, total: 1, percent: 0 },
    ]);
  });
});

describe('ayudas', () => {
  it('retoma en la primera sin responder', () => {
    expect(firstUnanswered([{ answered: true }, { answered: false }])).toBe(1);
    expect(firstUnanswered([{ answered: true }])).toBe(0);
  });

  it('valida niveles y filtros que llegan del navegador', () => {
    expect(isLevelCode('basic')).toBe(true);
    expect(isLevelCode('expert')).toBe(false);
    expect(isFilter('pending')).toBe(true);
    expect(isFilter('raro')).toBe(false);
  });

  it('muestra los decimales con coma', () => {
    expect(decimalComma('0.75')).toBe('0,75');
    expect(decimalComma('42')).toBe('42');
    expect(decimalComma('1/2')).toBe('1/2');
  });

  it('cuenta en singular y plural', () => {
    expect(answeredLabel(1, 1)).toBe('1 de 1 respondida');
    expect(answeredLabel(3, 10)).toBe('3 de 10 respondidas');
  });
});
