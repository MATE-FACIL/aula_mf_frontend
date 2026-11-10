// Recorrido en el navegador contra la API real: administrador, familia y alumno, con capturas en e2e/.output.
// Con E2E_VIDEO=1 también graba cada recorrido.
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { base, check as report, finish, launch, noHorizontalScroll, output, realApi, seedCourse, settled, waitForText } from '../lib.mjs';

const videos = join(output, 'video');
mkdirSync(videos, { recursive: true });

const { adminToken: admin, call } = realApi();
const check = (group, name, ok, detail) => report(`[${group}] ${name}`, ok, detail);

// Datos ficticios, creados por la API real
const tag = Date.now().toString().slice(-5);
const DAY = 1440;
const { course, offering, session } = await seedCourse(call, tag, [5, 2 * DAY, 4 * DAY]);
const courseTitle = course.title;
const draft = await call('POST', `/courses/${course.id}/offerings`, { name: 'Grupo en preparación', maximumCapacity: 8, basePrice: 180, currencyCode: 'PEN', plannedSessionCount: 1, sessions: [session(30 * DAY)] });
const guardian = await call('POST', '/admin/guardians', { givenNames: 'Rosa', firstSurname: `Quispe ${tag}`, email: `rosa.${tag}@example.com` });
const student = (given, surname, doc, guardianUserId) => call('POST', '/admin/students', { givenNames: given, firstSurname: `${surname} ${tag}`, documentType: 'DNI', documentNumber: doc, ...(guardianUserId && { guardianUserId }) });
const ana = await student('Ana', 'Quispe', `4${tag}01`, guardian.userId);
const luis = await student('Luis', 'Quispe', `4${tag}02`, guardian.userId);
const bruno = await student('Bruno', 'Rojas', `4${tag}03`);
const carla = await student('Carla', 'Mamani', `4${tag}04`);
const enroll = (who) => call('POST', '/enrollments', { studentUserId: who.userId, courseOfferingId: offering.id });
const anaSeat = await enroll(ana);
await enroll(luis);
await enroll(bruno);
const carlaSeat = await enroll(carla);
await call('POST', `/enrollments/${anaSeat.id}/activate`, { paymentNote: 'Yape' });
await call('POST', `/enrollments/${carlaSeat.id}/activate`, { paymentNote: 'Transferencia' });

const browser = await launch(process.env.E2E_VIDEO ? { slowMo: 180 } : {});
const errors = [];
async function open({ width, height, theme, mobile = false, video, cookies = [] }) {
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile, locale: 'es-PE',
    ...(video && process.env.E2E_VIDEO && { recordVideo: { dir: videos, size: { width, height } } }),
  });
  await context.addInitScript((t) => localStorage.setItem('mf-tema', t), theme);
  if (cookies.length) await context.addCookies(cookies);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  return { context, page };
}
const shot = async (page, name, fullPage = true) => { await settled(page); await page.waitForTimeout(250); await page.screenshot({ path: join(output, `${name}.png`), fullPage }); };
const noScroll = noHorizontalScroll;
const closeSession = async ({ context, page }, name) => {
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), join(videos, `${name}.webm`));
};
const keepsPassword = (page, password) => page.evaluate((secret) => [...document.querySelectorAll('input')].some((input) => input.value === secret), password);
const adminCookies = [{ name: 'mf_session', value: admin, url: base }, { name: 'mf_role', value: 'admin', url: base }];

// ── Admin en escritorio: alumno, grupo y matrículas ─────────────────
{
  const s = await open({ width: 1280, height: 800, theme: 'claro', video: true, cookies: adminCookies });
  const { page } = s;
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  await shot(page, 'admin-01-resumen-escritorio');

  await page.goto(`${base}/admin/usuarios/nuevo`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'dd{filter:blur(7px)}' }); // las contraseñas no salen en la documentación
  await page.getByLabel('Nombres').first().fill('Zoe');
  await page.getByLabel('Primer apellido').first().fill(`Navarro ${tag}`);
  await page.getByLabel('Número de documento').first().fill(`4${tag}05`);
  await page.getByRole('button', { name: 'Crear alumno' }).click();
  await page.getByText('Cuenta creada').waitFor({ timeout: 10000 });
  check('Admin', 'Crear alumno muestra sus datos de acceso una sola vez', await page.getByText('no se volverá a mostrar').isVisible());
  await shot(page, 'admin-02-alumno-creado-escritorio');

  // Matricular: el grupo en borrador no se puede elegir
  await page.goto(`${base}/admin/usuarios/${bruno.userId}`, { waitUntil: 'networkidle' });
  await settled(page);
  // El formulario «Matricular» (la ficha también tiene un selector de destino en cada matrícula viva).
  const enrollForm = page.locator('form', { has: page.getByRole('button', { name: 'Matricular', exact: true }) });
  const draftOption = enrollForm.locator(`select[name="courseOfferingId"] option[value="${draft.id}"]`);
  check('Admin', 'Matricular: el grupo en borrador aparece deshabilitado', await draftOption.evaluate((option) => option.disabled));

  await page.goto(`${base}/admin/cursos`, { waitUntil: 'networkidle' });
  await shot(page, 'admin-03-cursos-escritorio');
  await page.getByRole('link', { name: courseTitle }).first().click();
  await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}/);
  await page.getByRole('link', { name: '+ Nuevo grupo' }).click();
  await page.waitForURL(/grupos\/nuevo/);
  await page.getByRole('button', { name: 'Generar horario' }).waitFor();
  await page.getByLabel('Nombre del grupo').fill('Grupo Mañana');
  await page.getByLabel('Precio').fill('180');
  const monday = new Date(Date.now() + 7 * 86400000);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7));
  await page.getByLabel('Primera clase desde').fill(monday.toISOString().slice(0, 10));
  await page.getByLabel('Cantidad de clases').fill('4');
  await page.getByLabel('Lun').check();
  await page.getByLabel('Mié').check();
  await page.getByRole('button', { name: 'Generar horario' }).click();
  await page.getByText('4 clases listas').waitFor({ timeout: 6000 });
  check('Admin', 'El generador arma 4 clases', await page.getByText('Clase 4').isVisible());
  await shot(page, 'admin-04-horario-generado-escritorio');
  await page.getByRole('button', { name: 'Crear grupo' }).click();
  await page.waitForURL(/grupos\/[0-9a-f-]{36}/, { timeout: 10000 });
  check('Admin', 'Crear el grupo en la API lleva a su ficha', (await page.getByRole('heading', { level: 1 }).innerText()).includes('Grupo Mañana'));
  await page.getByLabel(new RegExp(`Lucía Paredes ${tag}`)).check();
  await page.getByRole('button', { name: 'Guardar profesores' }).click();
  await page.getByText('Profesores asignados.').waitFor({ timeout: 10000 });
  check('Admin', 'Asignar profesor muestra el aviso', true);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Publicar grupo' }).click();
  await page.getByText('Grupo publicado').waitFor({ timeout: 10000 });
  check('Admin', 'Publicar muestra el aviso aunque el botón desaparezca', true);
  await page.getByRole('heading', { name: 'Clases (4)' }).waitFor({ timeout: 10000 });
  await shot(page, 'admin-05-grupo-publicado-escritorio');

  await page.goto(`${base}/admin/matriculas`, { waitUntil: 'networkidle' });
  await shot(page, 'admin-06-matriculas-escritorio', false);
  const row = page.getByRole('row').filter({ hasText: `Bruno Rojas ${tag}` });
  await row.getByRole('button', { name: 'Confirmar pago y activar' }).click();
  await page.getByText('Matrícula activada.').waitFor({ timeout: 10000 });
  await row.getByRole('button', { name: 'Confirmar pago y activar' }).waitFor({ state: 'detached', timeout: 10000 });
  check('Admin', 'Activar matrícula actualiza la fila', true);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('row').filter({ hasText: `Carla Mamani ${tag}` }).getByRole('button', { name: 'Retirar' }).click();
  await page.getByText('el cupo quedó libre').waitFor({ timeout: 10000 });
  check('Admin', 'Retirar matrícula libera el cupo', true);

  // Asistencia de la clase de hoy (empieza en 5 min: ya está abierta). Ana asistió, Bruno llegó tarde.
  await page.goto(`${base}/admin/cursos/${course.id}/grupos/${offering.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Asistencia', exact: true }).first().click();
  await page.getByRole('heading', { name: /Asistencia · clase 1/ }).waitFor({ timeout: 10000 });
  await page.getByRole('group', { name: new RegExp(`Ana Quispe ${tag}`) }).getByLabel('Asistió').check();
  await page.getByRole('group', { name: new RegExp(`Bruno Rojas ${tag}`) }).getByLabel('Tarde').check();
  await page.getByLabel(new RegExp(`Nota sobre Bruno Rojas ${tag}`)).fill('Entró 10 min tarde');
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  await page.getByText('Asistencia guardada (2 alumnos).').waitFor({ timeout: 10000 });
  const summary = await waitForText(page.getByLabel('Resumen de la clase'), (text) => /Asistió\s*1/.test(text) && /Tarde\s*1/.test(text));
  check('Admin', 'Asistencia: se guarda la lista y el resumen la cuenta', /Asistió\s*1/.test(summary) && /Tarde\s*1/.test(summary), summary);
  await shot(page, 'admin-08-asistencia-escritorio');

  // Niveles de Matemáticas (SCRUM-39): si faltan se crean; en cualquier caso quedan los 8 con sus sesiones.
  await page.goto(`${base}/admin/cursos/niveles`, { waitUntil: 'networkidle' });
  await settled(page);
  const provision = page.getByRole('button', { name: 'Crear los niveles que faltan' });
  if (await provision.isVisible()) {
    await provision.click();
    await page.getByText(/Se crearon \d+ nivel/).waitFor({ timeout: 10000 });
  }
  const levelsText = await waitForText(page.getByRole('main'), (text) => (text.match(/\d+ sesiones ·/g) ?? []).length === 8);
  check('Admin', 'Niveles: los 8 existen, cada uno con sus sesiones', (levelsText.match(/\d+ sesiones ·/g) ?? []).length === 8, levelsText.slice(0, 200));
  await shot(page, 'admin-10-niveles-escritorio');
  await closeSession(s, 'admin-escritorio');
}

// ── Admin en celular y modo oscuro ──────────────────────────────────
{
  const s = await open({ width: 390, height: 844, theme: 'oscuro', mobile: true, video: true, cookies: adminCookies });
  const { page } = s;
  for (const [path, name] of [['/admin', 'resumen'], ['/admin/usuarios', 'usuarios'], ['/admin/cursos', 'cursos'], ['/admin/matriculas', 'matriculas']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    check('Admin celular', `${path} sin desborde horizontal`, await noScroll(page));
    if (path === '/admin/matriculas') await page.getByRole('heading', { name: /Cupos por grupo/ }).scrollIntoViewIfNeeded();
    await shot(page, `admin-07-${name}-celular-oscuro`, false);
  }
  await page.goto(`${base}/admin/cursos`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: courseTitle }).first().click();
  await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}/);
  await page.waitForLoadState('networkidle');
  check('Admin celular', 'Ficha del curso sin desborde horizontal', await noScroll(page));
  await page.goto(`${base}/admin/cursos/niveles`, { waitUntil: 'networkidle' });
  check('Admin celular', 'Niveles sin desborde horizontal', await noScroll(page));
  await shot(page, 'admin-11-niveles-celular-oscuro', false);
  await page.goto(`${base}/admin/cursos/${course.id}/grupos/${offering.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Asistencia', exact: true }).first().click();
  await page.getByRole('heading', { name: /Asistencia · clase 1/ }).waitFor({ timeout: 10000 });
  check('Admin celular', 'Asistencia sin desborde horizontal', await noScroll(page));
  await shot(page, 'admin-09-asistencia-celular-oscuro');
  await closeSession(s, 'admin-celular');
}

// ── Familia: login real ─────────────────────────────────────────────
{
  const s = await open({ width: 1280, height: 800, theme: 'claro', video: true });
  const { page } = s;
  await page.goto(`${base}/ingreso`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Soy familia' }).click();
  await shot(page, 'familia-01-ingreso-escritorio');
  const form = page.locator('form:visible').filter({ has: page.locator('input[name=email]') });
  await form.locator('input[name=email]').fill(guardian.loginIdentifier);
  await form.locator('input[name=password]').fill(guardian.initialPassword);
  await form.getByRole('button', { name: /entrar|ingresar/i }).click();
  await page.waitForURL(/\/familia/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await settled(page);
  const text = () => page.locator('#contenido').innerText();
  check('Familia', 'Login real con rol familia lleva a /familia', true);
  check('Familia', 'La contraseña no queda escrita en la página oculta', !(await keepsPassword(page, guardian.initialPassword)));
  check('Familia', 'Se ve a la hija con su curso y profesora reales', (await text()).includes(courseTitle) && (await text()).includes(`Lucía Paredes ${tag}`));
  check('Familia', 'No aparecen datos de ejemplo', !/Valentina|Mateo/.test(await text()));
  check('Familia', 'Ve la asistencia real de su hija', (await text()).includes('1 de 1 clases'));
  await shot(page, 'familia-02-hija-activa-escritorio');
  const other = page.getByRole('tab', { name: /Luis/ }).or(page.getByRole('button', { name: /Luis/ })).or(page.getByRole('link', { name: /Luis/ })).first();
  await other.click();
  await page.waitForLoadState('networkidle');
  await page.getByText('Pendiente de pago').first().waitFor({ timeout: 8000 });
  check('Familia', 'Cambiar de hijo muestra su matrícula pendiente', true);
  await shot(page, 'familia-03-hijo-pendiente-escritorio');
  const cookies = await s.context.cookies();
  await closeSession(s, 'familia-escritorio');

  for (const [width, height, theme, mobile, name] of [[390, 844, 'oscuro', true, 'celular-oscuro'], [768, 1024, 'oscuro', true, 'tablet-oscuro'], [390, 844, 'claro', true, 'celular-claro']]) {
    const v = await open({ width, height, theme, mobile, cookies });
    await v.page.goto(`${base}/familia`, { waitUntil: 'networkidle' });
    check('Familia', `${name} sin desborde horizontal`, await noScroll(v.page));
    await shot(v.page, `familia-04-${name}`);
    await closeSession(v, name);
  }
}

// ── Alumno: login real y clase con enlace ───────────────────────────
{
  const s = await open({ width: 390, height: 844, theme: 'oscuro', mobile: true, video: true });
  const { page } = s;
  await page.goto(`${base}/ingreso`, { waitUntil: 'networkidle' });
  const form = page.locator('form:visible').filter({ has: page.locator('input[name=username]') });
  await form.locator('input[name=username]').fill(ana.loginIdentifier);
  await form.locator('input[name=password]').fill(ana.initialPassword);
  await form.getByRole('button', { name: /entrar|ingresar/i }).click();
  await page.waitForURL(/\/inicio/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  check('Alumno', 'Login real lleva a /inicio', true);
  check('Alumno', 'La contraseña no queda escrita en la página oculta', !(await keepsPassword(page, ana.initialPassword)));
  await shot(page, 'alumno-01-inicio-celular-oscuro', false);
  await page.goto(`${base}/clases`, { waitUntil: 'networkidle' });
  await settled(page);
  const html = await page.locator('#contenido').innerText();
  check('Alumno', '/clases muestra el curso real', html.includes(courseTitle));
  check('Alumno', 'La clase próxima ofrece «Entrar» con su enlace', await page.locator('a[href="https://meet.example.com/geometria"]').first().isVisible());
  check('Alumno', '/clases sin desborde horizontal', await noScroll(page));
  check('Alumno', '/clases muestra su asistencia real', (await page.locator('#contenido').innerText()).includes('1 de 1 clases'));
  await page.locator('a[href="https://meet.example.com/geometria"]').first().scrollIntoViewIfNeeded();
  await shot(page, 'alumno-02-clases-celular-oscuro', false);
  await closeSession(s, 'alumno-celular');
}

check('General', 'Sin errores de consola ni respuestas 5xx', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
finish();
