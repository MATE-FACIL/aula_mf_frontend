// Práctica del alumno (SCRUM-61) y pantallas del profesor (SCRUM-70) contra la API real en Docker, con login real por
// formulario. El navegador responde de verdad: el backend corrige y guarda cada intento.
import { join } from 'node:path';
import { base, check, finish, getPage as get, launch, noHorizontalScroll, output, realApi, seedCourse, submitLogin, waitForText } from '../lib.mjs';

const { call } = realApi();
// Con streaming, `notFound()` dentro de <Suspense> llega con estado 200 pero muestra la pantalla «no existe»
// (Next marca el error 404 en la respuesta). Se acepta cualquiera de las dos formas.
const notFoundPage = (page) => page.status === 404 || page.html.includes('NEXT_HTTP_ERROR_FALLBACK;404');
const tag = Date.now().toString().slice(-6);
// La primera clase empieza en 5 min: la asistencia ya está abierta (15 min antes).
const { course, offering, teacher } = await seedCourse(call, tag, [5, 2880]);

// Contenido: una lección publicada con dos ejercicios
const content = `/courses/${course.id}/content`;
const unit = await call('POST', `${content}/units`, { title: 'Unidad 1' });
const lesson = await call('POST', `${content}/units/${unit.id}/lessons`, { title: `Sumar fracciones ${tag}`, isPublished: true, materials: [] });
await call('PUT', `/courses/${course.id}/lessons/${lesson.id}/exercises`, {
  exercises: [
    { kind: 'multiple_choice', prompt: '¿Cuánto es 1/2 + 1/4?', options: ['3/4', '2/6', '1/6'], correctOption: 0, explanation: `Común denominador ${tag}: 2/4 + 1/4 = 3/4.` },
    { kind: 'numeric', prompt: '¿Cuánto es 7 ÷ 2?', correctNumber: 3.5, tolerance: 0, explanation: '7 ÷ 2 = 3,5.' },
  ],
});

// Alumnos activos del grupo, y otro grupo con otro profesor
const student = async (name, doc) => {
  const created = await call('POST', '/admin/students', { givenNames: name, firstSurname: `Practica${tag}`, documentType: 'DNI', documentNumber: doc });
  const seat = await call('POST', '/enrollments', { studentUserId: created.userId, courseOfferingId: offering.id });
  await call('POST', `/enrollments/${seat.id}/activate`, { paymentNote: 'Yape' });
  return created;
};
const ana = await student('Ana', `6${tag}1`);
await student('Luis', `6${tag}2`);
const other = await seedCourse(call, `${tag}b`, [2880]);

// ─── Alumno ────────────────────────────────────────────────────────────
const anaLogin = await submitLogin({ username: ana.loginIdentifier, password: ana.initialPassword });
let page = await get('/lecciones/practica', anaLogin.cookies);
check('mis prácticas: el curso real con su lección y 0 de 2', page.status === 200 && page.html.includes(course.title) && page.html.includes(`Sumar fracciones ${tag}`) && page.html.includes('0 de 2 resueltos'), page.status);
page = await get(`/lecciones/practica/${lesson.id}`, anaLogin.cookies);
check('la práctica llega sin la respuesta ni la explicación', page.status === 200 && page.html.includes('¿Cuánto es 1/2 + 1/4?') && !page.html.includes(`Común denominador ${tag}`) && !/correctOption|correctNumber/.test(page.html), page.status);
page = await get(`/lecciones/practica/${other.offering.id}`, anaLogin.cookies);
check('una lección que no es suya (o no existe) → «no encontrada», sin datos', notFoundPage(page) && !page.html.includes('¿Cuánto es'), page.status);

const browser = await launch();
const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await phone.addCookies(cookiesFor(anaLogin.cookies));
const p = await phone.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${base}/lecciones/practica/${lesson.id}`, { waitUntil: 'networkidle' });
const runner = p.locator('section[aria-labelledby="practice-title"]').filter({ visible: true });
const feedback = () => runner.locator('[aria-live="polite"]').last();
await runner.getByLabel('2/6').check();
await runner.getByRole('button', { name: 'Comprobar' }).click();
await waitForText(feedback(), (t) => t.includes('Todavía no'));
check('incorrecta: el backend corrige y llega su explicación', (await runner.innerText()).includes(`Común denominador ${tag}`));
await runner.getByLabel('3/4').check();
await runner.getByRole('button', { name: 'Comprobar' }).click();
await waitForText(feedback(), (t) => t.includes('Correcto'));
check('correcta: el avance real sube a 1 de 2', (await runner.locator('header p').innerText()).startsWith('1 de 2 resueltos'));
await runner.getByRole('button', { name: 'Siguiente ejercicio →' }).click();
await runner.getByLabel('¿Cuánto es 7 ÷ 2?').fill('3,5');
await runner.getByRole('button', { name: 'Comprobar' }).click();
await waitForText(feedback(), (t) => t.includes('Correcto'));
await runner.getByRole('button', { name: 'Terminar práctica' }).click();
check('termina la práctica con 2 de 2', (await waitForText(runner, (t) => t.includes('Práctica terminada'))).includes('2 de 2 resueltos'));
await p.screenshot({ path: join(output, 'real-practica-celular.png'), fullPage: true });
check('práctica sin desborde en el celular', await noHorizontalScroll(p));
await phone.close();

// ─── Profesor ──────────────────────────────────────────────────────────
const teacherLogin = await submitLogin({ email: teacher.loginIdentifier, password: teacher.initialPassword });
check('login real del profesor: rol teacher', teacherLogin.cookies.mf_role === 'teacher', teacherLogin.cookies.mf_role);
page = await get('/profesor', teacherLogin.cookies);
check('mis grupos: solo su grupo real, sin el del otro profesor', page.status === 200 && page.html.includes(course.title) && !page.html.includes(other.course.title), page.status);
page = await get(`/profesor/grupos/${offering.id}`, teacherLogin.cookies);
check('el grupo: alumnos reales con su avance de práctica', page.html.includes(`Ana Practica${tag}`) && page.html.includes(`Luis Practica${tag}`) && page.html.includes('2 de 2 resueltos') && page.html.includes('0 de 2 resueltos'));
page = await get(`/profesor/grupos/${other.offering.id}`, teacherLogin.cookies);
check('el grupo de otro profesor → «no encontrado», sin sus datos', notFoundPage(page) && !page.html.includes(other.offering.name + ' ') && !page.html.includes(other.course.title), page.status);
page = await get('/admin', teacherLogin.cookies);
check('el profesor no entra a la administración', [303, 307].includes(page.status) && page.location?.endsWith('/profesor'), [page.status, page.location]);

const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
await tablet.addCookies(cookiesFor(teacherLogin.cookies));
const t = await tablet.newPage();
t.on('pageerror', (e) => errors.push(e.message));
await t.goto(`${base}/profesor/grupos/${offering.id}`, { waitUntil: 'networkidle' });
await t.getByRole('heading', { name: 'Alumnos' }).waitFor({ timeout: 8000 });
await t.screenshot({ path: join(output, 'real-profesor-grupo-tableta.png'), fullPage: true });
await t.getByRole('link', { name: /Tomar asistencia/ }).filter({ visible: true }).first().click();
await t.waitForURL(/\/clases\/[0-9a-f-]{36}\?n=1/);
const summary = t.locator('[aria-label="Resumen de la clase"]').filter({ visible: true });
await summary.waitFor({ timeout: 8000 });
check('la clase de hoy: 2 alumnos sin marcar', /Sin marcar\s*2/.test(await summary.innerText()), await summary.innerText());
await t.getByRole('button', { name: 'Todos presentes' }).filter({ visible: true }).click();
const after = await waitForText(summary, (text) => /Sin marcar\s*0/.test(text));
check('asistencia en un clic: los 2 quedan presentes en el backend', /Asistió\s*2/.test(after) && /Sin marcar\s*0/.test(after), after);
const checked = await t.locator('form ol input[type="radio"][value="present"]:checked').filter({ visible: true }).count();
check('la lista se actualiza: los 2 aparecen marcados «Asistió»', checked === 2, checked);
await t.screenshot({ path: join(output, 'real-profesor-asistencia-tableta.png'), fullPage: true });
check('asistencia sin desborde en tableta', await noHorizontalScroll(t));
await tablet.close();
await browser.close();

const detail = await call('GET', `/attendance/sessions/${(await call('GET', `/courses/${course.id}/offerings/${offering.id}`)).sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0].id}`);
check('el backend guardó las 2 marcas', detail.students.filter((s) => s.status === 'present').length === 2, detail.students.map((s) => s.status));
check('sin errores en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
finish();
