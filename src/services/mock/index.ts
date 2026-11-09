import 'server-only';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/http/errors';
import { addDaysToKey, formatTime, localDateKey, weekdayOfKey, zonedDateTime } from '@/lib/time';
import type { AppNotification, CalendarEvent, ChatMessage, ChildOverview, EvaluationSummary, LiveClass, QuizQuestion, Role, SessionUser, Task } from '@/types/domain';
import type { RequestContext, Schedule, Services } from '../contracts';
import { mockAdmin, mockTeacher } from './admin';
import * as data from './data';
import { checkFractionAnswer, gradeQuiz } from './grading';
import { mockPractice } from './practice';
import { tutorReply } from './tutor-engine';

// Implementación EN MEMORIA de los contratos, para trabajar el frontend sin la API .NET.
// El estado vive en el proceso (se reinicia al reiniciar el servidor) y es compartido por la demo.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const SESSION_TTL_SEC = 8 * 60 * 60;
const QUIZ_GRACE_MS = 10_000;

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

// ─── Estado ────────────────────────────────────────────────────────────

interface Attempt {
  studentId: string;
  evaluationId: string;
  deadline: number;
  submitted: boolean;
}

function createStore() {
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  return {
    secret: process.env.MOCK_SESSION_SECRET || randomBytes(32).toString('hex'),
    stars: { [data.DEMO_IDS.student]: data.profiles[data.DEMO_IDS.student].stars } as Record<string, number>,
    tasks: structuredClone(data.initialTasks),
    evaluations: structuredClone(data.evaluations),
    attempts: new Map<string, Attempt>(),
    classAnchor: 0,
    notifications: [
      { id: 'n1', title: 'Tarea revisada por la Prof. Lucía', detail: 'Fracciones equivalentes', kind: 'review', createdAt: minutesAgo(120), read: false, href: '/clases' },
      { id: 'n2', title: 'Grabación del martes disponible', detail: 'Matemáticas · Intermedio', kind: 'class', createdAt: minutesAgo(300), read: false, href: '/lecciones' },
      { id: 'n3', title: 'Evaluación semanal abierta', detail: 'Sumar fracciones · cierra el domingo', kind: 'evaluation', createdAt: minutesAgo(600), read: false, href: '/evaluaciones' },
    ] as AppNotification[],
    familyNotifications: [
      { id: 'fn1', title: 'Nuevo mensaje de la Prof. Lucía', detail: 'Repaso de la grabación del martes', kind: 'message', createdAt: minutesAgo(90), read: false },
    ] as AppNotification[],
    messages: data.initialMessages.map((m, i) => ({ ...m, sentAt: minutesAgo(60 * 24 - i * 30) })) as ChatMessage[],
  };
}

type Store = ReturnType<typeof createStore>;
const globalForStore = globalThis as unknown as { __mfMockStore?: Store };
// Creación perezosa (en la primera petición) y reutilizada entre recargas en desarrollo.
const store = () => (globalForStore.__mfMockStore ??= createStore());

// ─── Sesión firmada (HMAC) ─────────────────────────────────────────────

interface TokenPayload {
  sub: string;
  role: Role;
  exp: number;
}

const sign = (body: string) => createHmac('sha256', store().secret).update(body).digest('base64url');

function issueToken(sub: string, role: Role): string {
  const body = Buffer.from(JSON.stringify({ sub, role, exp: Date.now() + SESSION_TTL_SEC * 1000 } satisfies TokenPayload)).toString('base64url');
  return `mock.${body}.${sign(body)}`;
}

function verifyToken(token: string): TokenPayload | null {
  const [prefix, body, signature] = token.split('.');
  if (prefix !== 'mock' || !body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function userFor(sub: string, role: Role): SessionUser {
  if (role === 'admin') return { id: sub, role, displayName: 'Equipo Mate Fácil', timeZone: 'America/Lima' };
  if (role === 'teacher') return { id: sub, role, displayName: 'Lucía Paredes', timeZone: 'America/Lima' };
  if (role === 'student') {
    const p = data.profiles[sub];
    return { id: sub, role, displayName: p.firstName, timeZone: p.timeZone };
  }
  return { id: sub, role, displayName: 'Familia Roque', timeZone: 'America/Lima', childIds: [data.DEMO_IDS.student, data.DEMO_IDS.sibling] };
}

/** Usuario de demostración de cada rol (el modo híbrido lo usa para dar datos mock a una sesión real). */
export const demoUserFor = (role: Role): SessionUser => userFor(data.DEMO_IDS[role], role);

function requireRole(ctx: RequestContext, role: Role) {
  if (ctx.user.role !== role) throw new ApiError('forbidden', `Se requiere el rol ${role}`, 403);
}

// ─── Horario relativo a la fecha real ──────────────────────────────────

function buildSchedule(timeZone: string): Pick<Schedule, 'classes' | 'calendar' | 'weekStart'> {
  const s = store();
  const now = Date.now();
  // La clase de hoy empieza unos minutos después de la primera visita, para probar el botón
  // «Entrar», que se habilita 10 min antes. Se reubica cuando la clase ya avanzó.
  if (!s.classAnchor || now - s.classAnchor > 45 * 60_000) {
    s.classAnchor = Math.ceil((now + 8 * 60_000) / 60_000) * 60_000;
  }
  const today = localDateKey(new Date(now), timeZone);
  const at = (days: number) => zonedDateTime(addDaysToKey(today, days), 17, 0, timeZone).toISOString();

  const classes: LiveClass[] = [
    { id: 'cl-1', startsAt: new Date(s.classAnchor).toISOString(), durationMin: 60, course: 'Matemáticas · Intermedio', topic: 'Problemas con fracciones', teacher: 'Prof. Lucía', track: 'math', joinUrl: 'https://meet.example.com/mf-mate' },
    { id: 'cl-2', startsAt: at(1), durationMin: 60, course: 'Lab de octubre · Roblox', topic: 'Scripting: piezas que se mueven', teacher: 'Prof. Diego', track: 'lab', joinUrl: 'https://meet.example.com/mf-lab' },
    { id: 'cl-3', startsAt: at(2), durationMin: 60, course: 'Matemáticas · Intermedio', topic: 'Repaso + evaluación semanal', teacher: 'Prof. Lucía', track: 'math', joinUrl: 'https://meet.example.com/mf-mate' },
  ];

  const weekStart = addDaysToKey(today, -((weekdayOfKey(today) + 6) % 7));
  const calendar: CalendarEvent[] = [
    ...classes.map((c) => ({
      date: localDateKey(c.startsAt, timeZone),
      time: formatTime(c.startsAt, timeZone),
      label: c.track === 'lab' ? 'Lab Roblox' : c.topic.includes('evaluación') ? 'Matemáticas + evaluación semanal' : 'Matemáticas',
      kind: c.track,
    })),
    { date: addDaysToKey(weekStart, 5), time: 'Libre', label: 'Práctica sugerida 10 min', kind: 'practice' },
    { date: addDaysToKey(weekStart, 6), time: 'Hasta 11:59 p. m.', label: 'Cierra la evaluación semanal', kind: 'practice' },
  ];
  return { classes, calendar, weekStart };
}

// ─── Utilidades de lectura ─────────────────────────────────────────────

const profileOf = (id: string) => ({ ...data.profiles[id], stars: store().stars[id] ?? data.profiles[id].stars });

function weeklyAverage(list: EvaluationSummary[]): number | null {
  const scores = list.filter((e) => e.kind === 'Semanal' && e.score !== null).map((e) => e.score as number);
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

/** Quita respuesta, explicación y competencia antes de enviar la pregunta al navegador. */
function toPublicQuestion(q: data.QuizKey): QuizQuestion {
  return q.type === 'choice' ? { id: q.id, type: q.type, text: q.text, options: q.options } : { id: q.id, type: q.type, text: q.text };
}

function findExercise(id: string) {
  const exercise = data.exercises.find((e) => e.id === id);
  if (!exercise) throw new ApiError('not_found', `Ejercicio ${id}`, 404);
  return exercise;
}

// ─── Servicios ─────────────────────────────────────────────────────────

export const mockServices: Services = {
  auth: {
    async loginStudent({ username, pictograms }) {
      await delay();
      const demo = data.DEMO_CREDENTIALS.student;
      const ok = username.trim().toLowerCase() === demo.username && (pictograms ?? []).join('') === demo.pictograms.join('');
      if (!ok) return null;
      return { token: issueToken(data.DEMO_IDS.student, 'student'), user: userFor(data.DEMO_IDS.student, 'student'), expiresIn: SESSION_TTL_SEC };
    },
    // Como en el backend real, el mismo ingreso por correo sirve a familias y al equipo.
    async loginFamily({ email, password }) {
      await delay();
      const normalized = email.trim().toLowerCase();
      for (const role of ['family', 'teacher', 'admin'] as const) {
        const demo = data.DEMO_CREDENTIALS[role];
        if (normalized === demo.email && password === demo.password) {
          return { token: issueToken(data.DEMO_IDS[role], role), user: userFor(data.DEMO_IDS[role], role), expiresIn: SESSION_TTL_SEC };
        }
      }
      return null;
    },
    async me(token) {
      const payload = verifyToken(token);
      return payload ? userFor(payload.sub, payload.role) : null;
    },
    async logout() {},
  },

  students: {
    async getProfile(ctx) {
      requireRole(ctx, 'student');
      return profileOf(ctx.user.id);
    },
    async getDashboard(ctx) {
      requireRole(ctx, 'student');
      await delay();
      const s = store();
      const graded = s.evaluations.filter((e) => e.kind === 'Semanal' && e.score !== null);
      return {
        profile: profileOf(ctx.user.id),
        mathUnit: data.mathUnit,
        labUnit: data.labUnit,
        classes: buildSchedule(ctx.user.timeZone).classes,
        tasks: s.tasks.filter((t) => t.status !== 'reviewed').slice(0, 3),
        pendingEvaluation: s.evaluations.find((e) => e.status === 'available') ?? null,
        recentScores: graded.slice(-2).map((e) => ({ topic: e.topic, score: e.score as number })),
        notifications: s.notifications.slice(0, 2),
      };
    },
    async getLearningPath(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return { profile: profileOf(ctx.user.id), mathUnit: data.mathUnit, labUnit: data.labUnit, labs: data.monthlyLabs, frequency: data.frequency };
    },
    async getAchievements(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return { profile: profileOf(ctx.user.id), badges: data.badges, portfolio: data.portfolio, certificates: data.certificates };
    },
  },

  notifications: {
    async list(ctx) {
      const s = store();
      return ctx.user.role === 'student' ? s.notifications : s.familyNotifications;
    },
    async markAllRead(ctx) {
      const s = store();
      const list = ctx.user.role === 'student' ? s.notifications : s.familyNotifications;
      list.forEach((n) => (n.read = true));
    },
  },

  lessons: {
    async getCurrentMathLesson(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return { lesson: data.mathLesson, unit: data.mathUnit };
    },
    async getCurrentLabLesson(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return { lesson: data.labLesson, unit: data.labUnit };
    },
    async checkAnswer(ctx, exerciseId, answer, practice) {
      requireRole(ctx, 'student');
      const result = checkFractionAnswer(answer, findExercise(exerciseId).answer, practice.attempts, practice.hintsUsed);
      if (result.correct) {
        const s = store();
        s.stars[ctx.user.id] = (s.stars[ctx.user.id] ?? 0) + result.starsEarned;
      }
      return result;
    },
  },

  tutor: {
    async ask(ctx, request) {
      requireRole(ctx, 'student');
      await delay();
      return tutorReply(request.exerciseId ? findExercise(request.exerciseId) : null, request);
    },
  },

  assessments: {
    async list(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return store().evaluations;
    },
    async start(ctx, evaluationId) {
      requireRole(ctx, 'student');
      const s = store();
      const evaluation = s.evaluations.find((e) => e.id === evaluationId);
      if (!evaluation || evaluation.status !== 'available' || evaluationId !== data.weeklyQuiz.evaluationId) {
        throw new ApiError('validation', 'La evaluación no está disponible', 422);
      }
      const startedAt = Date.now();
      const attemptId = randomUUID();
      const deadline = startedAt + data.weeklyQuiz.durationSec * 1000;
      s.attempts.set(attemptId, { studentId: ctx.user.id, evaluationId, deadline, submitted: false });
      return {
        attemptId,
        title: data.weeklyQuiz.title,
        questions: data.weeklyQuiz.questions.map(toPublicQuestion),
        durationSec: data.weeklyQuiz.durationSec,
        startedAt: new Date(startedAt).toISOString(),
        deadline: new Date(deadline).toISOString(),
      };
    },
    async submit(ctx, attemptId, answers) {
      requireRole(ctx, 'student');
      await delay();
      const s = store();
      const attempt = s.attempts.get(attemptId);
      if (!attempt || attempt.studentId !== ctx.user.id) throw new ApiError('not_found', 'Intento no encontrado', 404);
      if (attempt.submitted) throw new ApiError('validation', 'Este intento ya fue enviado', 422);
      attempt.submitted = true;

      // El límite de tiempo se valida en el servidor (el reloj del navegador no es confiable).
      const late = Date.now() > attempt.deadline + QUIZ_GRACE_MS;
      const result = gradeQuiz(data.weeklyQuiz.questions, answers, late);
      const evaluation = s.evaluations.find((e) => e.id === attempt.evaluationId);
      if (evaluation) {
        Object.assign(evaluation, { status: 'graded', score: result.score, resultLabel: `${result.points} de 20 puntos`, dateLabel: 'Hoy' });
      }
      return result;
    },
  },

  schedule: {
    async getSchedule(ctx) {
      requireRole(ctx, 'student');
      await delay();
      return { ...buildSchedule(ctx.user.timeZone), tasks: store().tasks, attendance: data.attendance, attendanceSummary: null, materials: data.mathLesson.materials };
    },
    async submitTask(ctx, taskId) {
      requireRole(ctx, 'student');
      await delay();
      const task = store().tasks.find((t) => t.id === taskId);
      if (!task) throw new ApiError('not_found', 'Tarea no encontrada', 404);
      if (task.status === 'pending') Object.assign(task, { status: 'submitted', dueLabel: 'Entregado hoy' } satisfies Partial<Task>);
      return task;
    },
  },

  family: {
    async getChildren(ctx) {
      requireRole(ctx, 'family');
      await delay();
      const evaluations = store().evaluations;
      const classes = buildSchedule(ctx.user.timeZone).classes;
      const valentina: ChildOverview = {
        id: data.DEMO_IDS.student,
        displayName: 'Valentina Roque',
        enrollments: [{ id: 'enr-1', courseTitle: 'Matemáticas · Secundaria Intermedio', offeringName: 'Grupo A · Lun y Mié 5 p. m.', status: 'active', activatedAt: new Date().toISOString() }],
        upcomingClasses: classes,
        profile: profileOf(data.DEMO_IDS.student),
        report: data.weeklyReport,
        evaluations,
        attendance: data.attendance,
        attendanceSummary: null,
        portfolio: data.portfolio,
        certificates: data.certificates,
        badges: data.badges,
        weeklyAverage: weeklyAverage(evaluations),
      };
      const mateo: ChildOverview = {
        id: data.DEMO_IDS.sibling,
        displayName: 'Mateo Roque',
        enrollments: [{ id: 'enr-2', courseTitle: 'Matemáticas · Primaria por niveles', offeringName: 'Grupo B · Sáb 10 a. m.', status: 'pending', activatedAt: null }],
        upcomingClasses: [],
        profile: data.profiles[data.DEMO_IDS.sibling],
        report: null,
        evaluations: [],
        attendance: data.siblingAttendance,
        attendanceSummary: null,
        portfolio: [],
        certificates: [],
        badges: [],
        weeklyAverage: 91,
      };
      return [valentina, mateo];
    },
    async getMessages(ctx) {
      requireRole(ctx, 'family');
      await delay();
      return store().messages;
    },
    async sendMessage(ctx, text) {
      requireRole(ctx, 'family');
      await delay();
      const message: ChatMessage = { id: randomUUID(), author: 'family', authorName: ctx.user.displayName, text, sentAt: new Date().toISOString() };
      store().messages.push(message);
      return message;
    },
    async getMembership(ctx) {
      requireRole(ctx, 'family');
      return data.membership;
    },
  },

  admin: mockAdmin,
  practice: mockPractice,
  teacher: mockTeacher,
};
