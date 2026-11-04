import { describe, expect, it } from 'vitest';
import { toChildOverview, type FamilyChildDto } from './family-children';

const dto: FamilyChildDto = {
  studentUserId: 'u1',
  givenNames: 'Ana',
  fullName: 'Ana Quispe',
  enrollments: [{ id: 'e1', courseOfferingId: 'o1', courseTitle: 'Álgebra', offeringName: 'Grupo A', status: 'active', activatedAt: '2026-11-01T10:00:00.000Z' }],
  upcomingClasses: [{
    sessionId: 's1', offeringId: 'o1', courseTitle: 'Álgebra', offeringName: 'Grupo A', categoryName: 'Matemáticas',
    startsAt: '2026-11-10T22:00:00.000Z', endsAt: '2026-11-10T23:30:00.000Z', virtualLink: null, teachers: ['Lucía Paredes'],
  }],
};

describe('toChildOverview', () => {
  it('convierte matrículas y clases reales', () => {
    const child = toChildOverview(dto);
    expect(child.id).toBe('u1');
    expect(child.displayName).toBe('Ana Quispe');
    expect(child.enrollments).toEqual([{ id: 'e1', courseTitle: 'Álgebra', offeringName: 'Grupo A', status: 'active', activatedAt: '2026-11-01T10:00:00.000Z' }]);
    expect(child.upcomingClasses[0]).toMatchObject({ id: 's1', durationMin: 90, teacher: 'Lucía Paredes', course: 'Álgebra' });
  });

  it('no rellena con datos de ejemplo lo que el backend aún no tiene', () => {
    const child = toChildOverview(dto);
    expect(child.profile).toBeNull();
    expect(child.report).toBeNull();
    expect(child.evaluations).toEqual([]);
    expect(child.attendance).toEqual([]);
    expect(child.weeklyAverage).toBeNull();
  });
});
