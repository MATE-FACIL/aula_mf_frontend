import 'server-only';
import { apiRequest } from '@/lib/http/api-client';
import type { TeacherService } from '../contracts';
import { enc, nullOn403or404, nullOn404 } from './shared';

// Panel del profesor (SCRUM-69/70) contra la API .NET. El backend decide qué grupos son suyos: un grupo ajeno
// responde 404 y una clase ajena 403, aunque alguien cambie la dirección a mano.

export const httpTeacher: TeacherService = {
  listGroups: ({ token }) => apiRequest('/teachers/me/groups', { token }),
  getGroup: ({ token }, offeringId) => nullOn404(apiRequest(`/teachers/me/groups/${enc(offeringId)}`, { token })),
  getSessionAttendance: ({ token }, sessionId) => nullOn403or404(apiRequest(`/attendance/sessions/${enc(sessionId)}`, { token })),
  markAttendance: ({ token }, sessionId, records) =>
    apiRequest(`/attendance/sessions/${enc(sessionId)}`, { method: 'PUT', token, body: { records } }),
  markRemainingPresent: ({ token }, sessionId) =>
    apiRequest(`/attendance/sessions/${enc(sessionId)}/present-all`, { method: 'POST', token }),
  getCourseLessons: ({ token }, courseId) => nullOn404(apiRequest(`/teachers/me/courses/${enc(courseId)}/lessons`, { token })),
  getLessonExercises: ({ token }, courseId, lessonId) =>
    nullOn404(apiRequest(`/teachers/me/courses/${enc(courseId)}/lessons/${enc(lessonId)}/exercises`, { token })),
  replaceLessonExercises: ({ token }, courseId, lessonId, exercises) =>
    apiRequest(`/teachers/me/courses/${enc(courseId)}/lessons/${enc(lessonId)}/exercises`, { method: 'PUT', token, body: { exercises } }),
};
