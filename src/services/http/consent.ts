import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { FamilyService } from '../contracts';

// Consentimiento del padre (SCRUM-38) contra la API .NET. Una petición por acción; el backend decide de quién son
// los hijos (parte de los vínculos del padre de la sesión) y qué texto está vigente.
export const httpConsent: Pick<FamilyService, 'getConsent' | 'acceptConsent'> = {
  getConsent: ({ token }) => apiRequest('/families/me/consent', { token }),
  acceptConsent: ({ token }, version, studentUserIds) =>
    apiRequest('/families/me/consent', { method: 'POST', token, body: { version, studentUserIds } }),
};
