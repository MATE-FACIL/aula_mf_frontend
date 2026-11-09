import { describe, expect, it } from 'vitest';
import { ATTENDANCE_NOTE_MAX, parseAttendanceForm } from './validation';

const ANA = '11111111-1111-4111-8111-111111111111';
const LUIS = '22222222-2222-4222-8222-222222222222';

const roster = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
};

describe('parseAttendanceForm', () => {
  it('envía solo a los alumnos marcados, con su nota limpia', () => {
    const result = parseAttendanceForm(roster([
      ['student', ANA], [`status-${ANA}`, 'late'], [`note-${ANA}`, '  Entró 10 min tarde '],
      ['student', LUIS], [`note-${LUIS}`, 'sin estado: no se envía'],
    ]));
    expect(result).toEqual({ ok: true, value: [{ studentUserId: ANA, status: 'late', note: 'Entró 10 min tarde' }] });
  });

  it('una nota vacía viaja como null', () => {
    const result = parseAttendanceForm(roster([['student', ANA], [`status-${ANA}`, 'present'], [`note-${ANA}`, '   ']]));
    expect(result.ok && result.value[0].note).toBeNull();
  });

  it('pide marcar al menos a un alumno', () => {
    const result = parseAttendanceForm(roster([['student', ANA]]));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.attendance).toBe('Marca al menos a un alumno.');
  });

  it('rechaza estados desconocidos, notas largas e ids alterados', () => {
    expect(parseAttendanceForm(roster([['student', ANA], [`status-${ANA}`, 'presente']])).ok).toBe(false);
    expect(parseAttendanceForm(roster([['student', ANA], [`status-${ANA}`, 'present'], [`note-${ANA}`, 'x'.repeat(ATTENDANCE_NOTE_MAX + 1)]])).ok).toBe(false);
    expect(parseAttendanceForm(roster([['student', 'no-es-un-id'], ['status-no-es-un-id', 'present']])).ok).toBe(false);
  });
});
