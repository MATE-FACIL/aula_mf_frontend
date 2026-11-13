import type { ChildConsent, FamilyConsent } from '@/types/consent';

// Reglas puras del consentimiento del padre (SCRUM-38), sin red: se prueban con Vitest. Las mismas que valida el
// backend, para no gastar una petición en algo que va a rechazar.

/** Igual que el backend (`GuardianConsent.MaxVersionLength` y `GuardianConsentUseCases.MaxChildrenPerRequest`). */
export const CONSENT_VERSION_MAX = 60;
export const CONSENT_MAX_CHILDREN = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «Ana», «Ana y Beto», «Ana, Beto y Eva». */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export const pendingChildren = (consent: Pick<FamilyConsent, 'children'>): ChildConsent[] =>
  consent.children.filter((child) => child.status === 'pending');

/** La declaración que el padre marca antes de aceptar. */
export function declarationFor(names: string[]): string {
  return `Soy el padre, la madre o el tutor legal de ${listNames(names)}, leí este texto y lo acepto.`;
}

export type Acceptance = { ok: true; version: string; studentUserIds: string[] } | { ok: false; error: string };

/** Revisa lo que llega del navegador antes de llamar al backend. */
export function parseAcceptance(version: unknown, studentUserIds: unknown): Acceptance {
  if (typeof version !== 'string' || !version.trim() || version.length > CONSENT_VERSION_MAX) {
    return { ok: false, error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };
  }
  if (!Array.isArray(studentUserIds)) return { ok: false, error: 'Elige al menos un hijo.' };
  const ids = [...new Set(studentUserIds)];
  if (ids.length === 0) return { ok: false, error: 'Elige al menos un hijo.' };
  if (ids.length > CONSENT_MAX_CHILDREN || !ids.every((id): id is string => typeof id === 'string' && UUID_RE.test(id))) {
    return { ok: false, error: 'La solicitud no es válida. Recarga la página e inténtalo otra vez.' };
  }
  return { ok: true, version, studentUserIds: ids };
}
