import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/http/errors';
import type {
  AccountStatus,
  AdminCourse,
  AdminLinkedUser,
  AdminUserDetail,
  AdminUserListItem,
  BackendRole,
  CourseCategory,
  CourseOffering,
  Enrollment,
  EnrollmentStatus,
  Instructor,
  IssuedCredentials,
  OfferingSeats,
  SaveOfferingInput,
} from '@/types/admin';
import type { AdminService, RequestContext } from '../contracts';

// Panel de administración EN MEMORIA (modo mock). Imita las reglas del backend .NET:
// paginación y filtros, usuario del alumno = inicial del primer apellido + documento,
// la contraseña inicial se entrega una sola vez y los vínculos exigen padre/tutor ↔ alumno.

const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 120);
const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60_000;
const RECENT_COUNT = 5;
const MAX_PAGE_SIZE = 100;

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

interface Person {
  id: string;
  givenNames: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string | null;
  documentType: string | null;
  documentNumber: string | null;
  loginIdentifier: string | null;
  roles: BackendRole[];
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

function createStore() {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60_000).toISOString();
  const person = (p: Partial<Person> & Pick<Person, 'givenNames' | 'firstSurname' | 'roles'>): Person => ({
    id: randomUUID(),
    secondSurname: null,
    email: null,
    documentType: 'DNI',
    documentNumber: null,
    loginIdentifier: null,
    status: 'active',
    createdAt: daysAgo(1),
    lastLoginAt: null,
    ...p,
  });

  const rosa = person({ givenNames: 'Rosa', firstSurname: 'Roque', secondSurname: 'Huamán', email: 'familia@matefacil.pe', loginIdentifier: 'familia@matefacil.pe', roles: ['guardian'], createdAt: daysAgo(20), lastLoginAt: daysAgo(1) });
  const valentina = person({ givenNames: 'Valentina', firstSurname: 'Roque', documentNumber: '77340061', loginIdentifier: 'R77340061', roles: ['student'], createdAt: daysAgo(20), lastLoginAt: daysAgo(0) });
  const mateo = person({ givenNames: 'Mateo', firstSurname: 'Roque', documentNumber: '77340062', loginIdentifier: 'R77340062', roles: ['student'], createdAt: daysAgo(20) });
  const carlos = person({ givenNames: 'Carlos', firstSurname: 'Quispe', email: 'carlos.quispe@correo.pe', loginIdentifier: 'carlos.quispe@correo.pe', roles: ['guardian'], createdAt: daysAgo(3) });
  const lucia = person({ givenNames: 'Lucía', firstSurname: 'Quispe', documentNumber: '78120033', loginIdentifier: 'Q78120033', roles: ['student'], createdAt: daysAgo(3) });
  const diego = person({ givenNames: 'Diego', firstSurname: 'Mamani', documentNumber: '79001122', loginIdentifier: 'M79001122', roles: ['student'], status: 'inactive', createdAt: daysAgo(12) });
  const admin = person({ givenNames: 'Equipo', firstSurname: 'Mate Fácil', email: 'admin@matefacil.pe', loginIdentifier: 'admin@matefacil.pe', roles: ['administrator'], createdAt: daysAgo(60), lastLoginAt: daysAgo(0) });

  const categories: CourseCategory[] = [
    { id: randomUUID(), name: 'Matemáticas' },
    { id: randomUUID(), name: 'Laboratorio digital' },
  ];
  const course = (title: string, categoryId: string, isPublished: boolean, shortDescription: string): AdminCourse => ({
    id: randomUUID(), title, categoryId, isPublished, shortDescription,
    fullDescription: null, objectives: null, syllabus: null, targetAudience: null, prerequisites: null,
    coverUrl: null, coverOriginalFileName: null, sessionDurationMinutes: title.includes('Primaria') ? 60 : 90,
  });

  return {
    people: [admin, rosa, valentina, mateo, carlos, lucia, diego],
    links: [[rosa.id, valentina.id], [rosa.id, mateo.id], [carlos.id, lucia.id]] as [string, string][],
    categories,
    courses: [
      course('Matemáticas · Secundaria Intermedio', categories[0].id, true, 'Álgebra, fracciones y problemas para 2.º y 3.º de secundaria.'),
      course('Matemáticas · Primaria por niveles', categories[0].id, false, 'Temario de primaria organizado por niveles.'),
      course('Lab Roblox · Scripting', categories[1].id, true, 'Programación con Lua creando juegos en Roblox.'),
    ],
  };
}

type Store = ReturnType<typeof createStore>;
const globalForStore = globalThis as unknown as { __mfMockAdminStore?: Store };
const store = () => (globalForStore.__mfMockAdminStore ??= createStore());

function requireAdmin(ctx: RequestContext) {
  if (ctx.user.role !== 'admin') throw new ApiError('forbidden', 'Se requiere el rol admin', 403);
}

const fullName = (p: Person) => [p.givenNames, p.firstSurname, p.secondSurname].filter(Boolean).join(' ');
const linkCount = (id: string) => store().links.filter(([g, s]) => g === id || s === id).length;

function toListItem(p: Person): AdminUserListItem {
  return {
    id: p.id, fullName: fullName(p), email: p.email, documentNumber: p.documentNumber, loginIdentifier: p.loginIdentifier,
    roles: p.roles, status: p.status, createdAt: p.createdAt, lastLoginAt: p.lastLoginAt, linkCount: linkCount(p.id),
  };
}

const toLinked = (p: Person): AdminLinkedUser => ({ id: p.id, fullName: fullName(p), loginIdentifier: p.loginIdentifier, status: p.status });

function findPerson(id: string): Person {
  const p = store().people.find((x) => x.id === id);
  if (!p) throw new ApiError('not_found', `Persona ${id}`, 404, undefined, 'No encontramos a esa persona.');
  return p;
}

/** Sin mayúsculas ni tildes, como `unaccent` + ILIKE en el backend («lucia» encuentra «Lucía»). */
const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

function matchesSearch(p: Person, search: string | undefined): boolean {
  if (!search?.trim()) return true;
  const haystack = fold([p.givenNames, p.firstSurname, p.secondSurname, p.email, p.documentNumber].filter(Boolean).join(' '));
  return fold(search).split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

function ensureUnique(login: string, documentNumber: string | undefined) {
  const s = store();
  if (s.people.some((p) => p.loginIdentifier?.toLowerCase() === login.toLowerCase())) {
    throw new ApiError('conflict', 'Login duplicado', 409, undefined, 'Ya existe una cuenta con ese usuario o correo.');
  }
  if (documentNumber && s.people.some((p) => p.documentNumber === documentNumber)) {
    throw new ApiError('conflict', 'Documento duplicado', 409, undefined, 'Ya hay una persona registrada con ese número de documento.');
  }
}

const newPassword = () => randomBytes(9).toString('base64url');

function findCourse(id: string): AdminCourse {
  const course = store().courses.find((c) => c.id === id);
  if (!course) throw new ApiError('not_found', `Curso ${id}`, 404);
  return course;
}

function checkCategory(categoryId: string | null) {
  if (categoryId && !store().categories.some((c) => c.id === categoryId)) {
    throw new ApiError('validation', 'Categoría inexistente', 400, undefined, 'La categoría elegida no existe.');
  }
}

// ─── Matrículas: grupos (ediciones) con cupo y altas manuales ──────────

type MockOffering = CourseOffering;

interface MockInstructor {
  id: string;
  fullName: string;
  email: string;
}

interface MockEnrollment {
  id: string;
  studentUserId: string;
  courseOfferingId: string;
  status: EnrollmentStatus;
  paymentNote: string | null;
  createdAt: string;
  createdBy: string;
  activatedAt: string | null;
  activatedBy: string | null;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
}

function createEnrollmentStore() {
  const [mate, , lab] = store().courses;
  const instructors: MockInstructor[] = [
    { id: randomUUID(), fullName: 'Lucía Paredes', email: 'lucia@matefacil.pe' },
    { id: randomUUID(), fullName: 'Diego Salas', email: 'diego@matefacil.pe' },
  ];
  // Sesiones semanales a partir del próximo lunes, a las 22:00 UTC (5 p. m. en Lima).
  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  monday.setUTCHours(22, 0, 0, 0);
  const weekly = (count: number, minutes: number) =>
    Array.from({ length: count }, (_, i) => {
      const startsAt = new Date(monday.getTime() + i * 7 * 86_400_000);
      return { id: randomUUID(), startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + minutes * 60_000).toISOString(), virtualLink: 'https://meet.example.com/mf-mate' };
    });
  const offering = (courseId: string, name: string, maximumCapacity: number, status: 'draft' | 'published', instructorIds: string[], sessions: CourseOffering['sessions']): MockOffering => ({
    id: randomUUID(), courseId, name, status, maximumCapacity, basePrice: 180, currencyCode: 'PEN',
    plannedSessionCount: sessions.length, instructorIds, sessions,
  });
  const offerings: MockOffering[] = [
    offering(mate.id, 'Grupo A · Lun y Mié 5 p. m.', 8, 'published', [instructors[0].id], weekly(4, 90)),
    offering(mate.id, 'Grupo B · Sáb 10 a. m.', 2, 'published', [instructors[0].id], weekly(4, 90)),
    offering(lab.id, 'Grupo único · Vie 4 p. m.', 12, 'draft', [], weekly(2, 90)),
  ];
  const people = store().people;
  const adminId = people.find((p) => p.roles.includes('administrator'))?.id ?? 'adm-equipo';
  const studentId = (name: string) => people.find((p) => p.givenNames === name)?.id ?? randomUUID();
  const now = new Date().toISOString();
  const enrollment = (who: string, offering: MockOffering, status: EnrollmentStatus, paymentNote: string | null): MockEnrollment => ({
    id: randomUUID(), studentUserId: studentId(who), courseOfferingId: offering.id, status, paymentNote,
    createdAt: now, createdBy: adminId,
    activatedAt: status === 'active' ? now : null, activatedBy: status === 'active' ? adminId : null,
    withdrawnAt: null, withdrawnBy: null,
  });
  return {
    offerings,
    instructors,
    enrollments: [
      enrollment('Valentina', offerings[0], 'active', 'Yape · op. 482913'),
      enrollment('Lucía', offerings[0], 'pending', null),
      enrollment('Mateo', offerings[1], 'pending', 'Transferencia por confirmar'),
    ],
  };
}

const globalForEnrollments = globalThis as unknown as { __mfMockEnrollments?: ReturnType<typeof createEnrollmentStore> };
const enrollmentStore = () => (globalForEnrollments.__mfMockEnrollments ??= createEnrollmentStore());

const takenSeats = (offeringId: string) =>
  enrollmentStore().enrollments.filter((e) => e.courseOfferingId === offeringId && e.status !== 'withdrawn').length;

function toEnrollment(e: MockEnrollment): Enrollment {
  const people = store().people;
  const nameOf = (id: string | null) => {
    const person = id ? people.find((p) => p.id === id) : undefined;
    return person ? fullName(person) : null;
  };
  const offering = enrollmentStore().offerings.find((o) => o.id === e.courseOfferingId);
  const student = people.find((p) => p.id === e.studentUserId);
  return {
    id: e.id, studentUserId: e.studentUserId, studentName: student ? fullName(student) : '(persona eliminada)',
    studentDocument: student?.documentNumber ?? null, courseOfferingId: e.courseOfferingId,
    courseTitle: store().courses.find((c) => c.id === offering?.courseId)?.title ?? '(curso eliminado)',
    offeringName: offering?.name ?? '(edición eliminada)', status: e.status, paymentNote: e.paymentNote,
    createdAt: e.createdAt, createdByName: nameOf(e.createdBy), activatedAt: e.activatedAt, activatedByName: nameOf(e.activatedBy),
    withdrawnAt: e.withdrawnAt, withdrawnByName: nameOf(e.withdrawnBy),
  };
}

function findEnrollment(id: string): MockEnrollment {
  const e = enrollmentStore().enrollments.find((x) => x.id === id);
  if (!e) throw new ApiError('not_found', `Matrícula ${id}`, 404, undefined, 'No encontramos esa matrícula.');
  return e;
}

const MAX_PAYMENT_NOTE = 300;
function checkNote(note: string | undefined) {
  if (note && note.trim().length > MAX_PAYMENT_NOTE) {
    throw new ApiError('validation', 'Nota larga', 400, undefined, 'La nota de pago es demasiado larga (máximo 300 caracteres).');
  }
}

function findOffering(courseId: string, offeringId: string): MockOffering {
  const o = enrollmentStore().offerings.find((x) => x.id === offeringId && x.courseId === courseId);
  if (!o) throw new ApiError('not_found', `Grupo ${offeringId}`, 404, undefined, 'No encontramos ese grupo.');
  return o;
}

function checkOffering(input: SaveOfferingInput) {
  if (!input.name.trim()) throw new ApiError('validation', 'Nombre', 400, undefined, 'El grupo necesita un nombre.');
  if (input.maximumCapacity < 1) throw new ApiError('validation', 'Cupo', 400, undefined, 'El cupo debe ser mayor que cero.');
  if (input.sessions.length !== input.plannedSessionCount) {
    throw new ApiError('validation', 'Sesiones', 400, undefined, 'Sessions must match the planned count and have distinct identifiers.');
  }
}

const toSessions = (input: SaveOfferingInput) =>
  input.sessions.map((s) => ({ id: s.id ?? randomUUID(), startsAt: s.startsAt, endsAt: s.endsAt, virtualLink: s.virtualLink }));

export const mockAdmin: AdminService = {
  async getSummary(ctx) {
    requireAdmin(ctx);
    await delay();
    const people = store().people;
    const since = Date.now() - NEW_USER_WINDOW_MS;
    const usersByRole: Partial<Record<BackendRole, number>> = {};
    for (const p of people) for (const r of p.roles) usersByRole[r] = (usersByRole[r] ?? 0) + 1;
    const newest = [...people].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      totalUsers: people.length,
      newUsersLast7Days: people.filter((p) => Date.parse(p.createdAt) >= since).length,
      usersByRole,
      recentUsers: newest.slice(0, RECENT_COUNT).map(toListItem),
    };
  },

  async listUsers(ctx, { search, role, status, page = 1, pageSize = 20 }) {
    requireAdmin(ctx);
    await delay();
    const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const current = Math.max(1, page);
    const matches = store().people
      .filter((p) => (!role || p.roles.includes(role)) && (!status || p.status === status) && matchesSearch(p, search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: matches.slice((current - 1) * size, current * size).map(toListItem), page: current, pageSize: size, total: matches.length };
  },

  async getUser(ctx, userId) {
    requireAdmin(ctx);
    await delay();
    const s = store();
    const p = s.people.find((x) => x.id === userId);
    if (!p) return null;
    const byId = (id: string) => s.people.find((x) => x.id === id);
    const students = s.links.filter(([g]) => g === p.id).map(([, st]) => byId(st)).filter((x): x is Person => !!x);
    const guardians = s.links.filter(([, st]) => st === p.id).map(([g]) => byId(g)).filter((x): x is Person => !!x);
    const detail: AdminUserDetail = {
      ...toListItem(p),
      givenNames: p.givenNames, firstSurname: p.firstSurname, secondSurname: p.secondSurname, documentType: p.documentType,
      students: students.map(toLinked), guardians: guardians.map(toLinked),
    };
    return detail;
  },

  async createStudent(ctx, input) {
    requireAdmin(ctx);
    await delay();
    if (input.guardianUserId && !store().people.some((p) => p.id === input.guardianUserId && p.roles.includes('guardian'))) {
      throw new ApiError('validation', 'Tutor inválido', 400, undefined, 'El padre o tutor indicado no existe o no tiene ese rol.');
    }
    const login = `${input.firstSurname.trim()[0]?.toUpperCase() ?? ''}${input.documentNumber.trim()}`;
    ensureUnique(login, input.documentNumber.trim());
    const person: Person = {
      id: randomUUID(), givenNames: input.givenNames, firstSurname: input.firstSurname, secondSurname: input.secondSurname ?? null,
      email: input.email ?? null, documentType: input.documentType, documentNumber: input.documentNumber.trim(), loginIdentifier: login,
      roles: ['student'], status: 'active', createdAt: new Date().toISOString(), lastLoginAt: null,
    };
    store().people.push(person);
    if (input.guardianUserId) store().links.push([input.guardianUserId, person.id]);
    return { userId: person.id, loginIdentifier: login, initialPassword: newPassword() } satisfies IssuedCredentials;
  },

  async createGuardian(ctx, input) {
    requireAdmin(ctx);
    await delay();
    const email = input.email.trim();
    ensureUnique(email, input.documentNumber?.trim());
    const person: Person = {
      id: randomUUID(), givenNames: input.givenNames, firstSurname: input.firstSurname, secondSurname: input.secondSurname ?? null,
      email, documentType: input.documentType ?? null, documentNumber: input.documentNumber?.trim() || null, loginIdentifier: email,
      roles: ['guardian'], status: 'active', createdAt: new Date().toISOString(), lastLoginAt: null,
    };
    store().people.push(person);
    return { userId: person.id, loginIdentifier: email, initialPassword: newPassword() };
  },

  async setUserActive(ctx, userId, active) {
    requireAdmin(ctx);
    await delay();
    if (!active && userId === ctx.user.id) {
      throw new ApiError('validation', 'Autodesactivación', 400, undefined, 'No puedes desactivar tu propia cuenta.');
    }
    const p = findPerson(userId);
    if (p.status === 'no_account') throw new ApiError('not_found', 'Sin cuenta', 404, undefined, 'Esta persona no tiene cuenta de acceso.');
    p.status = active ? 'active' : 'inactive';
  },

  async linkStudent(ctx, guardianId, studentId) {
    requireAdmin(ctx);
    await delay();
    if (!findPerson(guardianId).roles.includes('guardian')) throw new ApiError('validation', 'No es tutor', 400, undefined, 'La primera persona no es padre o tutor.');
    if (!findPerson(studentId).roles.includes('student')) throw new ApiError('validation', 'No es alumno', 400, undefined, 'La persona a vincular no es alumno.');
    const s = store();
    if (!s.links.some(([g, st]) => g === guardianId && st === studentId)) s.links.push([guardianId, studentId]);
  },

  async unlinkStudent(ctx, guardianId, studentId) {
    requireAdmin(ctx);
    await delay();
    const s = store();
    s.links = s.links.filter(([g, st]) => !(g === guardianId && st === studentId));
  },

  async listCourses(ctx) {
    requireAdmin(ctx);
    await delay();
    return store().courses;
  },

  async getCourse(ctx, courseId) {
    requireAdmin(ctx);
    await delay();
    return store().courses.find((c) => c.id === courseId) ?? null;
  },

  async createCourse(ctx, input) {
    requireAdmin(ctx);
    await delay();
    checkCategory(input.categoryId);
    const course: AdminCourse = { ...input, id: randomUUID(), isPublished: false, coverUrl: null, coverOriginalFileName: null };
    store().courses.push(course);
    return course;
  },

  async updateCourse(ctx, courseId, input) {
    requireAdmin(ctx);
    await delay();
    checkCategory(input.categoryId);
    return Object.assign(findCourse(courseId), input);
  },

  async setCoursePublished(ctx, courseId, published) {
    requireAdmin(ctx);
    await delay();
    const course = findCourse(courseId);
    course.isPublished = published;
    return course;
  },

  async replaceCourseCover(ctx) {
    requireAdmin(ctx);
    throw new ApiError('unavailable', 'Sin almacenamiento en modo mock', 503);
  },

  async listCategories(ctx) {
    requireAdmin(ctx);
    await delay();
    return [...store().categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  async createCategory(ctx, name) {
    requireAdmin(ctx);
    await delay();
    const category = { id: randomUUID(), name };
    store().categories.push(category);
    return category;
  },

  async renameCategory(ctx, categoryId, name) {
    requireAdmin(ctx);
    await delay();
    const category = store().categories.find((c) => c.id === categoryId);
    if (!category) throw new ApiError('not_found', `Categoría ${categoryId}`, 404);
    category.name = name;
    return category;
  },

  async deleteCategory(ctx, categoryId) {
    requireAdmin(ctx);
    await delay();
    const s = store();
    if (s.courses.some((c) => c.categoryId === categoryId)) {
      throw new ApiError('conflict', 'Categoría en uso', 409, undefined, 'La categoría está asignada a un curso.');
    }
    s.categories = s.categories.filter((c) => c.id !== categoryId);
  },

  async listEnrollments(ctx, { courseOfferingId, studentUserId, status, page = 1, pageSize = 20 }) {
    requireAdmin(ctx);
    await delay();
    const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const current = Math.max(1, page);
    const matches = enrollmentStore().enrollments
      .filter((e) => (!courseOfferingId || e.courseOfferingId === courseOfferingId) && (!studentUserId || e.studentUserId === studentUserId) && (!status || e.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: matches.slice((current - 1) * size, current * size).map(toEnrollment), page: current, pageSize: size, total: matches.length };
  },

  async listOfferingSeats(ctx) {
    requireAdmin(ctx);
    await delay();
    return enrollmentStore().offerings.map((o): OfferingSeats => {
      const course = store().courses.find((c) => c.id === o.courseId);
      const taken = takenSeats(o.id);
      return {
        id: o.id, courseId: o.courseId, courseTitle: course?.title ?? '', name: o.name, isPublished: o.status === 'published',
        maximumCapacity: o.maximumCapacity, takenSeats: taken, freeSeats: Math.max(0, o.maximumCapacity - taken),
      };
    });
  },

  async enroll(ctx, { studentUserId, courseOfferingId, paymentNote }) {
    requireAdmin(ctx);
    await delay();
    checkNote(paymentNote);
    if (!findPerson(studentUserId).roles.includes('student')) {
      throw new ApiError('validation', 'No es alumno', 400, undefined, 'Solo se puede matricular a personas con rol de alumno.');
    }
    const offering = enrollmentStore().offerings.find((o) => o.id === courseOfferingId);
    if (!offering) throw new ApiError('not_found', 'Edición', 404, undefined, 'No encontramos esa edición del curso.');
    if (offering.status !== 'published') {
      throw new ApiError('conflict', 'Borrador', 409, undefined, 'Este grupo todavía está en borrador. Publícalo para poder matricular.');
    }
    const live = enrollmentStore().enrollments.filter((e) => e.courseOfferingId === offering.id && e.status !== 'withdrawn');
    if (live.some((e) => e.studentUserId === studentUserId)) {
      throw new ApiError('conflict', 'Duplicada', 409, undefined, 'El alumno ya está matriculado en esta edición.');
    }
    if (live.length >= offering.maximumCapacity) {
      const cap = offering.maximumCapacity;
      throw new ApiError('conflict', 'Lleno', 409, undefined, `El grupo está lleno (${cap} de ${cap} cupos).`);
    }
    const e: MockEnrollment = {
      id: randomUUID(), studentUserId, courseOfferingId, status: 'pending', paymentNote: paymentNote?.trim() || null,
      createdAt: new Date().toISOString(), createdBy: ctx.user.id, activatedAt: null, activatedBy: null, withdrawnAt: null, withdrawnBy: null,
    };
    enrollmentStore().enrollments.push(e);
    return toEnrollment(e);
  },

  async activateEnrollment(ctx, enrollmentId, paymentNote) {
    requireAdmin(ctx);
    await delay();
    checkNote(paymentNote);
    const e = findEnrollment(enrollmentId);
    if (e.status !== 'pending') throw new ApiError('validation', 'Estado', 400, undefined, 'Solo se puede activar una matrícula pendiente.');
    Object.assign(e, { status: 'active', activatedAt: new Date().toISOString(), activatedBy: ctx.user.id, paymentNote: paymentNote?.trim() || e.paymentNote });
    return toEnrollment(e);
  },

  async withdrawEnrollment(ctx, enrollmentId) {
    requireAdmin(ctx);
    await delay();
    const e = findEnrollment(enrollmentId);
    if (e.status === 'withdrawn') throw new ApiError('validation', 'Estado', 400, undefined, 'La matrícula ya estaba retirada.');
    Object.assign(e, { status: 'withdrawn', withdrawnAt: new Date().toISOString(), withdrawnBy: ctx.user.id });
    return toEnrollment(e);
  },

  async listOfferings(ctx, courseId) {
    requireAdmin(ctx);
    await delay();
    if (!store().courses.some((c) => c.id === courseId)) return null;
    return enrollmentStore().offerings.filter((o) => o.courseId === courseId);
  },

  async getOffering(ctx, courseId, offeringId) {
    requireAdmin(ctx);
    await delay();
    return enrollmentStore().offerings.find((o) => o.id === offeringId && o.courseId === courseId) ?? null;
  },

  async createOffering(ctx, courseId, input) {
    requireAdmin(ctx);
    await delay();
    if (!store().courses.some((c) => c.id === courseId)) throw new ApiError('not_found', 'Curso', 404);
    checkOffering(input);
    const o: MockOffering = { id: randomUUID(), courseId, status: 'draft', instructorIds: [], ...input, name: input.name.trim(), sessions: toSessions(input) };
    enrollmentStore().offerings.push(o);
    return o;
  },

  async updateOffering(ctx, courseId, offeringId, input) {
    requireAdmin(ctx);
    await delay();
    const o = findOffering(courseId, offeringId);
    if (o.status !== 'draft') throw new ApiError('conflict', 'Publicado', 409, undefined, 'Only draft editions can be changed.');
    checkOffering(input);
    return Object.assign(o, { ...input, name: input.name.trim(), sessions: toSessions(input) });
  },

  async publishOffering(ctx, courseId, offeringId) {
    requireAdmin(ctx);
    await delay();
    const o = findOffering(courseId, offeringId);
    if (o.instructorIds.length === 0) throw new ApiError('conflict', 'Sin profesor', 409, undefined, 'Edition requires at least one Instructor before publication.');
    if (o.sessions.length !== o.plannedSessionCount) throw new ApiError('conflict', 'Calendario', 409, undefined, 'Edition requires its complete session calendar before publication.');
    o.status = 'published';
    return o;
  },

  async assignInstructors(ctx, courseId, offeringId, instructorIds) {
    requireAdmin(ctx);
    await delay();
    const o = findOffering(courseId, offeringId);
    if (o.status !== 'draft') throw new ApiError('conflict', 'Publicado', 409, undefined, 'Only draft editions can be changed.');
    if (instructorIds.length === 0) throw new ApiError('validation', 'Profesores', 400, undefined, 'Edition requires distinct Instructor identifiers.');
    o.instructorIds = [...new Set(instructorIds)];
    return o;
  },

  async updateSessionLink(ctx, courseId, offeringId, sessionId, virtualLink) {
    requireAdmin(ctx);
    await delay();
    const o = findOffering(courseId, offeringId);
    const session = o.sessions.find((s) => s.id === sessionId);
    if (!session) throw new ApiError('validation', 'Sesión', 400, undefined, 'Session does not belong to this edition.');
    session.virtualLink = virtualLink;
    return o;
  },

  async listInstructors(ctx) {
    requireAdmin(ctx);
    await delay();
    return enrollmentStore().instructors
      .map((i): Instructor => ({ id: i.id, userId: null, fullName: i.fullName, email: i.email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  },

  async createInstructor(ctx, input) {
    requireAdmin(ctx);
    await delay();
    const email = input.email.trim();
    if (enrollmentStore().instructors.some((i) => i.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError('conflict', 'Duplicado', 409, undefined, 'Ya existe una cuenta con ese correo.');
    }
    const instructor = { id: randomUUID(), fullName: [input.givenNames, input.firstSurname, input.secondSurname].filter(Boolean).join(' '), email };
    enrollmentStore().instructors.push(instructor);
    return { instructorId: instructor.id, userId: randomUUID(), loginIdentifier: email, initialPassword: newPassword() };
  },
};
