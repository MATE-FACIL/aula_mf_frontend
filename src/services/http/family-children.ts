import type { ChildOverview } from '@/types/domain';
import { toLiveClass, type StudentClassDto } from './live-schedule';

// Hijos reales de la familia (SCRUM-67): conversión de `GET /families/me/children`.
// Puro (sin red ni `server-only`): se prueba con Vitest.

export interface FamilyChildDto {
  studentUserId: string;
  givenNames: string;
  fullName: string;
  enrollments: {
    id: string;
    courseOfferingId: string;
    courseTitle: string;
    offeringName: string;
    status: 'pending' | 'active';
    activatedAt: string | null;
  }[];
  upcomingClasses: StudentClassDto[];
}

/** Lo que el backend aún no tiene (perfil, notas, asistencia…) queda vacío: nunca se rellena con ejemplos. */
export function toChildOverview(dto: FamilyChildDto): ChildOverview {
  return {
    id: dto.studentUserId,
    displayName: dto.fullName,
    enrollments: dto.enrollments.map(({ id, courseTitle, offeringName, status, activatedAt }) => ({ id, courseTitle, offeringName, status, activatedAt })),
    upcomingClasses: dto.upcomingClasses.map(toLiveClass),
    profile: null,
    report: null,
    evaluations: [],
    attendance: [],
    portfolio: [],
    certificates: [],
    badges: [],
    weeklyAverage: null,
  };
}
