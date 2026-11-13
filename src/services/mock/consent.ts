import 'server-only';
import { ApiError } from '@/lib/http/errors';
import type { ChildConsent, ConsentText, FamilyConsent } from '@/types/consent';

// Consentimiento del padre EN MEMORIA (modo demo), con las mismas reglas que el backend: una aceptación vale para el
// texto vigente, repetirla no cambia nada y todo se acepta o nada. Es un texto de EJEMPLO, no el legal.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

export const MOCK_CONSENT_TEXT: ConsentText = {
  version: 'demo-1',
  title: 'Términos de uso y política de privacidad',
  isProvisional: true,
  sections: [
    { heading: 'Para qué sirve el aula', paragraphs: ['Texto de ejemplo del modo demo. Aquí va el texto real de los términos de uso y de la política de privacidad.'] },
    { heading: 'Qué datos usamos', paragraphs: ['Los datos de tu hijo o hija que nos diste al matricularlo y lo que ocurre en el aula: grupos, asistencia y resultados.'] },
    { heading: 'Tu aceptación', paragraphs: ['Al aceptar declaras que eres el padre, la madre o el tutor legal y que autorizas el uso de los datos para lo que aquí se explica. Registramos la fecha.'] },
  ],
};

interface Accepted {
  at: string;
  by: string;
}

const globalForConsent = globalThis as unknown as { __mfMockConsent?: Map<string, Accepted> };
const accepted = () => (globalForConsent.__mfMockConsent ??= new Map());

export interface MockChild {
  id: string;
  name: string;
}

function read(children: MockChild[]): FamilyConsent {
  const list: ChildConsent[] = children.map((child) => {
    const own = accepted().get(child.id);
    return {
      studentUserId: child.id,
      fullName: child.name,
      status: own ? 'accepted' : 'pending',
      acceptedAt: own?.at ?? null,
      acceptedByName: own?.by ?? null,
    };
  });
  return { text: MOCK_CONSENT_TEXT, children: list, pending: list.filter((child) => child.status === 'pending').length };
}

export async function mockGetConsent(children: MockChild[]): Promise<FamilyConsent> {
  await delay();
  return read(children);
}

export async function mockAcceptConsent(children: MockChild[], guardianName: string, version: string, ids: string[]): Promise<FamilyConsent> {
  await delay();
  if (version !== MOCK_CONSENT_TEXT.version) {
    const message = 'El texto de los términos cambió mientras lo leías. Recarga la página para leer la versión actual.';
    throw new ApiError('conflict', 'Texto cambiado', 409, undefined, message);
  }
  if (ids.length === 0) throw new ApiError('validation', 'Sin hijos', 400, undefined, 'Elige al menos un hijo.');
  const own = new Set(children.map((child) => child.id));
  if (ids.some((id) => !own.has(id))) {
    throw new ApiError('not_found', 'Hijo ajeno', 404, undefined, 'No encontramos a uno de los hijos en tu cuenta.');
  }
  const now = new Date().toISOString();
  for (const id of ids) if (!accepted().has(id)) accepted().set(id, { at: now, by: guardianName });
  return read(children);
}
