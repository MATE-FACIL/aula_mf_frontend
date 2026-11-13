// Consentimiento del padre para los datos del menor (SCRUM-38) contra la API real en Docker, con login real por
// formulario: la madre ve el aviso en su panel, lee el texto, marca la declaración y acepta por sus dos hijos desde
// el celular; el administrador ve en la ficha de cada alumno cómo va; y cada padre solo ve lo suyo.
import { join } from 'node:path';
import { base, check, finish, getPage as get, launch, noHorizontalScroll, output, realApi, submitLogin, waitForText } from '../lib.mjs';

const { adminToken, call } = realApi();
const tag = Date.now().toString().slice(-6);
const errors = [];
let seq = 0;
const guardian = (name) => call('POST', '/admin/guardians', { givenNames: name, firstSurname: `Consent${tag}`, email: `${name.toLowerCase()}.consent.${tag}@example.com` });
const student = (name, surname, guardianUserId) => call('POST', '/admin/students', {
  givenNames: name, firstSurname: `${surname}${tag}`, documentType: 'DNI', documentNumber: `6${tag}${seq++}`, ...(guardianUserId && { guardianUserId }),
});

const mom = await guardian('Rosa');
const dad = await guardian('Luis');
const empty = await guardian('Sin');
const ana = await student('Ana', 'Hija', mom.userId);
await student('Beto', 'Hijo', mom.userId);
const pend = await student('Pepe', 'Hijo', dad.userId);   // de otro padre, que todavía no aceptó
const solo = await student('Solo', 'Alumno');             // sin padre vinculado
await call('PUT', `/admin/guardians/${dad.userId}/students/${ana.userId}`);

const login = (who) => submitLogin({ email: who.loginIdentifier, password: who.initialPassword });
const momLogin = await login(mom);
const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));

// ─── El panel avisa antes de aceptar ─────────────────────────────────
let page = await get('/familia', momLogin.cookies);
check('el panel de la madre avisa que falta aceptar, con el nombre de sus dos hijos', page.status === 200 && page.html.includes('Falta tu aceptación') &&
  page.html.includes(`Ana Hija${tag} y Beto Hijo${tag}`) && page.html.includes('href="/familia/consentimiento"'), page.status);
check('el aviso no menciona a hijos de otras familias', !page.html.includes(`Pepe Hijo${tag}`));
page = await get('/familia/consentimiento', momLogin.cookies);
check('la pantalla muestra el texto vigente sin respuestas ni datos de otros', page.status === 200 && page.html.includes('Términos de uso y política de privacidad') &&
  page.html.includes('Falta tu aceptación') && !page.html.includes(`Pepe Hijo${tag}`), page.status);

// ─── La madre lee y acepta desde el celular ──────────────────────────
const browser = await launch();
try {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-PE' });
  await phone.addCookies(cookiesFor(momLogin.cookies));
  const m = await phone.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  m.on('console', (c) => { if (c.type() === 'error' && !c.text().includes('favicon')) errors.push(c.text()); });
  m.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  await m.goto(`${base}/familia`, { waitUntil: 'networkidle' });
  const banner = m.getByRole('complementary', { name: 'Consentimiento pendiente' });
  await banner.waitFor({ timeout: 10000 });
  await m.screenshot({ path: join(output, 'real-consentimiento-aviso-celular.png') });
  await m.getByRole('link', { name: 'Leer y aceptar' }).click();
  await m.waitForURL(/\/familia\/consentimiento$/);
  const consent = m.locator('article[aria-labelledby="consent-title"]');
  await consent.waitFor({ timeout: 10000 });
  check('se lee el texto con sus secciones', (await consent.locator('h3').count()) >= 4);
  check('los dos hijos aparecen con «Falta tu aceptación»', (await consent.getByText('Falta tu aceptación').count()) === 2);
  const accept = m.getByRole('button', { name: /^Aceptar por/ });
  check('«Aceptar» está apagado hasta marcar la declaración', await accept.isDisabled());
  check('el botón dice por quién se acepta', (await accept.innerText()) === 'Aceptar por Ana y Beto', await accept.innerText());
  await m.getByRole('checkbox').check();
  check('marcada la declaración, se puede aceptar', await accept.isEnabled());
  await m.screenshot({ path: join(output, 'real-consentimiento-celular.png'), fullPage: true });
  check('la pantalla de aceptar no se desborda en el celular', await noHorizontalScroll(m));
  await accept.click();
  await waitForText(consent, (t) => t.includes('Quedó registrada tu aceptación'), 12000);
  const done = await consent.innerText();
  check('queda aceptado por los dos hijos, con fecha y quién', (done.match(/Aceptado el/g) ?? []).length === 2 && done.includes(`por Rosa Consent${tag}`), done.slice(-300));
  await m.screenshot({ path: join(output, 'real-consentimiento-aceptado-celular.png'), fullPage: true });
  await m.getByRole('link', { name: 'Volver al panel de la familia' }).click();
  await m.waitForURL(/\/familia$/);
  await m.getByRole('tab').first().waitFor({ timeout: 10000 });
  check('el aviso desaparece del panel', (await m.getByRole('complementary', { name: 'Consentimiento pendiente' }).count()) === 0);
  await phone.close();

  // ─── Lo que quedó guardado ─────────────────────────────────────────
  const anaDetail = await call('GET', `/admin/users/${ana.userId}`);
  check('el backend guardó la aceptación de Ana con su fecha y quién', anaDetail.consent.status === 'accepted' && !!anaDetail.consent.acceptedAt &&
    anaDetail.consent.acceptedByName === `Rosa Consent${tag}`, anaDetail.consent);

  // ─── El administrador ve cómo va cada alumno ───────────────────────
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-PE' });
  await desktop.addCookies([{ name: 'mf_session', value: adminToken, url: base }, { name: 'mf_role', value: 'admin', url: base }]);
  const a = await desktop.newPage();
  a.on('pageerror', (e) => errors.push(e.message));
  const heading = () => a.getByRole('heading', { name: 'Consentimiento de los datos' });
  const section = () => a.locator('div.section').filter({ has: heading() });
  await a.goto(`${base}/admin/usuarios/${ana.userId}`, { waitUntil: 'networkidle' });
  await heading().waitFor({ timeout: 10000 });
  let text = await section().innerText();
  check('ficha de Ana: Aceptado, cuándo, por quién y la versión', text.includes('Aceptado') && text.includes(`por Rosa Consent${tag}`) && text.includes('versión'), text);
  check('ficha de Ana: avisa que el texto es provisional mientras lo sea', text.includes('provisional') === anaDetail.consent.isProvisional, text);
  await a.screenshot({ path: join(output, 'real-consentimiento-ficha-escritorio.png'), fullPage: true });
  await a.goto(`${base}/admin/usuarios/${pend.userId}`, { waitUntil: 'networkidle' });
  await heading().waitFor({ timeout: 10000 });
  text = await section().innerText();
  check('ficha de Pepe (su padre no aceptó): Pendiente', text.includes('Pendiente') && text.includes('Ningún padre vinculado aceptó'), text);
  await a.goto(`${base}/admin/usuarios/${solo.userId}`, { waitUntil: 'networkidle' });
  await heading().waitFor({ timeout: 10000 });
  text = await section().innerText();
  check('ficha de un alumno sin padre: Sin padre vinculado', text.includes('Sin padre vinculado') && text.includes('Vincula a un padre'), text);
  await a.goto(`${base}/admin/usuarios/${mom.userId}`, { waitUntil: 'networkidle' });
  await a.getByRole('heading', { name: 'Hijos vinculados' }).waitFor({ timeout: 10000 });
  check('ficha de un padre: no muestra consentimiento', (await heading().count()) === 0);
  check('ficha del alumno sin desborde en escritorio', await noHorizontalScroll(a));
  await desktop.close();
} finally {
  await browser.close();
}

// ─── Cada padre ve solo lo suyo ──────────────────────────────────────
const dadLogin = await login(dad);
page = await get('/familia', dadLogin.cookies);
check('el otro padre: Ana ya está aceptada (basta con un padre), falta solo su hijo Pepe', page.html.includes('Falta tu aceptación') &&
  page.html.includes(`Pepe Hijo${tag}`) && !page.html.includes(`Para Ana Hija${tag}`), page.status);
page = await get('/familia/consentimiento', dadLogin.cookies);
check('y en la pantalla ve a Ana aceptada por la madre y a Pepe pendiente', page.html.includes(`por Rosa Consent${tag}`) && page.html.includes('Falta tu aceptación'), page.status);
const noKids = await login(empty);
page = await get('/familia/consentimiento', noKids.cookies);
check('un padre sin hijos ve un mensaje claro', page.html.includes('Todavía no hay hijos vinculados'), page.status);
const soloLogin = await submitLogin({ username: solo.loginIdentifier, password: solo.initialPassword });
page = await get('/familia/consentimiento', soloLogin.cookies);
check('un alumno no entra a la pantalla de la familia', [303, 307].includes(page.status) && !page.html.includes('Términos de uso'), [page.status, page.location]);
page = await get('/familia/consentimiento', {});
check('sin sesión se pide ingresar', [303, 307].includes(page.status) && /ingreso/.test(page.location ?? ''), [page.status, page.location]);

check('sin errores en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
finish();
