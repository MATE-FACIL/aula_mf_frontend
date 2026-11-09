import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { Services } from '../contracts';
import { httpAdmin } from './admin';
import { backendAuth } from './auth';
import { fetchLiveSchedule } from './classes';
import { fetchStudentAttendance } from './student-attendance';
import { fetchChildren } from './family';
import { enc } from './shared';

// Implementación contra la API .NET. Cada método es una llamada fina: la lógica de negocio
// (corrección, límites de tiempo, reglas del tutor) vive en el backend.
// Autenticación y administración usan endpoints que YA existen en el backend; el resto de rutas
// son la PROPUESTA de contrato para el equipo .NET (ver README › «Contrato de la API»).

export const httpServices: Services = {
  auth: backendAuth,
  admin: httpAdmin,

  students: {
    getProfile: ({ token }) => apiRequest('/students/me', { token }),
    getDashboard: ({ token }) => apiRequest('/students/me/dashboard', { token }),
    getLearningPath: ({ token }) => apiRequest('/students/me/learning-path', { token }),
    getAchievements: ({ token }) => apiRequest('/students/me/achievements', { token }),
  },

  notifications: {
    list: ({ token }) => apiRequest('/notifications', { token }),
    markAllRead: ({ token }) => apiRequest('/notifications/read-all', { method: 'POST', token }),
  },

  lessons: {
    getCurrentMathLesson: ({ token }) => apiRequest('/students/me/lessons/current?track=math', { token }),
    getCurrentLabLesson: ({ token }) => apiRequest('/students/me/lessons/current?track=lab', { token }),
    checkAnswer: ({ token }, exerciseId, answer, practice) =>
      apiRequest(`/practice/exercises/${enc(exerciseId)}/check`, { method: 'POST', token, body: { answer, ...practice } }),
  },

  tutor: {
    // El tutor real (LLM) puede tardar más: límite de tiempo propio.
    ask: ({ token }, request) => apiRequest('/tutor/ask', { method: 'POST', token, body: request, timeoutMs: 20_000 }),
  },

  assessments: {
    list: ({ token }) => apiRequest('/students/me/evaluations', { token }),
    start: ({ token }, evaluationId) => apiRequest(`/evaluations/${enc(evaluationId)}/attempts`, { method: 'POST', token }),
    submit: ({ token }, attemptId, answers) =>
      apiRequest(`/evaluations/attempts/${enc(attemptId)}/submit`, { method: 'POST', token, body: { answers } }),
  },

  schedule: {
    // Clases, calendario (SCRUM-50/51/52) y asistencia (SCRUM-53) reales, en paralelo. Tareas y materiales aún no existen.
    getSchedule: async (ctx) => {
      const [live, attendance] = await Promise.all([fetchLiveSchedule(ctx), fetchStudentAttendance(ctx)]);
      return { ...live, tasks: [], attendance: attendance.records, attendanceSummary: attendance.summary, materials: [] };
    },
    // Los archivos deben subirse directo al almacenamiento con una URL firmada; aquí solo van sus nombres.
    submitTask: ({ token }, taskId, submission) =>
      apiRequest(`/tasks/${enc(taskId)}/submissions`, { method: 'POST', token, body: submission }),
  },

  family: {
    getChildren: fetchChildren,
    // Mensajes y membresía aún no existen en el backend: esas secciones no se muestran a hijos reales.
    getMessages: async () => [],
    sendMessage: ({ token }, text) => apiRequest('/families/me/messages', { method: 'POST', token, body: { text } }),
    getMembership: async () => ({ plan: 'Por confirmar', detail: '', renewalLabel: '—', price: null }),
  },
};
