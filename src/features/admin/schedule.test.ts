import { describe, expect, it } from 'vitest';
import { generateSessions, sessionMinutes } from './schedule';

describe('generateSessions', () => {
  it('genera las clases en los días marcados, en hora de Perú (UTC-5)', () => {
    // 2 nov 2026 es lunes. Lunes y miércoles a las 17:00 durante 4 clases.
    const result = generateSessions({ startDate: '2026-11-02', weekdays: [1, 3], time: '17:00', durationMinutes: 60, count: 4 });
    expect(result.ok && result.sessions.map((s) => s.startsAt)).toEqual([
      '2026-11-02T22:00:00.000Z',
      '2026-11-04T22:00:00.000Z',
      '2026-11-09T22:00:00.000Z',
      '2026-11-11T22:00:00.000Z',
    ]);
  });

  it('aplica la duración por etapa (90 min en secundaria)', () => {
    const result = generateSessions({ startDate: '2026-11-07', weekdays: [6], time: '10:00', durationMinutes: 90, count: 1 });
    expect(result.ok && result.sessions[0]).toEqual({ startsAt: '2026-11-07T15:00:00.000Z', endsAt: '2026-11-07T16:30:00.000Z' });
    expect(result.ok && sessionMinutes(result.sessions[0])).toBe(90);
  });

  it('empieza el mismo día si coincide y salta los días no marcados', () => {
    const result = generateSessions({ startDate: '2026-11-04', weekdays: [1], time: '08:30', durationMinutes: 60, count: 1 });
    expect(result.ok && result.sessions[0].startsAt).toBe('2026-11-09T13:30:00.000Z');
  });

  it('valida los datos antes de generar', () => {
    const base = { startDate: '2026-11-02', weekdays: [1], time: '17:00', durationMinutes: 60, count: 4 };
    expect(generateSessions({ ...base, weekdays: [] }).ok).toBe(false);
    expect(generateSessions({ ...base, time: '25:00' }).ok).toBe(false);
    expect(generateSessions({ ...base, durationMinutes: 10 }).ok).toBe(false);
    expect(generateSessions({ ...base, count: 0 }).ok).toBe(false);
    expect(generateSessions({ ...base, startDate: 'mañana' }).ok).toBe(false);
  });
});
