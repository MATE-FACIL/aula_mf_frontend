// Sesión contra la API real (SCRUM-36): login, clases reales y renovación, también con peticiones simultáneas.
import { randomUUID } from 'node:crypto';
import { check, finish, getPage as get, realApi, seedCourse, signJwt, submitLogin } from '../lib.mjs';

const { call } = realApi();
const tag = Date.now().toString().slice(-6);
const { course, offering } = await seedCourse(call, tag, [5, 2880]);
const student = await call('POST', '/admin/students', { givenNames: 'Ana', firstSurname: `Sesion${tag}`, documentType: 'DNI', documentNumber: `5${tag}` });
const seat = await call('POST', '/enrollments', { studentUserId: student.userId, courseOfferingId: offering.id });
await call('POST', `/enrollments/${seat.id}/activate`, { paymentNote: 'Yape' });

const login = await submitLogin({ username: student.loginIdentifier, password: student.initialPassword });
const session = login.cookies;
check('login real: redirige y guarda sesión, rol y renovación', [303, 307].includes(login.status) && session.mf_session && session.mf_refresh && session.mf_role === 'student', `${login.status} ${Object.keys(session)}`);
const maxAge = login.maxAge.match(/Max-Age=(\d+)/i)?.[1];
check('la sesión dura 7 días (no 15 min)', Number(maxAge) === 7 * 86400, maxAge);
check('la cookie de renovación es httpOnly', /HttpOnly/i.test(login.maxAge));

// 2) Clases reales en «Clases y tareas» e «Inicio»
let r = await get('/clases', session);
check('/clases muestra el curso real del backend', r.status === 200 && r.html.includes(course.title), r.status);
check('/clases: la clase que empieza en 5 min tiene «Entrar» con el enlace real', r.html.includes('Entrar · empieza en') && r.html.includes('https://meet.example.com/geometria'));
r = await get('/inicio', session);
check('/inicio muestra la próxima clase real', r.status === 200 && r.html.includes(course.title), r.status);

// 3) Renovación automática: token de acceso a punto de vencer → el proxy renueva antes de renderizar
const payload = JSON.parse(Buffer.from(session.mf_session.split('.')[1], 'base64url').toString());
const now = Math.floor(Date.now() / 1000);
const nearExpiry = signJwt({ ...payload, jti: randomUUID(), iat: now, exp: now + 20 });

// Cuatro peticiones SIMULTÁNEAS con el mismo token de renovación: si cada una renovara por su cuenta,
// el backend detectaría reuso y revocaría la sesión. Con vuelo único, todas reciben el mismo token nuevo.
const parallel = await Promise.all([1, 2, 3, 4].map(() => get('/clases', { ...session, mf_session: nearExpiry })));
check('4 peticiones simultáneas a punto de vencer: todas cargan', parallel.every((x) => x.status === 200 && x.html.includes(course.title)), parallel.map((x) => x.status).join(','));
const renewed = parallel.map((x) => x.set.mf_refresh).filter(Boolean);
check('todas reciben el MISMO token de renovación nuevo (una sola renovación)', renewed.length === 4 && new Set(renewed).size === 1 && renewed[0] !== session.mf_refresh, renewed.length);
check('reciben un token de acceso nuevo', parallel.every((x) => x.set.mf_session && x.set.mf_session !== nearExpiry));

// La sesión sigue viva: se puede volver a renovar con el token rotado
r = await get('/clases', { ...session, mf_session: nearExpiry, mf_refresh: renewed[0] });
check('la sesión NO fue revocada (se renueva otra vez con el token rotado)', r.status === 200 && r.set.mf_refresh && r.set.mf_refresh !== renewed[0], r.status);

// Un token de acceso con tiempo de sobra no llama al backend
r = await get('/clases', { ...session, mf_refresh: r.set.mf_refresh ?? renewed[0] });
check('token vigente: no renueva (sin Set-Cookie de sesión)', r.status === 200 && !r.set.mf_session, Object.keys(r.set));

// Renovación rechazada (token de renovación viejo o inválido) → al ingreso con «sesión terminada»
r = await get('/clases', { ...session, mf_session: nearExpiry, mf_refresh: 'token-invalido' });
check('renovación rechazada → /ingreso?expirada=1', [307, 308].includes(r.status) && r.location?.includes('/ingreso?expirada=1'), `${r.status} ${r.location}`);

finish();
