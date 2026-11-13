// Contenido de un curso: unidades y sesiones (lecciones) con video y materiales (SCRUM-71). Mismas formas que la
// API .NET (camelCase). Un video o un material es un enlace o un archivo subido, nunca los dos.

export interface ContentMaterial {
  id: string;
  title: string;
  /** El enlace o, si es un archivo subido, un enlace firmado que vence a los 15 minutos (null sin almacenamiento). */
  url: string | null;
  fileId: string | null;
  contentType: string | null;
  size: number | null;
}

export interface ContentLesson {
  id: string;
  unitId: string;
  /** Su lugar en todo el curso: 1, 2, 3… recorriendo las unidades en orden. */
  number: number;
  title: string;
  summary: string | null;
  videoUrl: string | null;
  videoFileId: string | null;
  videoContentType: string | null;
  /** Una sesión en borrador solo la ve el equipo. */
  isPublished: boolean;
  materials: ContentMaterial[];
}

export interface ContentUnit {
  id: string;
  title: string;
  position: number;
  lessons: ContentLesson[];
}

export interface CourseContent {
  courseId: string;
  courseTitle: string;
  units: ContentUnit[];
}

/** Lo que se guarda de una sesión: el video y cada material son un enlace o un archivo ya subido (`fileId`). */
export interface LessonPayload {
  title: string;
  summary: string | null;
  videoUrl: string | null;
  videoFileId: string | null;
  isPublished: boolean;
  materials: { title: string; url: string | null; fileId: string | null }[];
}

export type UploadKind = 'video' | 'material';

/** Permiso para subir UN archivo directo al almacenamiento, antes de `expiresAt` (15 minutos). */
export interface UploadGrant {
  fileId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}
