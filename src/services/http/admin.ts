import 'server-only';
import { apiRequest, query } from '@/lib/http/api-client';
import type { AdminService } from '../contracts';
import { enc, nullOn404 } from './shared';

// Panel de administración contra la API .NET:
//  - /admin/*            → módulo Administration (personas, familias, vínculos).
//  - /courses, /course-categories → módulo Courses (ya existente).
//  - /enrollments        → módulo Enrollments (matrícula con activación manual).
// Cada método es UNA petición; el backend pagina, filtra y arma las listas en la base de datos.

const COVER_UPLOAD_TIMEOUT_MS = 30_000;

export const httpAdmin: AdminService = {
  getSummary: ({ token }) => apiRequest('/admin/summary', { token }),
  listUsers: ({ token }, { search, role, status, page, pageSize }) =>
    apiRequest(`/admin/users${query({ search, role, status, page, pageSize })}`, { token }),
  getUser: ({ token }, userId) => nullOn404(apiRequest(`/admin/users/${enc(userId)}`, { token })),
  createStudent: ({ token }, input) => apiRequest('/admin/students', { method: 'POST', token, body: input }),
  createGuardian: ({ token }, input) => apiRequest('/admin/guardians', { method: 'POST', token, body: input }),
  setUserActive: ({ token }, userId, active) =>
    apiRequest(`/admin/users/${enc(userId)}/status`, { method: 'PUT', token, body: { isActive: active } }),
  linkStudent: ({ token }, guardianId, studentId) =>
    apiRequest(`/admin/guardians/${enc(guardianId)}/students/${enc(studentId)}`, { method: 'PUT', token }),
  unlinkStudent: ({ token }, guardianId, studentId) =>
    apiRequest(`/admin/guardians/${enc(guardianId)}/students/${enc(studentId)}`, { method: 'DELETE', token }),

  listCourses: ({ token }) => apiRequest('/courses', { token }),
  getCourse: ({ token }, courseId) => nullOn404(apiRequest(`/courses/${enc(courseId)}`, { token })),
  createCourse: ({ token }, input) => apiRequest('/courses', { method: 'POST', token, body: input }),
  updateCourse: ({ token }, courseId, input) => apiRequest(`/courses/${enc(courseId)}`, { method: 'PUT', token, body: input }),
  setCoursePublished: ({ token }, courseId, published) =>
    apiRequest(`/courses/${enc(courseId)}/publication`, { method: 'PUT', token, body: { isPublished: published } }),
  replaceCourseCover: ({ token }, courseId, file) => {
    const form = new FormData();
    form.set('file', file, file.name);
    return apiRequest(`/courses/${enc(courseId)}/cover`, { method: 'PUT', token, body: form, timeoutMs: COVER_UPLOAD_TIMEOUT_MS });
  },

  getCourseContent: ({ token }, courseId) => nullOn404(apiRequest(`/courses/${enc(courseId)}/content`, { token })),
  addUnit: ({ token }, courseId, title) => apiRequest(`/courses/${enc(courseId)}/content/units`, { method: 'POST', token, body: { title } }),
  renameUnit: ({ token }, courseId, unitId, title) =>
    apiRequest(`/courses/${enc(courseId)}/content/units/${enc(unitId)}`, { method: 'PUT', token, body: { title } }),
  deleteUnit: ({ token }, courseId, unitId) => apiRequest(`/courses/${enc(courseId)}/content/units/${enc(unitId)}`, { method: 'DELETE', token }),
  reorderUnits: ({ token }, courseId, ids) => apiRequest(`/courses/${enc(courseId)}/content/units/order`, { method: 'PUT', token, body: { ids } }),
  addLesson: ({ token }, courseId, unitId, input) =>
    apiRequest(`/courses/${enc(courseId)}/content/units/${enc(unitId)}/lessons`, { method: 'POST', token, body: input }),
  updateLesson: ({ token }, courseId, lessonId, unitId, input) =>
    apiRequest(`/courses/${enc(courseId)}/content/lessons/${enc(lessonId)}`, { method: 'PUT', token, body: { unitId, ...input } }),
  deleteLesson: ({ token }, courseId, lessonId) => apiRequest(`/courses/${enc(courseId)}/content/lessons/${enc(lessonId)}`, { method: 'DELETE', token }),
  reorderLessons: ({ token }, courseId, unitId, ids) =>
    apiRequest(`/courses/${enc(courseId)}/content/units/${enc(unitId)}/lessons/order`, { method: 'PUT', token, body: { ids } }),
  grantLessonUpload: ({ token }, courseId, lessonId, request) =>
    apiRequest(`/courses/${enc(courseId)}/content/lessons/${enc(lessonId)}/uploads`, { method: 'POST', token, body: request }),

  listCategories: ({ token }) => apiRequest('/course-categories', { token }),
  createCategory: ({ token }, name) => apiRequest('/course-categories', { method: 'POST', token, body: { name } }),
  renameCategory: ({ token }, categoryId, name) =>
    apiRequest(`/course-categories/${enc(categoryId)}`, { method: 'PUT', token, body: { name } }),
  deleteCategory: ({ token }, categoryId) => apiRequest(`/course-categories/${enc(categoryId)}`, { method: 'DELETE', token }),

  listEnrollments: ({ token }, { courseOfferingId, studentUserId, status, page, pageSize }) =>
    apiRequest(`/enrollments${query({ courseOfferingId, studentUserId, status, page, pageSize })}`, { token }),
  listOfferingSeats: ({ token }) => apiRequest('/enrollments/offerings', { token }),
  enroll: ({ token }, input) => apiRequest('/enrollments', { method: 'POST', token, body: input }),
  activateEnrollment: ({ token }, enrollmentId, paymentNote) =>
    apiRequest(`/enrollments/${enc(enrollmentId)}/activate`, { method: 'POST', token, body: { paymentNote: paymentNote ?? null } }),
  withdrawEnrollment: ({ token }, enrollmentId) => apiRequest(`/enrollments/${enc(enrollmentId)}/withdraw`, { method: 'POST', token }),
  getPlacement: ({ token }, studentUserId) => nullOn404(apiRequest(`/enrollments/placement${query({ studentUserId })}`, { token })),
  transferEnrollment: ({ token }, enrollmentId, { courseOfferingId, reason }) =>
    apiRequest(`/enrollments/${enc(enrollmentId)}/transfer`, { method: 'POST', token, body: { courseOfferingId, reason: reason ?? null } }),
  listTransfers: ({ token }, { studentUserId, courseOfferingId, page, pageSize }) =>
    apiRequest(`/enrollments/transfers${query({ studentUserId, courseOfferingId, page, pageSize })}`, { token }),

  listOfferings: ({ token }, courseId) => nullOn404(apiRequest(`/courses/${enc(courseId)}/offerings`, { token })),
  getOffering: ({ token }, courseId, offeringId) =>
    nullOn404(apiRequest(`/courses/${enc(courseId)}/offerings/${enc(offeringId)}`, { token })),
  createOffering: ({ token }, courseId, input) =>
    apiRequest(`/courses/${enc(courseId)}/offerings`, { method: 'POST', token, body: input }),
  updateOffering: ({ token }, courseId, offeringId, input) =>
    apiRequest(`/courses/${enc(courseId)}/offerings/${enc(offeringId)}`, { method: 'PUT', token, body: input }),
  publishOffering: ({ token }, courseId, offeringId) =>
    apiRequest(`/courses/${enc(courseId)}/offerings/${enc(offeringId)}/publish`, { method: 'POST', token }),
  assignInstructors: ({ token }, courseId, offeringId, instructorIds) =>
    apiRequest(`/courses/${enc(courseId)}/offerings/${enc(offeringId)}/instructors`, { method: 'PUT', token, body: { instructorIds } }),
  updateSessionLink: ({ token }, courseId, offeringId, sessionId, virtualLink) =>
    apiRequest(`/courses/${enc(courseId)}/offerings/${enc(offeringId)}/sessions/${enc(sessionId)}/virtual-link`, {
      method: 'PATCH', token, body: { virtualLink },
    }),

  listMathLevels: ({ token }) => apiRequest('/math-levels', { token }),
  provisionMathLevels: ({ token }) => apiRequest('/math-levels/provision', { method: 'POST', token }),

  getSessionAttendance: ({ token }, sessionId) =>
    nullOn404(apiRequest(`/attendance/sessions/${enc(sessionId)}`, { token })),
  markAttendance: ({ token }, sessionId, records) =>
    apiRequest(`/attendance/sessions/${enc(sessionId)}`, { method: 'PUT', token, body: { records } }),

  listInstructors: ({ token }) => apiRequest('/admin/instructors', { token }),
  createInstructor: ({ token }, input) => apiRequest('/admin/instructors', { method: 'POST', token, body: input }),
};
