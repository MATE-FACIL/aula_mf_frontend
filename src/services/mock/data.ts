import 'server-only';
import type {
  AttendanceRecord,
  Badge,
  Certificate,
  ChatMessage,
  ClassFrequency,
  EvaluationSummary,
  LabLessonDetail,
  Material,
  MathLessonDetail,
  Membership,
  MonthlyLab,
  PortfolioItem,
  QuizQuestion,
  StudentProfile,
  Task,
  Unit,
  WeeklyReport,
} from '@/types/domain';

// DATOS DE EJEMPLO (personas, notas y fechas ficticias), portados del prototipo B del aula.
// Modelo académico confirmado por el dueño (2026-10-08):
// - Matemáticas es el curso PIVOTE: 4 niveles en secundaria; primaria en definición.
// - En paralelo, un LABORATORIO MENSUAL de IA, Habilidades digitales o Programación.

export const DEMO_IDS = {
  student: 'stu-valentina',
  sibling: 'stu-mateo',
  family: 'fam-roque',
  teacher: 'tch-lucia',
  admin: 'adm-equipo',
} as const;

/** Credenciales de la demo (solo modo mock). */
export const DEMO_CREDENTIALS = {
  student: { username: 'valentina.r', pictograms: ['🦊', '🚀', '🍕'] },
  family: { email: 'familia@matefacil.pe', password: 'matefacil123' },
  /** Profesora Lucía Paredes: ve solo sus grupos (los mismos que el panel de administración demo). */
  teacher: { email: 'lucia@matefacil.pe', password: 'matefacil123' },
  admin: { email: 'admin@matefacil.pe', password: 'matefacil123' },
} as const;

export const profiles: Record<string, StudentProfile> = {
  [DEMO_IDS.student]: {
    id: DEMO_IDS.student,
    firstName: 'Valentina',
    age: 13,
    grade: '2.º de secundaria',
    stage: 'Secundaria',
    avatar: '🦊',
    timeZone: 'America/Lima',
    stars: 340,
    streakDays: 5,
    math: { level: 'Intermedio', startLevel: 'Básico', progress: 68 },
    lab: { name: 'Roblox: de jugador a creador', area: 'Programación', month: 'Octubre', progress: 50 },
  },
  [DEMO_IDS.sibling]: {
    id: DEMO_IDS.sibling,
    firstName: 'Mateo',
    age: 9,
    grade: '4.º de primaria',
    stage: 'Primaria',
    avatar: '🐺',
    timeZone: 'America/Lima',
    stars: 210,
    streakDays: 3,
    math: { level: null, startLevel: null, progress: 0, note: 'Niveles de primaria en definición · diagnóstico de entrada registrado' },
    lab: { name: 'IA creativa para niños', area: 'Inteligencia Artificial', month: 'Octubre', progress: 50 },
  },
};

export const frequency: ClassFrequency[] = [
  { course: 'Matemáticas', detail: '1 o 2 clases en vivo por semana · su plan: 2', days: 'Martes y jueves', track: 'math' },
  { course: 'Laboratorio del mes', detail: '1 o 2 clases en vivo por semana · su plan: 1', days: 'Miércoles', track: 'lab' },
];

export const monthlyLabs: MonthlyLab[] = [
  { month: 'Septiembre', area: 'Programación', name: 'Programación creativa con Scratch', status: 'done' },
  { month: 'Octubre', area: 'Programación', name: 'Roblox: de jugador a creador', status: 'current' },
  { month: 'Noviembre', area: 'Inteligencia Artificial', name: 'IA creativa: imágenes e historias', status: 'upcoming' },
  { month: 'Diciembre', area: 'Habilidades digitales', name: 'Creación de videos y contenido', status: 'upcoming' },
];

export const mathUnit: Unit = {
  id: 'u-fracciones',
  name: 'Fracciones',
  track: 'math',
  level: 'Intermedio',
  nextUnits: 'Decimales · Proporciones · Problemas de varios pasos',
  lessons: [
    { id: 'm1', title: 'Fracciones equivalentes', status: 'done', duration: '25 min', stars: 3 },
    { id: 'm2', title: 'Comparar fracciones', status: 'done', duration: '25 min', stars: 2 },
    { id: 'm3', title: 'Sumar fracciones con distinto denominador', status: 'current', duration: '30 min' },
    { id: 'm4', title: 'Problemas con fracciones', status: 'locked', duration: '30 min' },
    { id: 'm5', title: 'Reto y evaluación de la unidad', status: 'locked', duration: '20 min' },
  ],
};

export const labUnit: Unit = {
  id: 'u-roblox',
  name: 'Roblox: de jugador a creador',
  track: 'lab',
  area: 'Programación',
  month: 'Octubre',
  nextUnits: 'Noviembre: IA creativa (Inteligencia Artificial)',
  lessons: [
    { id: 'r1', title: 'Conoce Roblox Studio', status: 'done', duration: 'Semana 1', stars: 3, label: 'Semana 1' },
    { id: 'r2', title: 'Construye tu primer obby', status: 'done', duration: 'Semana 2', stars: 3, label: 'Semana 2' },
    { id: 'r3', title: 'Checkpoints y reglas del juego', status: 'current', duration: 'Semana 3', label: 'Semana 3' },
    { id: 'r4', title: 'Proyecto del mes: publica tu obby', status: 'locked', duration: 'Semana 4', label: 'Semana 4' },
  ],
};

const mathMaterials: Material[] = [
  { id: 'mat-1', name: 'Guía de práctica (PDF)', url: '#' },
  { id: 'mat-2', name: 'Pizarra de la clase (imagen)', url: '#' },
];

/** Ejercicios con su solución: SOLO servidor. Al navegador llega `prompt` (ver toPublicLesson). */
export interface ExerciseKey {
  id: string;
  prompt: string;
  answer: [number, number];
  concept: string;
  hints: string[];
  steps: string[];
}

export const exercises: ExerciseKey[] = [
  {
    id: 'e1',
    prompt: '1/2 + 1/4 = ?',
    answer: [3, 4],
    concept: 'Para sumar fracciones, los pedazos deben ser del mismo tamaño. Por eso primero buscamos un denominador común.',
    hints: [
      '¿Los dos denominadores son iguales? Si no, ¿a qué número podrías llevar el 2 para que sea igual al 4?',
      '1/2 es lo mismo que 2/4. Ahora suma cuartos con cuartos.',
      '2/4 + 1/4: suma solo los numeradores. El denominador se queda en 4.',
    ],
    steps: ['Denominador común de 2 y 4: __', 'Convierte 1/2 a cuartos: __/4', 'Suma: __/4 + 1/4 = __/4'],
  },
  {
    id: 'e2',
    prompt: '2/3 + 1/6 = ?',
    answer: [5, 6],
    concept: 'El denominador común es un número que está en la tabla de ambos denominadores.',
    hints: [
      '¿Qué número está en la tabla del 3 y también en la del 6?',
      'Convierte 2/3 en sextos: multiplica arriba y abajo por 2.',
      '4/6 + 1/6: ¿cuántos sextos tienes en total?',
    ],
    steps: ['Denominador común de 3 y 6: __', 'Convierte 2/3 a sextos: __/6', 'Suma: __/6 + 1/6 = __/6'],
  },
  {
    id: 'e3',
    prompt: 'Valentina comió 1/4 de la pizza y su hermano 3/8. ¿Qué parte de la pizza comieron entre los dos?',
    answer: [5, 8],
    concept: 'En un problema, primero decide la operación: «entre los dos» significa juntar, es decir, sumar.',
    hints: [
      '¿Qué operación necesitas: sumar o restar? ¿Por qué?',
      'Lleva 1/4 a octavos. ¿Por cuánto multiplicas el 4 para llegar a 8?',
      '2/8 + 3/8: suma los octavos.',
    ],
    steps: ['Operación: __', 'Convierte 1/4 a octavos: __/8', 'Suma: __/8 + 3/8 = __/8'],
  },
];

export const mathLesson: MathLessonDetail = {
  id: 'm3',
  unitLabel: 'Fracciones · Intermedio',
  position: 'Lección 3 de 5',
  title: 'Sumar fracciones con distinto denominador',
  recording: {
    label: 'Clase en vivo del martes 7',
    durationSec: 24 * 60 + 10,
    chapters: [
      { start: 0, title: 'Repaso: fracciones equivalentes' },
      { start: 4 * 60 + 12, title: 'Buscar un denominador común' },
      { start: 11 * 60 + 30, title: 'Ejemplos resueltos en la pizarra' },
      { start: 18 * 60 + 5, title: 'Reto en grupo' },
    ],
  },
  materials: mathMaterials,
  exercises: exercises.map(({ id, prompt }) => ({ id, prompt })),
};

export const labLesson: LabLessonDetail = {
  id: 'r3',
  unitLabel: 'Lab de octubre · Roblox · Semana 3 de 4',
  title: 'Checkpoints y reglas del juego',
  taskId: 't-roblox',
  recording: {
    label: 'Clase en vivo del miércoles 8',
    durationSec: 41 * 60 + 30,
    chapters: [
      { start: 0, title: 'Qué es un checkpoint' },
      { start: 7 * 60 + 40, title: 'Colocar SpawnLocations' },
      { start: 19 * 60 + 15, title: 'Reglas: vidas y reinicio' },
      { start: 32 * 60, title: 'Prueba en grupo' },
    ],
  },
  challenge: [
    'Abre tu obby en Roblox Studio.',
    'Agrega 3 checkpoints en los tramos difíciles.',
    'Pruébalo: si caes, debes volver al último checkpoint.',
    'Graba un video corto (máx. 30 s) o toma 2 capturas.',
  ],
  materials: [
    { id: 'lab-1', name: 'Guía: checkpoints paso a paso (PDF)', url: '#' },
    { id: 'lab-2', name: 'Plantilla de obby (archivo .rbxl)', url: '#' },
  ],
};

export const evaluations: EvaluationSummary[] = [
  { id: 'ent', kind: 'Prueba de entrada', topic: 'Diagnóstico de Matemáticas', dateLabel: '3 de julio', score: 62, resultLabel: 'Ubicada en nivel Básico', status: 'graded' },
  { id: 's1', kind: 'Semanal', topic: 'Fracciones equivalentes', dateLabel: '30 de septiembre', score: 85, resultLabel: '17 de 20 puntos', status: 'graded' },
  { id: 's2', kind: 'Semanal', topic: 'Comparar fracciones', dateLabel: '7 de octubre', score: 75, resultLabel: '15 de 20 puntos', status: 'graded' },
  { id: 's3', kind: 'Semanal', topic: 'Sumar fracciones', dateLabel: 'Disponible hasta el domingo', score: null, resultLabel: '5 preguntas · 15 min', status: 'available' },
  { id: 'lab', kind: 'Laboratorio', topic: 'Proyecto del mes: obby (rúbrica)', dateLabel: 'Fin de octubre', score: null, resultLabel: 'La califica el profesor con rúbrica', status: 'upcoming' },
];

export type QuizKey = QuizQuestion & { answer: string; explanation: string; competency: string };

export const weeklyQuiz: { evaluationId: string; title: string; durationSec: number; questions: QuizKey[] } = {
  evaluationId: 's3',
  title: 'Evaluación semanal · Sumar fracciones',
  durationSec: 15 * 60,
  questions: [
    { id: 'p1', type: 'choice', text: '1/3 + 1/6 = ?', options: ['2/9', '1/2', '2/6', '3/9'], answer: '1', explanation: '1/3 = 2/6; 2/6 + 1/6 = 3/6 = 1/2.', competency: 'Operar' },
    { id: 'p2', type: 'number', text: '¿Cuál es el mínimo común denominador de 4 y 6?', answer: '12', explanation: '12 es el primer número que está en la tabla del 4 y del 6.', competency: 'Comprender' },
    { id: 'p3', type: 'fraction', text: '3/5 + 1/10 = ? (escribe la fracción, por ejemplo 7/10)', answer: '7/10', explanation: '3/5 = 6/10; 6/10 + 1/10 = 7/10.', competency: 'Operar' },
    { id: 'p4', type: 'choice', text: '¿Cuál es mayor?', options: ['2/3', '3/4', 'Son iguales'], answer: '1', explanation: '2/3 = 8/12 y 3/4 = 9/12.', competency: 'Comprender' },
    { id: 'p5', type: 'fraction', text: 'Ana leyó 1/2 del libro el lunes y 1/3 el martes. ¿Qué parte del libro leyó?', answer: '5/6', explanation: '1/2 = 3/6 y 1/3 = 2/6; 3/6 + 2/6 = 5/6.', competency: 'Resolver problemas' },
  ],
};

export const attendance: AttendanceRecord[] = [
  { id: 'a1', dateLabel: 'Mar 30 sep', course: 'Matemáticas', status: 'present' },
  { id: 'a2', dateLabel: 'Mié 1 oct', course: 'Lab Roblox', status: 'present' },
  { id: 'a3', dateLabel: 'Jue 2 oct', course: 'Matemáticas', status: 'present' },
  { id: 'a4', dateLabel: 'Mar 7 oct', course: 'Matemáticas', status: 'late', note: 'Entró 8 min tarde' },
  { id: 'a5', dateLabel: 'Mié 8 oct', course: 'Lab Roblox', status: 'present' },
  { id: 'a6', dateLabel: 'Jue 9 oct', course: 'Matemáticas', status: 'absent', note: 'Vio la grabación el viernes' },
];

export const siblingAttendance: AttendanceRecord[] = Array.from({ length: 8 }, (_, i) => ({
  id: `sa${i}`,
  dateLabel: `Clase ${i + 1}`,
  course: i % 2 ? 'Lab IA' : 'Matemáticas',
  status: 'present' as const,
}));

export const badges: Badge[] = [
  { id: 'b1', name: 'Racha de 5 días', icon: '🔥', earned: true, detail: 'Practicó 5 días seguidos' },
  { id: 'b2', name: 'Fracciones Pro', icon: '🍕', earned: true, detail: '3 estrellas en Fracciones equivalentes' },
  { id: 'b3', name: 'Primer obby', icon: '🧱', earned: true, detail: 'Publicó su primer obby en clase' },
  { id: 'b4', name: 'Ayudante del grupo', icon: '🤝', earned: true, detail: 'Ayudó a un compañero en el reto' },
  { id: 'b5', name: 'Asistencia perfecta', icon: '📅', earned: false, detail: 'Asiste a todas las clases del mes' },
  { id: 'b6', name: 'Subí de nivel', icon: '🚀', earned: false, detail: 'Pasa de Intermedio a Avanzado' },
];

export const portfolio: PortfolioItem[] = [
  { id: 'pf1', title: 'Obby del Volcán', lab: 'Lab Roblox · octubre', dateLabel: 'En curso', note: 'Proyecto del mes · 2 de 4 semanas', area: 'Programación', status: 'in-progress' },
  { id: 'pf2', title: 'Quiz de las tablas', lab: 'Lab Scratch · septiembre', dateLabel: 'Septiembre', note: 'Juego de preguntas · calificado 18/20', area: 'Habilidades digitales', status: 'done' },
  { id: 'pf3', title: 'El robot que contaba fracciones', lab: 'Lab IA · agosto', dateLabel: 'Agosto', note: 'Cuento ilustrado con IA · calificado 17/20', area: 'Inteligencia Artificial', status: 'done' },
];

export const certificates: Certificate[] = [
  { id: 'c1', name: 'Matemáticas · Nivel Básico', dateLabel: 'Julio 2026', code: 'MF-MB-7Q4K', downloadUrl: '#' },
  { id: 'c2', name: 'Lab de septiembre · Programación creativa con Scratch', dateLabel: 'Agosto 2026', code: 'MF-L2-3XZP', downloadUrl: '#' },
  { id: 'c3', name: 'Matemáticas · Nivel Intermedio', dateLabel: 'Pendiente', code: null, requirement: 'Al completar el nivel Intermedio y su evaluación final' },
];

export const initialTasks: Task[] = [
  { id: 't-roblox', title: 'Reto: agrega 3 checkpoints a tu obby', course: 'Lab Roblox', dueLabel: 'Miércoles', status: 'pending' },
  { id: 't-practica', title: 'Práctica: sumar fracciones (3 ejercicios)', course: 'Matemáticas', dueLabel: 'Hoy', status: 'pending' },
  { id: 't-equiv', title: 'Fracciones equivalentes', course: 'Matemáticas', dueLabel: 'Entregado', status: 'reviewed', teacherComment: '¡Muy bien explicado tu procedimiento! — Prof. Lucía' },
];

export const weeklyReport: WeeklyReport = {
  weekLabel: 'Semana del 5 al 11 de octubre',
  recordingsWatched: 2,
  practice: { exercises: 42, accuracy: 86, minutes: 95 },
  tutor: { questions: 14, escalated: 2, topics: ['denominador común', 'fracciones en problemas', 'checkpoints en Roblox'] },
  teacherComment: {
    author: 'Prof. Lucía · Matemáticas',
    text: 'Valentina ya domina las fracciones equivalentes. Esta semana trabajamos la suma con distinto denominador; le cuesta un poco elegir el denominador común. Recomiendo 10 minutos de práctica el fin de semana.',
  },
  alerts: ['Tiene 1 reto de Roblox pendiente para el miércoles.', 'Faltó a la clase del jueves 9 (vio la grabación).'],
  nextStep: 'Si mantiene el ritmo, la profesora evaluará el paso a nivel Avanzado a fines de noviembre.',
};

export const membership: Membership = {
  plan: 'Plan semestral',
  detail: 'Matemáticas (2 clases/semana) + laboratorio mensual (1 clase/semana) · 2 hijos',
  renewalLabel: 'Marzo 2027',
  price: null,
};

export const initialMessages: Omit<ChatMessage, 'sentAt'>[] = [
  { id: 'msg1', author: 'teacher', authorName: 'Prof. Lucía', text: 'Hola, les comparto la guía de fracciones para practicar el fin de semana.' },
  { id: 'msg2', author: 'family', authorName: 'Familia Roque', text: '¡Gracias! ¿Le conviene repasar también lo de la clase anterior?' },
  { id: 'msg3', author: 'teacher', authorName: 'Prof. Lucía', text: 'Sí, 10 minutos de la grabación del martes, desde el minuto 04:12.' },
];
