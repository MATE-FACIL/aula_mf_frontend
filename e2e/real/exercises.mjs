// Editor de ejercicios de práctica (SCRUM-59 desde el panel) contra la API real en Docker: el administrador y el profesor
// del curso escriben ejercicios en el navegador; el backend los guarda, el alumno los recibe SIN la respuesta, y un
// profesor no puede tocar un curso que no enseña.
import { base, check, finish, getPage as get, launch, noHorizontalScroll, realApi, seedCourse, submitLogin, waitForText } from '../lib.mjs';

const { adminToken, call } = realApi();
const tag = Date.now().toString().slice(-6);
const { course, offering, teacher } = await seedCourse(call, tag, [2880]);
const unit = await call('POST', `/courses/${course.id}/content/units`, { title: 'Unidad 1' });
const lesson = await call('POST', `/courses/${course.id}/content/units/${unit.id}/lessons`, { title: `Sumar ${tag}`, isPublished: true, materials: [] });
const other = await seedCourse(call, `${tag}b`, [2880]);

const ana = await call('POST', '/admin/students', { givenNames: 'Ana', firstSurname: `Editor${tag}`, documentType: 'DNI', documentNumber: `8${tag}1` });
const seat = await call('POST', '/enrollments', { studentUserId: ana.userId, courseOfferingId: offering.id });
await call('POST', `/enrollments/${seat.id}/activate`, { paymentNote: 'Yape' });

const exercisesOf = () => call('GET', `/courses/${course.id}/lessons/${lesson.id}/exercises`);
const browser = await launch();
const errors = [];
const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));
const vis = (locator) => locator.filter({ visible: true });

// ─── Administrador: un ejercicio de opción múltiple ────────────────────
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await desktop.addCookies([{ name: 'mf_session', value: adminToken, url: base }, { name: 'mf_role', value: 'admin', url: base }]);
const a = await desktop.newPage();
a.on('pageerror', (e) => errors.push(e.message));
await a.goto(`${base}/admin/cursos/${course.id}/contenido/sesiones/${lesson.id}/ejercicios`, { waitUntil: 'networkidle' });
check('admin: sesión sin ejercicios → invitación a agregar el primero', await a.getByText('todavía no tiene ejercicios').isVisible());
await a.getByRole('button', { name: '+ Opción múltiple' }).click();
await a.getByRole('button', { name: /Guardar ejercicios/ }).click();
check('admin: guardar con el enunciado vacío avisa y no envía nada', await a.getByText('Ejercicio 1: Escribe el enunciado.').isVisible() && (await exercisesOf()).length === 0);

await a.getByRole('textbox', { name: 'Enunciado' }).fill('¿Cuánto es 1/2 + 1/4?');
await a.getByRole('textbox', { name: 'Opción 1' }).fill('3/4');
await a.getByRole('textbox', { name: 'Opción 2' }).fill('2/6');
await a.getByRole('textbox', { name: /Explicación/ }).fill(`Común denominador ${tag}`);
await a.getByRole('button', { name: /Guardar ejercicios/ }).click();
check('admin: sin marcar la correcta avisa y conserva lo escrito', await a.getByText('Marca cuál de las opciones es la correcta.').isVisible()
  && await a.getByRole('textbox', { name: 'Enunciado' }).inputValue() === '¿Cuánto es 1/2 + 1/4?');
await a.getByLabel('La opción 1 es la correcta').check();
await a.getByRole('button', { name: /Guardar ejercicios/ }).click();
await waitForText(a.locator('body'), (t) => t.includes('Guardado: 1 ejercicio'));
const saved = await exercisesOf();
check('admin: el backend guardó el ejercicio con su respuesta y explicación', saved.length === 1 && saved[0].correctOption === 0
  && saved[0].options.join() === '3/4,2/6' && saved[0].explanation === `Común denominador ${tag}`, saved);

// ─── Profesor del curso (celular): agrega uno numérico y conserva el primero ─
const teacherLogin = await submitLogin({ email: teacher.loginIdentifier, password: teacher.initialPassword });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await phone.addCookies(cookiesFor(teacherLogin.cookies));
const t = await phone.newPage();
t.on('pageerror', (e) => errors.push(e.message));
await t.goto(`${base}/profesor/cursos/${course.id}`, { waitUntil: 'networkidle' });
check('profesor: ve las sesiones publicadas de su curso', await t.getByRole('link', { name: new RegExp(`Sumar ${tag}`) }).isVisible());
await t.getByRole('link', { name: new RegExp(`Sumar ${tag}`) }).click();
await t.waitForURL(/\/lecciones\//);
check('profesor: el editor trae el ejercicio guardado con su respuesta', await vis(t.getByRole('textbox', { name: 'Enunciado' })).first().inputValue() === '¿Cuánto es 1/2 + 1/4?');
await t.getByRole('button', { name: '+ Respuesta numérica' }).click();
await vis(t.getByRole('textbox', { name: 'Enunciado' })).nth(1).fill('¿Cuánto es 7 ÷ 2?');
await t.getByRole('textbox', { name: 'Número correcto' }).fill('3,5');
check('profesor: el editor no se desborda en el celular', await noHorizontalScroll(t));
await t.getByRole('button', { name: /Guardar ejercicios/ }).click();
await waitForText(t.locator('body'), (text) => text.includes('Guardado: 2 ejercicios'));
const both = await exercisesOf();
check('profesor: se guardaron 2 ejercicios y el primero conserva su identificador', both.length === 2 && both[0].id === saved[0].id && both[1].correctNumber === 3.5, both);

// ─── Un curso que no enseña ────────────────────────────────────────────
const foreign = await get(`/profesor/cursos/${other.course.id}`, teacherLogin.cookies);
check('profesor: un curso que no enseña → «no encontrado», sin datos', (foreign.status === 404 || foreign.html.includes('NEXT_HTTP_ERROR_FALLBACK;404')) && !foreign.html.includes(other.course.title));

// ─── El alumno recibe los ejercicios sin la respuesta ──────────────────
const anaLogin = await submitLogin({ username: ana.loginIdentifier, password: ana.initialPassword });
const practice = await get(`/lecciones/practica/${lesson.id}`, anaLogin.cookies);
check('alumno: ve los dos ejercicios, sin respuesta ni explicación', practice.status === 200 && practice.html.includes('¿Cuánto es 1/2 + 1/4?') && practice.html.includes('¿Cuánto es 7 ÷ 2?')
  && !practice.html.includes(`Común denominador ${tag}`) && !/correctOption|correctNumber/.test(practice.html), practice.status);

// ─── Quitar uno: deja de verse, el otro sigue ──────────────────────────
await t.reload({ waitUntil: 'networkidle' });
await vis(t.getByRole('button', { name: 'Quitar Ejercicio 1' })).first().click();
await t.getByRole('button', { name: /Guardar ejercicios/ }).click();
await waitForText(t.locator('body'), (text) => text.includes('Guardado: 1 ejercicio'));
const left = await exercisesOf();
check('quitar el primero deja solo el numérico, y vuelve a ser el ejercicio 1', left.length === 1 && left[0].id === both[1].id && left[0].number === 1, left);

check('sin errores de JavaScript en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
finish();
