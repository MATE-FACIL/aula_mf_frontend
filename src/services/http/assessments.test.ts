import { describe, expect, it } from 'vitest';
import { toAttempt, toResult, toSummary, type StartedAttemptDto, type StudentEvaluationDto, type SubmittedResultDto } from './assessments';

const base: StudentEvaluationDto = {
  id: 'e1', kind: 'weekly', title: 'Semanal 1', courseTitle: 'Curso', offeringName: 'Grupo', opensAt: '2026-11-20T22:00:00.000Z', closesAt: '2026-11-27T22:00:00.000Z',
  durationMinutes: 30, questionCount: 4, status: 'open', score: null, percent: null, attemptId: null,
};
const TZ = 'America/Lima';

describe('toSummary', () => {
  it('abierta o ya empezada: «por rendir», con su cierre en hora local', () => {
    const open = toSummary(base, TZ);
    expect(open).toMatchObject({ kind: 'Semanal', topic: 'Semanal 1', status: 'available', score: null });
    expect(open.dateLabel).toContain('Cierra');
    expect(open.dateLabel).toContain('5:00');
    expect(open.resultLabel).toBe('4 preguntas · 30 min');
    expect(toSummary({ ...base, status: 'in_progress' }, TZ)).toMatchObject({ status: 'available', resultLabel: 'Ya empezaste · 4 preguntas · 30 min' });
  });

  it('calificada: la nota en porcentaje y los puntos sobre 20', () => {
    expect(toSummary({ ...base, status: 'graded', score: 13.5, percent: 68 }, TZ)).toMatchObject({ status: 'graded', score: 68, resultLabel: '13,5 de 20 puntos' });
  });

  it('próxima y perdida', () => {
    expect(toSummary({ ...base, status: 'upcoming' }, TZ)).toMatchObject({ status: 'upcoming', score: null });
    expect(toSummary({ ...base, status: 'upcoming' }, TZ).dateLabel).toContain('Abre');
    expect(toSummary({ ...base, status: 'missed' }, TZ)).toMatchObject({ status: 'missed', resultLabel: 'Sin rendir' });
  });

  it('los tipos intermedia y final', () => {
    expect(toSummary({ ...base, kind: 'midterm' }, TZ).kind).toBe('Intermedia');
    expect(toSummary({ ...base, kind: 'final' }, TZ).kind).toBe('Final');
  });
});

describe('toAttempt', () => {
  it('convierte el tipo de cada pregunta y conserva el plazo del servidor', () => {
    const dto: StartedAttemptDto = {
      attemptId: 'a1', evaluationId: 'e1', title: 'Semanal 1', durationSeconds: 1800, startedAt: '2026-11-20T22:00:00.000Z', deadline: '2026-11-20T22:30:00.000Z',
      serverNow: '2026-11-20T22:00:00.100Z',
      questions: [
        { id: 'q1', number: 1, kind: 'multiple_choice', competency: 'calculo', prompt: '¿1/2 + 1/4?', options: ['3/4', '2/6'] },
        { id: 'q2', number: 2, kind: 'numeric', competency: 'calculo', prompt: '¿7 ÷ 2?', options: [] },
      ],
    };
    expect(toAttempt(dto)).toEqual({
      attemptId: 'a1', title: 'Semanal 1', durationSec: 1800, startedAt: dto.startedAt, deadline: dto.deadline,
      questions: [{ id: 'q1', type: 'choice', text: '¿1/2 + 1/4?', options: ['3/4', '2/6'] }, { id: 'q2', type: 'number', text: '¿7 ÷ 2?' }],
    });
  });
});

describe('toResult', () => {
  it('porcentaje como nota principal, puntos sobre 20 y competencias con su nombre', () => {
    const dto: SubmittedResultDto = {
      evaluationId: 'e1', score: 10, percent: 50, correctCount: 2, total: 4, late: true,
      byCompetency: [{ competency: 'calculo', label: 'Cálculo y operaciones', correct: 2, total: 2 }],
      questions: [{ questionId: 'q1', isCorrect: true, explanation: 'Porque sí' }, { questionId: 'q2', isCorrect: false, explanation: null }],
    };
    expect(toResult(dto)).toEqual({
      score: 50, correctCount: 2, total: 4, points: 10, late: true,
      byCompetency: [{ competency: 'Cálculo y operaciones', correct: 2, total: 2 }],
      questions: [{ questionId: 'q1', correct: true, explanation: 'Porque sí' }, { questionId: 'q2', correct: false, explanation: '' }],
    });
  });
});
