// Diagnóstico de entrada (SCRUM-48/49) contra la API real en Docker, con login real por formulario: el alumno lo
// rinde en el celular (una pregunta a la vez, barra de avance, «No lo sé», resultado) y el profesor revisa las
// respuestas y confirma el nivel. El banco de preguntas es único por etapa: se guarda el que haya y se restaura.
import { join } from 'node:path';
import { base, check, finish, getPage as get, launch, noHorizontalScroll, output, realApi, submitLogin, waitForText } from '../lib.mjs';

const { call } = realApi();
const tag = Date.now().toString().slice(-6);
const STAGE = 'primary';
const before = await call('GET', `/diagnostics/questions/${STAGE}`);
const errors = [];

try {
  await call('PUT', `/diagnostics/questions/${STAGE}`, {
    questions: [
      { level: 'prebasic', topic: `Operaciones ${tag}`, kind: 'numeric', prompt: '¿Cuánto es 25 + 17?', correctNumber: 42, explanation: `25 + 17 = 42 (${tag}).` },
      { level: 'prebasic', topic: `Operaciones ${tag}`, kind: 'multiple_choice', prompt: '¿Cuánto es 8 × 6?', options: ['46', '48', '54'], correctOption: 1 },
      { level: 'basic', topic: `Fracciones ${tag}`, kind: 'multiple_choice', prompt: '¿Qué fracción es mayor?', options: ['1/3', '1/2', '1/4'], correctOption: 1 },
      { level: 'basic', topic: `Fracciones ${tag}`, kind: 'numeric', prompt: '¿Cuánto es 1/2 + 1/4 en decimal?', correctNumber: 0.75 },
    ],
  });
  const student = await call('POST', '/admin/students', { givenNames: 'Ana', firstSurname: `Diagnostico${tag}`, documentType: 'DNI', documentNumber: `7${tag}1` });
  const teacher = await call('POST', '/admin/instructors', { givenNames: 'Luis', firstSurname: `Diagnostico${tag}`, email: `diag.web.${tag}@example.com` });

  // ─── Alumno ──────────────────────────────────────────────────────────
  const anaLogin = await submitLogin({ username: student.loginIdentifier, password: student.initialPassword });
  let page = await get('/ruta', anaLogin.cookies);
  check('mi ruta lleva al diagnóstico', page.status === 200 && page.html.includes('href="/diagnostico"'), page.status);
  page = await get('/diagnostico', anaLogin.cookies);
  check('diagnóstico: primaria disponible para empezar', page.status === 200 && page.html.includes('Empezar el diagnóstico'), page.status);

  const browser = await launch();
  const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await phone.addCookies(cookiesFor(anaLogin.cookies));
  const p = await phone.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${base}/diagnostico`, { waitUntil: 'networkidle' });
  await p.locator('article').filter({ hasText: 'Primaria' }).getByRole('button', { name: 'Empezar el diagnóstico' }).click();
  await p.waitForURL(/\/diagnostico\/[0-9a-f-]{36}$/);
  const attemptId = p.url().split('/').pop();
  const runner = p.locator('section[aria-labelledby="diagnostic-title"]').filter({ visible: true });
  await runner.waitFor({ timeout: 8000 });
  const html = await p.content();
  check('la prueba llega sin respuestas ni explicaciones', !html.includes(`(${tag})`) && !/correctOption|correctNumber/.test(html));
  check('empieza en 0 de 4 con su barra de avance', (await runner.locator('header p').innerText()).startsWith('0 de 4') &&
    await runner.getByRole('progressbar').count() === 1);

  const count = () => runner.locator('header p');
  await runner.getByRole('button', { name: 'Responder y seguir' }).click();
  check('sin responder: avisa y no gasta una petición', (await waitForText(runner.locator('[aria-live="polite"]').last(), (t) => t.length > 0)).includes('Escribe tu respuesta'));
  await runner.getByLabel('¿Cuánto es 25 + 17?').fill('42');
  await runner.getByRole('button', { name: 'Responder y seguir' }).click();
  check('responde sin decir si acertó: solo avanza', (await waitForText(count(), (t) => t.startsWith('1 de 4'))).startsWith('1 de 4') &&
    !(await runner.innerText()).includes('Correcto'));
  await runner.getByLabel('48').check();
  await runner.getByRole('button', { name: 'Responder y seguir' }).click();
  await waitForText(count(), (t) => t.startsWith('2 de 4'));
  await runner.getByLabel('1/3').check();
  await runner.getByRole('button', { name: 'Responder y seguir' }).click();
  await waitForText(count(), (t) => t.startsWith('3 de 4'));
  await p.screenshot({ path: join(output, 'real-diagnostico-celular.png'), fullPage: true });
  await runner.getByRole('button', { name: 'No lo sé' }).click();
  const result = p.locator('section[aria-labelledby="result-title"]').filter({ visible: true });
  const text = await waitForText(result, (t) => t.includes('Por nivel'));
  check('al terminar: nivel sugerido Básico y resultado por tema', /nivel sugerido/i.test(text) && text.includes('Básico') &&
    text.includes(`Operaciones ${tag}`) && text.includes('2 de 2 · 100 %') && text.includes(`Fracciones ${tag}`) && text.includes('0 de 2 · 0 %'), text);
  await p.screenshot({ path: join(output, 'real-diagnostico-resultado-celular.png'), fullPage: true });
  check('diagnóstico sin desborde en el celular', await noHorizontalScroll(p));
  await phone.close();

  // ─── Profesor ────────────────────────────────────────────────────────
  const teacherLogin = await submitLogin({ email: teacher.loginIdentifier, password: teacher.initialPassword });
  page = await get('/profesor/diagnosticos', teacherLogin.cookies);
  check('el profesor ve el diagnóstico por confirmar', page.status === 200 && page.html.includes(`Ana Diagnostico${tag}`) && page.html.includes('Revisar y confirmar'), page.status);
  page = await get('/diagnostico', teacherLogin.cookies);
  check('el profesor no entra a la pantalla del alumno', [303, 307].includes(page.status), page.status);
  page = await get('/profesor/diagnosticos', anaLogin.cookies);
  check('el alumno no entra a la revisión', [303, 307].includes(page.status), page.status);

  const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  await tablet.addCookies(cookiesFor(teacherLogin.cookies));
  const t = await tablet.newPage();
  t.on('pageerror', (e) => errors.push(e.message));
  await t.goto(`${base}/profesor/diagnosticos/${attemptId}`, { waitUntil: 'networkidle' });
  await t.getByRole('heading', { name: 'Respuestas' }).waitFor({ timeout: 8000 });
  const body = await t.locator('main').innerText();
  check('detalle: cada respuesta, la correcta y la explicación', body.includes('No lo sé') && body.includes('✖ 1/3') && body.includes(`25 + 17 = 42 (${tag}).`), body.slice(0, 300));
  await t.getByLabel('Nivel con el que empieza').selectOption('prebasic');
  await t.getByRole('button', { name: 'Confirmar nivel' }).click();
  await waitForText(t.locator('main'), (x) => x.includes('Nivel confirmado') && x.includes('confirmado por Luis'));
  check('tras confirmar, el selector queda en el nivel guardado', await t.getByLabel('Nivel con el que empieza').inputValue() === 'prebasic');
  const main = await t.locator('main').innerText();
  check('la vista del profesor no le habla como alumno, y usa coma decimal', !main.includes('tu profesor') && main.includes('0,75'), main.slice(0, 200));
  await t.screenshot({ path: join(output, 'real-profesor-diagnostico-tableta.png'), fullPage: true });
  check('revisión sin desborde en tableta', await noHorizontalScroll(t));
  await tablet.close();
  await browser.close();

  const saved = await call('GET', `/diagnostics/${attemptId}`);
  check('el backend guardó el nivel confirmado por el profesor', saved.summary.confirmed?.code === 'prebasic', saved.summary.confirmed);
  page = await get(`/diagnostico/${attemptId}`, anaLogin.cookies);
  check('el alumno ve el nivel confirmado', page.html.includes('Nivel confirmado por tu profesor') && page.html.includes('Prebásico'));
} finally {
  await call('PUT', `/diagnostics/questions/${STAGE}`, { questions: before });
  const restored = await call('GET', `/diagnostics/questions/${STAGE}`);
  check('el banco de preguntas queda como estaba', restored.length === before.length, restored.length);
}

check('sin errores en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
finish();
