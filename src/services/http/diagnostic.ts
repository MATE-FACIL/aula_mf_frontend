import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { DiagnosticService } from '../contracts';
import { enc, nullOn404 } from './shared';

// Diagnóstico de entrada (SCRUM-48/49) contra la API .NET. Una petición por acción: el backend corrige, califica y
// sugiere el nivel; el navegador nunca recibe las respuestas correctas del alumno.

const PAGE_SIZE = 20;

export const httpDiagnostic: DiagnosticService = {
  overview: ({ token }) => apiRequest('/students/me/diagnostics', { token }),
  start: ({ token }, stage) => apiRequest('/students/me/diagnostics', { method: 'POST', token, body: { stage } }),
  get: ({ token }, attemptId) => nullOn404(apiRequest(`/students/me/diagnostics/${enc(attemptId)}`, { token })),
  answer: ({ token }, attemptId, questionId, answer, skip) =>
    apiRequest(`/students/me/diagnostics/${enc(attemptId)}/answers`, { method: 'POST', token, body: { questionId, answer, skip } }),
  listReviews: ({ token }, filter, page) =>
    apiRequest(`/diagnostics?status=${enc(filter)}&page=${page}&pageSize=${PAGE_SIZE}`, { token }),
  getReview: ({ token }, attemptId) => nullOn404(apiRequest(`/diagnostics/${enc(attemptId)}`, { token })),
  confirm: ({ token }, attemptId, level) =>
    apiRequest(`/diagnostics/${enc(attemptId)}/confirm`, { method: 'POST', token, body: { level } }),
};
