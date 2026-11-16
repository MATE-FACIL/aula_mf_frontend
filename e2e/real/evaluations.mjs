// Evaluaciones (SCRUM-62/63) contra la API real en Docker: la profesora arma y publica una evaluación en su grupo desde
// el navegador (celular), la alumna la rinde dentro del plazo, el backend corrige y pone la nota sobre 20, y la profesora ve
// el resultado por competencia. Otro profesor no puede entrar.
import { base, check, finish, getPage as get, launch, noHorizontalScroll, realApi, seedCourse, submitLogin, waitForText } from '../lib.mjs';

const { call } = realApi();
const tag = Date.now().toString().slice(-6);
const { offering, teacher } = await seedCourse(call, tag, [2880]);
const other = await seedCourse(call, `${tag}b`, [2880]);

const ana = await call('POST', '/admin/students', { givenNames: 'Ana', firstSurname: `Evaluada${tag}`, documentType: 'DNI', documentNumber: `9${tag}1` });
const seat = await call('POST', '/enrollments', { studentUserId: ana.userId, courseOfferingId: offering.id });
await call('POST', `/enrollments/${seat.id}/activate`, { paymentNote: 'Yape' });

// Las horas del formulario son de Perú (UTC-5): se escriben igual aquí.
const inLima = (ms) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + ms));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

const browser = await launch();
const errors = [];
const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));
const vis = (locator) => locator.filter({ visible: true });
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

// ─── La profesora arma la evaluación ───────────────────────────────────
const teacherLogin = await submitLogin({ email: teacher.loginIdentifier, password: teacher.initialPassword });
const t = await (async () => {
  const context = await browser.newContext(phone);
  await context.addCookies(cookiesFor(teacherLogin.cookies));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
})();
await t.goto(`${base}/profesor/grupos/${offering.id}`, { waitUntil: 'networkidle' });
check('el grupo muestra la sección de evaluaciones, vacía', await t.getByText('todavía no tiene evaluaciones').isVisible());
await t.getByRole('link', { name: 'Nueva evaluación' }).click();
await t.waitForURL(/\/evaluaciones\/nueva$/);

await t.getByRole('button', { name: 'Crear evaluación' }).click();
check('crear vacía avisa el título y no navega', await t.getByText('Escribe el título.').isVisible() && t.url().endsWith('/nueva'));

await t.getByRole('textbox', { name: 'Título' }).fill(`Semanal ${tag}`);
await t.getByLabel('Abre (hora de Perú)').fill(inLima(-60 * 60000));
await t.getByLabel('Cierra (hora de Perú)').fill(inLima(-90 * 60000));
await t.getByRole('button', { name: 'Crear evaluación' }).click();
check('un cierre antes de la apertura se avisa', await t.getByText('El cierre debe ser posterior a la apertura.').isVisible());
await t.getByLabel('Cierra (hora de Perú)').fill(inLima(2 * 24 * 60 * 60000));

await t.getByRole('button', { name: '+ Opción múltiple' }).click();
await t.getByRole('button', { name: '+ Respuesta numérica' }).click();
await t.getByRole('button', { name: 'Crear evaluación' }).click();
check('cada pregunta avisa lo que le falta (competencia, enunciado)', (await vis(t.getByText('Elige la competencia que mide.')).count()) >= 1);
const cards = t.locator('section[aria-label^="Ejercicio"]');
await cards.nth(0).getByLabel('Competencia que mide').selectOption('calculo');
await cards.nth(0).getByRole('textbox', { name: 'Enunciado' }).fill('¿Cuánto es 1/2 + 1/4?');
await cards.nth(0).getByRole('textbox', { name: 'Opción 1' }).fill('3/4');
await cards.nth(0).getByRole('textbox', { name: 'Opción 2' }).fill('2/6');
await cards.nth(0).getByLabel('La opción 1 es la correcta').check();
await cards.nth(0).getByRole('textbox', { name: /Explicación/ }).fill(`Común denominador ${tag}`);
await cards.nth(1).getByLabel('Competencia que mide').selectOption('problemas');
await cards.nth(1).getByRole('textbox', { name: 'Enunciado' }).fill('¿Cuánto es 7 ÷ 2?');
await cards.nth(1).getByLabel('Número correcto').fill('3,5');
await t.getByLabel(/Publicada/).check();
check('el formulario no se desborda en el celular', await noHorizontalScroll(t));
await t.getByRole('button', { name: 'Crear evaluación' }).click();
await t.waitForURL(/\/profesor\/evaluaciones\/[0-9a-f-]{36}/);
const evaluationId = t.url().match(/evaluaciones\/([0-9a-f-]{36})/)[1];
await t.getByText('Evaluación creada').waitFor({ timeout: 10000 });
const created = {
  banner: await t.getByText('Evaluación creada').isVisible(),
  cards: await vis(cards).count(),
  published: await vis(t.getByLabel(/Publicada/)).first().isChecked(),
};
check('se crea y lleva a la evaluación, publicada y con sus 2 preguntas', created.banner && created.cards === 2 && created.published, created);

// ─── Ana la rinde ──────────────────────────────────────────────────────
const anaLogin = await submitLogin({ username: ana.loginIdentifier, password: ana.initialPassword });
const studentContext = await browser.newContext(phone);
await studentContext.addCookies(cookiesFor(anaLogin.cookies));
const s = await studentContext.newPage();
s.on('pageerror', (e) => errors.push(e.message));
await s.goto(`${base}/evaluaciones`, { waitUntil: 'networkidle' });
check('la alumna ve la evaluación publicada, por rendir', await vis(s.getByText(`Semanal ${tag}`)).first().isVisible() && await vis(s.getByRole('button', { name: 'Rendir ahora' })).first().isVisible());
await vis(s.getByRole('button', { name: 'Rendir ahora' })).first().click();
const quiz = s.locator('form[aria-labelledby="quiz-title"]');
await quiz.waitFor({ timeout: 10000 });
check('el examen trae las 2 preguntas y el reloj, sin la respuesta ni la explicación', (await quiz.locator('fieldset').count()) === 2 && await quiz.getByRole('timer').isVisible()
  && !(await s.content()).includes(`Común denominador ${tag}`));
await quiz.getByLabel('3/4').check();
await quiz.getByLabel('Respuesta 2').fill('4');
await quiz.getByRole('button', { name: 'Enviar y calificar' }).click();
await waitForText(quiz, (text) => text.includes('de 20 puntos'));
const resultText = await quiz.innerText();
check('el backend corrige: 1 de 2 → 10 de 20 puntos y 50 %', resultText.includes('1 de 2 correctas') && resultText.includes('10 de 20 puntos') && resultText.includes('50 %'), resultText);
check('muestra el resultado por competencia y la explicación', resultText.includes('Cálculo y operaciones') && resultText.includes('Resolución de problemas') && resultText.includes(`Común denominador ${tag}`));
check('el examen no se desborda en el celular', await noHorizontalScroll(s));

await s.reload({ waitUntil: 'networkidle' });
check('al volver, queda calificada y ya no se puede rendir de nuevo', await vis(s.getByText('50 %')).first().isVisible() && (await vis(s.getByRole('button', { name: 'Rendir ahora' })).count()) === 0);

// ─── La profesora ve los resultados ────────────────────────────────────
const results = await get(`/profesor/evaluaciones/${evaluationId}/resultados`, teacherLogin.cookies);
check('resultados del profesor: Ana con 10 / 20 y la competencia', results.status === 200 && results.html.includes('Ana') && results.html.includes('10 / 20')
  && results.html.includes('Cálculo y operaciones') && results.html.includes('Resolución de problemas'), results.status);
await t.goto(`${base}/profesor/grupos/${offering.id}`, { waitUntil: 'networkidle' });
check('en el grupo: la evaluación cuenta 1 de 1 alumno que la envió', await t.getByText(/1 de 1 alumno la envió/).isVisible());

// ─── Ya empezó: no se cambian las preguntas ────────────────────────────
await t.goto(`${base}/profesor/evaluaciones/${evaluationId}`, { waitUntil: 'networkidle' });
check('con una alumna que ya la rindió, las preguntas quedan bloqueadas', await t.getByText('las preguntas no se pueden cambiar').isVisible()
  && await t.getByRole('button', { name: '+ Opción múltiple' }).count() === 0);
await t.getByRole('textbox', { name: 'Título' }).fill(`Semanal ${tag} ampliada`);
await t.getByRole('button', { name: 'Guardar cambios' }).click();
await waitForText(t.locator('body'), (text) => text.includes('Evaluación guardada'));
check('pero sí se puede corregir el título', true);

// ─── Otro profesor ─────────────────────────────────────────────────────
const otherLogin = await submitLogin({ email: other.teacher.loginIdentifier, password: other.teacher.initialPassword });
const foreign = await get(`/profesor/evaluaciones/${evaluationId}`, otherLogin.cookies);
const foreignResults = await get(`/profesor/evaluaciones/${evaluationId}/resultados`, otherLogin.cookies);
const notFound = (page) => (page.status === 404 || page.html.includes('NEXT_HTTP_ERROR_FALLBACK;404')) && !page.html.includes(`Semanal ${tag}`);
check('otro profesor: la evaluación y sus resultados → «no encontrado», sin datos', notFound(foreign) && notFound(foreignResults));
const foreignGroup = await get(`/profesor/grupos/${offering.id}/evaluaciones/nueva`, otherLogin.cookies);
check('otro profesor: crear en un grupo ajeno → «no encontrado»', notFound(foreignGroup));

check('sin errores de JavaScript en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
finish();
