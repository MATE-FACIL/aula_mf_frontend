import { describe, expect, it } from 'vitest';
import { blankDraft } from '@/features/practice/editor-rules';
import { fromLocalInput, hasProblems, parsePayload, toLocalInput, toPayload, validateEvaluation, windowState, type EvaluationFormState } from './rules';

const draft = (extra = {}) => ({ ...blankDraft(), prompt: '¿1/2 + 1/4?', options: ['3/4', '2/6'], correctOption: 0, competency: 'calculo', ...extra });
const form = (extra: Partial<EvaluationFormState> = {}): EvaluationFormState => ({
  kind: 'weekly', title: ' Semanal 1 ', opens: '2026-11-20T17:00', closes: '2026-11-27T17:00', duration: '30', isPublished: true, drafts: [draft()], ...extra,
});

describe('fechas en hora de Perú', () => {
  it('ida y vuelta: lo que se escribe es lo que se ve (UTC-5)', () => {
    expect(fromLocalInput('2026-11-20T17:00')).toBe('2026-11-20T22:00:00.000Z');
    expect(toLocalInput('2026-11-20T22:00:00.000Z')).toBe('2026-11-20T17:00');
    expect(toLocalInput(fromLocalInput('2026-12-31T23:30')!)).toBe('2026-12-31T23:30');
  });

  it('un valor vacío o mal escrito no es una fecha', () => {
    for (const bad of ['', '2026-11-20', '20/11/2026 17:00', 'mañana']) expect(fromLocalInput(bad)).toBeNull();
  });
});

describe('validateEvaluation', () => {
  it('una evaluación completa no tiene problemas', () => {
    expect(hasProblems(validateEvaluation(form()))).toBe(false);
  });

  it('avisa cada problema donde ocurre', () => {
    const problems = validateEvaluation(form({
      title: ' ', closes: '2026-11-20T16:00', duration: '4', drafts: [draft({ competency: '' }), draft({ prompt: '' })],
    }));
    expect(problems.title).toBe('Escribe el título.');
    expect(problems.window).toBe('El cierre debe ser posterior a la apertura.');
    expect(problems.duration).toContain('5 a 180');
    expect(problems.byQuestion[0]).toBe('Elige la competencia que mide.');
    expect(problems.byQuestion[1]).toBe('Escribe el enunciado.');
  });

  it('publicar exige al menos una pregunta, pero un borrador puede ir sin ellas', () => {
    expect(validateEvaluation(form({ drafts: [] })).questions).toContain('al menos una pregunta');
    expect(hasProblems(validateEvaluation(form({ drafts: [], isPublished: false })))).toBe(false);
  });

  it('exige las dos fechas', () => {
    expect(validateEvaluation(form({ opens: '' })).window).toBe('Indica cuándo abre y cuándo cierra.');
  });
});

describe('toPayload y parsePayload (ida y vuelta por el servidor)', () => {
  it('lo que arma el formulario lo acepta el servidor, sin identificadores', () => {
    const payload = toPayload(form());
    expect(payload).toMatchObject({ kind: 'weekly', title: 'Semanal 1', durationMinutes: 30, isPublished: true, opensAt: '2026-11-20T22:00:00.000Z' });
    expect(payload.questions[0]).toMatchObject({ competency: 'calculo', kind: 'multiple_choice', options: ['3/4', '2/6'], correctOption: 0 });
    expect('id' in payload.questions[0]).toBe(false);
    expect(parsePayload(JSON.stringify(payload))).toEqual(payload);
  });

  it('rechaza lo mal formado', () => {
    const ok = toPayload(form());
    const bad = [
      'no json', '[]', JSON.stringify({ ...ok, kind: 'otro' }), JSON.stringify({ ...ok, title: ' ' }), JSON.stringify({ ...ok, closesAt: ok.opensAt }),
      JSON.stringify({ ...ok, durationMinutes: 181 }), JSON.stringify({ ...ok, durationMinutes: 30.5 }), JSON.stringify({ ...ok, isPublished: 'si' }),
      JSON.stringify({ ...ok, questions: [{ ...ok.questions[0], competency: null }] }), JSON.stringify({ ...ok, questions: 'x' }), 7, undefined,
    ];
    for (const value of bad) expect(parsePayload(value)).toBeNull();
  });
});

describe('windowState', () => {
  it('antes, durante y después de la ventana', () => {
    const opens = '2026-11-20T22:00:00.000Z';
    const closes = '2026-11-27T22:00:00.000Z';
    expect(windowState(opens, closes, Date.parse(opens) - 1)).toBe('upcoming');
    expect(windowState(opens, closes, Date.parse(opens))).toBe('open');
    expect(windowState(opens, closes, Date.parse(closes))).toBe('open');
    expect(windowState(opens, closes, Date.parse(closes) + 1)).toBe('closed');
  });
});
