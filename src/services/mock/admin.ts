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
  IssuedCredentials,
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
    coverUrl: null, coverOriginalFileName: null,
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
};
