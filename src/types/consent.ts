// Consentimiento del padre para los datos del menor (SCRUM-38). Mismas formas que la API .NET (camelCase).

export interface ConsentSection {
  heading: string;
  paragraphs: string[];
}

/** El texto vigente. `version` cambia cuando cambia el texto: hay que volver a aceptarlo. */
export interface ConsentText {
  version: string;
  title: string;
  /** true hasta que el dueño valide el texto legal. */
  isProvisional: boolean;
  sections: ConsentSection[];
}

export type ConsentStatus = 'accepted' | 'pending';

/** `accepted`: un padre vinculado aceptó el texto vigente. Basta con uno. */
export interface ChildConsent {
  studentUserId: string;
  fullName: string;
  status: ConsentStatus;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

export interface FamilyConsent {
  text: ConsentText;
  children: ChildConsent[];
  pending: number;
}
