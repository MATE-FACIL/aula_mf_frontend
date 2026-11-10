// Asignación a grupo según el diagnóstico (SCRUM-45) contra la API real en Docker: el administrador ve qué dijo el
// diagnóstico del alumno, los grupos del nivel confirmado aparecen primero, y lo cambia de grupo con su registro y
// su tope. El banco del diagnóstico es único por etapa: se guarda el que haya y se restaura.
import { join } from 'node:path';
import { base, check, finish, launch, noHorizontalScroll, output, realApi, submitLogin, waitForText } from '../lib.mjs';

const { adminToken, call } = realApi();
const apiBase = `http://localhost:${process.env.API_PORT ?? '5087'}/api/v1`;
/** Llamada a la API con el token de otra persona (el alumno que rinde el diagnóstico). */
async function callAs(token, method, path, payload) {
  const res = await fetch(apiBase + path, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(payload !== undefined && { 'Content-Type': 'application/json' }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

const tag = Date.now().toString().slice(-6);
const STAGE = 'primary';
const errors = [];
const levels = (await call('POST', '/math-levels/provision')).levels;
const course = (stage, level) => levels.find((l) => l.stage === stage && l.level === level).courseId;
const teacher = await call('POST', '/admin/instructors', { givenNames: 'Lucía', firstSurname: `Asigna${tag}`, email: `asigna.${tag}@example.com` });
const at = (days) => new Date(Date.now() + days * 864e5).toISOString();
async function group(courseId, name, capacity) {
  const created = await call('POST', `/courses/${courseId}/offerings`, {
    name: `${name} ${tag}`, maximumCapacity: capacity, basePrice: 180, currencyCode: 'PEN', plannedSessionCount: 1,
    sessions: [{ id: null, startsAt: at(5), endsAt: at(5.06), virtualLink: null }],
  });
  await call('PUT', `/courses/${courseId}/offerings/${created.id}/instructors`, { instructorIds: [teacher.instructorId] });
  await call('POST', `/courses/${courseId}/offerings/${created.id}/publish`);
  return created.id;
}
const A = await group(course('primary', 'prebasic'), 'Grupo A', 8);
const B = await group(course('primary', 'basic'), 'Grupo B', 8);
const C = await group(course('primary', 'basic'), 'Grupo C', 1);
const student = (name, doc) => call('POST', '/admin/students', { givenNames: name, firstSurname: `Asigna${tag}`, documentType: 'DNI', documentNumber: doc });
const ana = await student('Ana', `9${tag}1`);
const luis = await student('Luis', `9${tag}2`);
await call('POST', '/enrollments', { studentUserId: ana.userId, courseOfferingId: A });
await call('POST', '/enrollments', { studentUserId: luis.userId, courseOfferingId: C });

const before = await call('GET', `/diagnostics/questions/${STAGE}`);
const browser = await launch();
try {
  // El alumno rinde el diagnóstico: Prebásico bien, Básico mal → el sistema sugiere Básico
  const q = (level, topic, prompt) => ({ level, topic, prompt, kind: 'multiple_choice', options: ['Sí', 'No'], correctOption: 0 });
  await call('PUT', `/diagnostics/questions/${STAGE}`, { questions: [
    q('prebasic', `Conteo ${tag}`, '¿5 es mayor que 3?'), q('prebasic', `Conteo ${tag}`, '¿10 es par?'),
    q('basic', `Fracciones ${tag}`, '¿1/2 es igual a 2/4?'), q('basic', `Fracciones ${tag}`, '¿1/3 es mayor que 1/2?'),
  ] });
  const login = await submitLogin({ username: ana.loginIdentifier, password: ana.initialPassword });
  const studentToken = login.cookies.mf_session;
  const attempt = await callAs(studentToken, 'POST', '/students/me/diagnostics', { stage: STAGE });
  for (const [i, question] of attempt.questions.entries()) {
    await callAs(studentToken, 'POST', `/students/me/diagnostics/${attempt.attemptId}/answers`, { questionId: question.id, answer: i < 2 ? '0' : '1' });
  }

  const cookiesFor = [{ name: 'mf_session', value: adminToken, url: base }, { name: 'mf_role', value: 'admin', url: base }];
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-PE' });
  await desktop.addCookies(cookiesFor);
  const p = await desktop.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  const section = () => p.locator('main');

  // ─── Antes de confirmar ──────────────────────────────────────────
  await p.goto(`${base}/admin/usuarios/${ana.userId}`, { waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: 'Ubicación según el diagnóstico' }).waitFor({ timeout: 10000 });
  let text = await section().innerText();
  check('terminado sin confirmar: muestra el nivel sugerido y pide confirmarlo', text.includes('Nivel sugerido: Básico') && text.includes('Falta que el profesor confirme'), text.slice(0, 300));
  check('ofrece revisar y confirmar el diagnóstico', await p.getByRole('link', { name: 'Revisar y confirmar' }).getAttribute('href') === `/admin/diagnosticos/${attempt.attemptId}`);
  check('sin nivel confirmado no hay grupos recomendados', await p.locator('optgroup[label^="Recomendados"]').count() === 0);

  // ─── El profesor confirma Básico ─────────────────────────────────
  await call('POST', `/diagnostics/${attempt.attemptId}/confirm`, { level: 'basic' });
  await p.reload({ waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: 'Ubicación según el diagnóstico' }).waitFor({ timeout: 10000 });
  text = await section().innerText();
  check('confirmado: muestra el nivel y qué grupos salen primero', text.includes('Nivel confirmado: Básico') && text.includes('Primaria · Básico salen primero'), text.slice(0, 300));
  const recommended = await p.locator('form select[name="courseOfferingId"]').first().locator('optgroup[label^="Recomendados"] option').allInnerTexts();
  check('al matricular, los grupos de primaria Básico van primero con su cupo', recommended.some((o) => o.includes(`Grupo B ${tag}`) && o.includes('0 de 8')) &&
    !recommended.some((o) => o.includes(`Grupo A ${tag}`)), recommended);
  const fullOption = p.locator(`select[name="courseOfferingId"] option[value="${C}"]`).first();
  check('el grupo lleno aparece deshabilitado', await fullOption.evaluate((option) => option.disabled) && (await fullOption.innerText()).includes('Lleno (1 de 1)'));
  await p.screenshot({ path: join(output, 'real-asignacion-escritorio.png'), fullPage: true });

  // ─── El administrador lo pasa al grupo recomendado ───────────────
  const row = p.getByRole('row').filter({ hasText: `Grupo A ${tag}` });
  await row.locator('summary').click();
  await row.getByLabel(/Grupo de destino/).selectOption(B);
  await row.getByLabel(/Motivo del cambio/).fill('El diagnóstico confirmó Básico');
  await row.getByRole('button', { name: 'Pasar al grupo elegido' }).click();
  await waitForText(section(), (t) => t.includes('Cambios de grupo') && t.includes('El diagnóstico confirmó Básico'), 12000);
  text = await section().innerText();
  check('el cambio se aplica y se ve en el historial con su motivo', text.includes(`Grupo A ${tag} → Grupo B ${tag}`) && text.includes('El diagnóstico confirmó Básico'), text.slice(-400));
  check('la matrícula anterior dice a dónde cambió, no «retirada»', text.includes(`cambió a «Grupo B ${tag}»`), text.slice(0, 600));
  const live = await p.getByRole('row').filter({ hasText: `Grupo B ${tag}` }).filter({ hasText: 'Pendiente' }).count();
  check('en el grupo nuevo queda su matrícula pendiente', live >= 1, live);
  await p.screenshot({ path: join(output, 'real-asignacion-cambio-escritorio.png'), fullPage: true });

  // Tope: Grupo C tiene 1 cupo y lo ocupa Luis; el formulario no lo deja elegir
  const rowB = p.getByRole('row').filter({ hasText: `Grupo B ${tag}` }).filter({ hasText: 'Pendiente' }).first();
  await rowB.locator('summary').click();
  const optionC = rowB.locator(`select[name="courseOfferingId"] option[value="${C}"]`);
  check('el cambio al grupo lleno no se puede elegir', await optionC.evaluate((option) => option.disabled), await optionC.innerText());

  const seats = await call('GET', '/enrollments/offerings');
  const seatOf = (id) => seats.find((s) => s.id === id).takenSeats;
  check('el backend liberó el cupo de A y ocupó el de B', seatOf(A) === 0 && seatOf(B) === 1 && seatOf(C) === 1, [seatOf(A), seatOf(B), seatOf(C)]);
  const transfers = await call('GET', `/enrollments/transfers?studentUserId=${ana.userId}`);
  check('el backend guardó el cambio con su motivo', transfers.total === 1 && transfers.items[0].reason === 'El diagnóstico confirmó Básico' &&
    transfers.items[0].fromOfferingId === A && transfers.items[0].toOfferingId === B, transfers);
  check('ficha del alumno sin desborde en escritorio', await noHorizontalScroll(p));
  await desktop.close();

  // ─── Celular ─────────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-PE' });
  await phone.addCookies(cookiesFor);
  const m = await phone.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto(`${base}/admin/usuarios/${ana.userId}`, { waitUntil: 'networkidle' });
  await m.getByRole('heading', { name: 'Cambios de grupo' }).waitFor({ timeout: 10000 });
  const liveRow = m.getByRole('row').filter({ hasText: `Grupo B ${tag}` }).filter({ hasText: 'Pendiente' }).first();
  await liveRow.locator('summary').click();
  await liveRow.scrollIntoViewIfNeeded();
  await m.screenshot({ path: join(output, 'real-asignacion-celular.png') });
  check('ficha del alumno sin desborde en el celular', await noHorizontalScroll(m));
  await phone.close();
} finally {
  await browser.close();
  const restored = await call('PUT', `/diagnostics/questions/${STAGE}`, { questions: before });
  check('el banco de preguntas queda como estaba', restored.length === before.length, restored.length);
}

check('sin errores en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
finish();
