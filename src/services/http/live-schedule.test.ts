import { describe, expect, it } from 'vitest';
import { calendarFrom, scheduleRange, toLiveClass, upcoming, weekStartOf, type StudentClassDto } from './live-schedule';

const TZ = 'America/Lima';
const dto = (overrides: Partial<StudentClassDto> = {}): StudentClassDto => ({
  sessionId: 's1',
  offeringId: 'o1',
  courseTitle: 'Matemáticas · Secundaria',
  offeringName: 'Grupo A',
  categoryName: 'Matemáticas',
  startsAt: '2026-11-04T22:00:00.000Z',
  endsAt: '2026-11-04T23:30:00.000Z',
  virtualLink: 'https://meet.example.com/a',
  teachers: ['Lucía Paredes'],
  ...overrides,
});

describe('toLiveClass', () => {
  it('convierte duración, profesor y enlace', () => {
    expect(toLiveClass(dto())).toEqual({
      id: 's1', startsAt: '2026-11-04T22:00:00.000Z', durationMin: 90, course: 'Matemáticas · Secundaria',
      topic: 'Grupo A', teacher: 'Lucía Paredes', track: 'math', joinUrl: 'https://meet.example.com/a',
    });
  });

  it('detecta laboratorios y cubre clases sin profesor ni enlace', () => {
    const lab = toLiveClass(dto({ courseTitle: 'Lab Roblox', categoryName: 'Laboratorio digital', teachers: [], virtualLink: null }));
    expect(lab.track).toBe('lab');
    expect(lab.teacher).toBe('Profesor por confirmar');
    expect(lab.joinUrl).toBeNull();
  });
});

describe('rango y calendario', () => {
  it('la semana empieza el lunes en hora de Perú', () => {
    // Miércoles 4 nov 2026, 23:00 en Lima (04:00 UTC del jueves).
    const now = Date.parse('2026-11-05T04:00:00.000Z');
    expect(weekStartOf(now, TZ)).toBe('2026-11-02');
    expect(scheduleRange(now, TZ)).toEqual({ weekStart: '2026-11-02', from: '2026-11-02T05:00:00.000Z', to: '2026-12-07T05:00:00.000Z' });
  });

  it('cada clase es un evento del día local', () => {
    expect(calendarFrom([toLiveClass(dto())], TZ)).toEqual([{ date: '2026-11-04', time: '5:00 p. m.', label: 'Matemáticas · Secundaria', kind: 'math' }]);
  });

  it('«Inicio» muestra solo las que aún no terminan', () => {
    const classes = [toLiveClass(dto()), toLiveClass(dto({ sessionId: 's2', startsAt: '2026-11-06T22:00:00.000Z', endsAt: '2026-11-06T23:30:00.000Z' }))];
    expect(upcoming(classes, Date.parse('2026-11-05T00:00:00.000Z')).map((c) => c.id)).toEqual(['s2']);
  });
});
