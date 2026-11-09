import { describe, expect, it } from 'vitest';
import { toAttendance, type AttendanceReportDto } from './attendance';
import { toChildOverview, type FamilyChildDto } from './family-children';

const report: AttendanceReportDto = {
  studentUserId: 'u1',
  summary: { present: 3, late: 1, absent: 1, total: 5, rate: 80 },
  recent: [
    // Lunes 9 nov 2026, 22:30 UTC = 5:30 p. m. en Lima, pero ya martes 7:30 a. m. en Tokio.
    { sessionId: 's1', courseTitle: 'Matemáticas', offeringName: 'Grupo A', startsAt: '2026-11-09T22:30:00Z', status: 'late', note: 'Entró 10 min tarde' },
    { sessionId: 's2', courseTitle: 'Matemáticas', offeringName: 'Grupo A', startsAt: '2026-11-04T22:30:00Z', status: 'present', note: null },
  ],
};

describe('asistencia real', () => {
  it('conserva los totales del backend y arma cada fila', () => {
    const result = toAttendance(report, 'America/Lima');
    expect(result.summary.rate).toBe(80);
    expect(result.records[0]).toMatchObject({ id: 's1', course: 'Matemáticas · Grupo A', status: 'late', note: 'Entró 10 min tarde' });
    expect(result.records[0].dateLabel).toMatch(/^Lun 9 nov/);
    expect(result.records[1]).not.toHaveProperty('note');
  });

  it('muestra la fecha en la zona horaria de quien mira', () => {
    expect(toAttendance(report, 'Asia/Tokyo').records[0].dateLabel).toMatch(/^Mar 10 nov/);
  });

  it('el hijo real lleva su asistencia; sin reporte queda vacío, nunca con ejemplos', () => {
    const dto: FamilyChildDto = { studentUserId: 'u1', givenNames: 'Ana', fullName: 'Ana Quispe', enrollments: [], upcomingClasses: [] };
    const withAttendance = toChildOverview(dto, toAttendance(report, 'America/Lima'));
    expect(withAttendance.attendance).toHaveLength(2);
    expect(withAttendance.attendanceSummary?.total).toBe(5);

    const without = toChildOverview(dto);
    expect(without.attendance).toEqual([]);
    expect(without.attendanceSummary).toBeNull();
  });
});
