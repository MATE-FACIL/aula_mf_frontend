// Flujos reales en el navegador con datos mock, en celular y modo oscuro.
import { join } from 'node:path';
import { base, check, finish, launch, mockToken, noHorizontalScroll, output, waitForText } from '../lib.mjs';

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await context.addCookies([{ name: 'mf_session', value: mockToken('adm-equipo', 'admin'), url: base }, { name: 'mf_role', value: 'admin', url: base }]);
await context.addInitScript(() => { if (!localStorage.getItem('mf-tema')) localStorage.setItem('mf-tema', 'oscuro'); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
const shot = (name) => page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
const noScroll = () => noHorizontalScroll(page);
const tag = Date.now().toString().slice(-6);

// 1) Crear alumno: credenciales visibles y copiar
await page.goto(`${base}/admin/usuarios/nuevo`, { waitUntil: 'networkidle' });
await page.getByLabel('Nombres').first().fill('Zoe');
await page.getByLabel('Primer apellido').first().fill('Navegador');
await page.getByLabel('Número de documento').first().fill(`7${tag}1`);
await page.getByRole('button', { name: 'Crear alumno' }).click();
await page.getByText('Cuenta creada').waitFor({ timeout: 8000 });
const creds = await page.getByRole('status').filter({ hasText: 'Cuenta creada' }).innerText();
check('crear alumno muestra usuario y contraseña', creds.includes(`N7${tag}1`) && creds.includes('Contraseña'), creds);
await shot('credenciales-oscuro');
const cardContrast = await page.evaluate(() => {
  const el = [...document.querySelectorAll('b')].find((b) => b.textContent.includes('Cuenta creada'));
  return getComputedStyle(el).color;
});
check('credenciales legibles en oscuro (texto claro)', /rgb\(2[0-9]{2}/.test(cardContrast), cardContrast);

// 2) Validación por campo sin salir de la página
await page.goto(`${base}/admin/usuarios/nuevo`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Crear alumno' }).click();
await page.getByText('Escribe los nombres.').waitFor({ timeout: 8000 });
check('errores por campo en el formulario', await page.getByText('Escribe los nombres.').isVisible());

// 3) Crear un grupo con el generador de horario
await page.goto(`${base}/admin/cursos`, { waitUntil: 'networkidle' });
await page.getByRole('link', { name: /Secundaria Intermedio/ }).first().click();
await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}/);
await page.getByRole('link', { name: '+ Nuevo grupo' }).click();
await page.waitForURL(/grupos\/nuevo/);
await page.getByRole('button', { name: 'Generar horario' }).waitFor();
await page.getByLabel('Nombre del grupo').fill(`Grupo Nav ${tag}`);
await page.getByLabel('Precio').fill('180');
await page.getByLabel('Primera clase desde').fill('2026-11-16');
await page.getByLabel('Cantidad de clases').fill('4');
await page.getByLabel('Lun').check();
await page.getByLabel('Mié').check();
await page.getByRole('button', { name: 'Generar horario' }).click();
await page.getByText('4 clases listas').waitFor({ timeout: 5000 });
check('el generador arma 4 clases en el navegador', await page.getByText('Clase 4').isVisible());
await shot('horario-generado-oscuro');
check('sin desborde con el horario generado', await noScroll());
await page.getByRole('button', { name: 'Crear grupo' }).click();
await page.waitForURL(/grupos\/[0-9a-f-]{36}/, { timeout: 8000 });
check('crear grupo lleva a su ficha', (await page.getByRole('heading', { level: 1 }).innerText()).includes(`Grupo Nav ${tag}`));

// 4) Asignar profesor y publicar
await page.getByLabel('Lucía Paredes').check();
await page.getByRole('button', { name: 'Guardar profesores' }).click();
await page.getByText('Profesores asignados.').waitFor({ timeout: 8000 });
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'Publicar grupo' }).click();
await page.getByText('Grupo publicado').waitFor({ timeout: 8000 });
await page.getByRole('heading', { name: 'Clases (4)' }).waitFor({ timeout: 8000 });
check('publicar: el grupo pasa a solo enlaces', await page.getByRole('button', { name: 'Guardar', exact: true }).first().isVisible() && !(await page.getByRole('button', { name: /generar horario/i }).isVisible()));
await shot('grupo-publicado-oscuro');
check('sin desborde en grupo publicado', await noScroll());

// 4b) Asistencia (SCRUM-53): la clase pasada del Grupo A se marca; una futura sigue cerrada
await page.goto(`${base}/admin/cursos`, { waitUntil: 'networkidle' });
await page.getByRole('link', { name: /Secundaria Intermedio/ }).first().click();
await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}$/);
await page.getByRole('link', { name: /Grupo A/ }).first().click();
await page.waitForURL(/grupos\/[0-9a-f-]{36}$/);
const attendanceLinks = page.getByRole('link', { name: 'Asistencia', exact: true });
await attendanceLinks.nth(1).click();
await page.getByText('La asistencia se abre a las').waitFor({ timeout: 8000 });
check('asistencia: una clase futura todavía está cerrada', true);
await page.goBack({ waitUntil: 'networkidle' });
await page.getByRole('link', { name: 'Asistencia', exact: true }).first().click();
await page.getByRole('heading', { name: /Asistencia · clase 1/ }).waitFor({ timeout: 8000 });
await page.getByRole('group', { name: /Valentina/ }).getByLabel('Tarde').check();
await page.getByRole('button', { name: 'Guardar asistencia' }).click();
await page.getByText('Asistencia guardada').waitFor({ timeout: 8000 });
check('asistencia: el equipo marca la clase pasada', await page.getByRole('group', { name: /Valentina/ }).getByLabel('Tarde').isChecked());
const attendanceSummary = await waitForText(page.getByLabel('Resumen de la clase'), (text) => /Tarde\s*1/.test(text));
check('asistencia: el resumen cuenta la marca', /Tarde\s*1/.test(attendanceSummary), attendanceSummary);
check('sin desborde en la asistencia', await noScroll());
await shot('asistencia-oscuro');

// 4c) Niveles de Matemáticas (SCRUM-39): crear los que faltan, una sola vez
await page.goto(`${base}/admin/cursos`, { waitUntil: 'networkidle' });
await page.getByRole('link', { name: 'Niveles de Matemáticas' }).click();
await page.waitForURL(/\/admin\/cursos\/niveles$/);
await page.getByRole('button', { name: 'Crear los niveles que faltan' }).click();
await page.getByText('Se crearon 8 niveles').waitFor({ timeout: 8000 });
const levelLinks = await waitForText(page.getByRole('main'), (text) => (text.match(/14 sesiones ·/g) ?? []).length === 8);
check('niveles: se crean los 8 con sus 14 sesiones', (levelLinks.match(/14 sesiones ·/g) ?? []).length === 8, levelLinks.slice(0, 200));
check('niveles: ya no se ofrece crearlos otra vez', !(await page.getByRole('button', { name: 'Crear los niveles que faltan' }).isVisible()));
check('sin desborde en niveles', await noScroll());
await shot('niveles-oscuro');

// 5) Matrículas en tarjetas: acciones a la vista, activar y retirar
await page.goto(`${base}/admin/matriculas`, { waitUntil: 'networkidle' });
const activate = page.getByRole('button', { name: 'Confirmar pago y activar' }).first();
const box = await activate.boundingBox();
check('«Confirmar pago y activar» dentro de la pantalla, sin deslizar', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
const before = await page.getByRole('button', { name: 'Confirmar pago y activar' }).count();
await activate.click();
await page.getByText('Matrícula activada.').waitFor({ timeout: 8000 });
await page.waitForFunction((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Confirmar pago')).length < n, before);
check('activar matrícula actualiza la lista', true);
await shot('matriculas-oscuro');
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'Retirar' }).first().click();
await page.getByText('el cupo quedó libre').waitFor({ timeout: 8000 });
check('retirar matrícula con confirmación', true);

// 6) Cambio de tema: se aplica y se recuerda
await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
check('arranca en oscuro', (await theme()) === 'dark', await theme());
await page.getByRole('button', { name: /tema|modo/i }).first().click();
check('el botón cambia a claro', (await theme()) === 'light', await theme());
await page.reload({ waitUntil: 'networkidle' });
check('el tema elegido se recuerda', (await theme()) === 'light', await theme());

// 7) El ingreso no deja la clave secreta ni la contraseña en la página oculta
const secretLeft = async (formContext, fill) => {
  const loginPage = await formContext.newPage();
  await loginPage.goto(`${base}/ingreso`, { waitUntil: 'networkidle' });
  await fill(loginPage);
  await loginPage.waitForURL((url) => !url.pathname.startsWith('/ingreso'), { timeout: 10000 });
  // React limpia lo oculto con baja prioridad: se da un margen antes de declararlo un fallo.
  const cleared = () => [...document.querySelectorAll('input[name="password"], input[name="pictograms"]')].every((input) => input.value === '');
  return loginPage.waitForFunction(cleared, undefined, { timeout: 3000 }).then(() => false, () => true);
};
const studentContext = await browser.newContext();
check('alumno: las figuras no quedan en la página tras entrar', !(await secretLeft(studentContext, async (p) => {
  for (const figure of ['🦊', '🚀', '🍕']) await p.getByRole('button', { name: `Figura ${figure}` }).click();
  await p.getByRole('button', { name: 'Entrar a mi aula' }).click();
})));
const familyContext = await browser.newContext();
check('familia: la contraseña no queda en la página tras entrar', !(await secretLeft(familyContext, async (p) => {
  await p.getByRole('tab', { name: 'Soy familia' }).click();
  const form = p.locator('form:visible');
  await form.locator('input[name="password"]').fill('matefacil123');
  await form.getByRole('button', { name: 'Entrar como familia' }).click();
})));

// 8) Un grupo en borrador no se puede elegir al matricular
await page.goto(`${base}/admin/usuarios?rol=student`, { waitUntil: 'networkidle' });
await page.locator('a[href^="/admin/usuarios/"][href*="-"]').first().click();
await page.waitForURL(/\/admin\/usuarios\/[0-9a-f-]{36}/);
const draftOption = page.locator('select[name="courseOfferingId"] option', { hasText: 'en borrador' }).first();
await draftOption.waitFor({ state: 'attached', timeout: 8000 });
check('matricular: el grupo en borrador aparece deshabilitado', await draftOption.evaluate((option) => option.disabled));

// 9) Práctica del alumno en el celular (SCRUM-61): error con explicación, acierto, formato inválido sin gastar intento
const studentPage = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addCookies([{ name: 'mf_session', value: mockToken('stu-valentina', 'student'), url: base }, { name: 'mf_role', value: 'student', url: base }]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
})();
await studentPage.goto(`${base}/lecciones`, { waitUntil: 'networkidle' });
await studentPage.getByRole('link', { name: 'Mis prácticas' }).click();
await studentPage.waitForURL(/\/lecciones\/practica$/);
const lessonLink = studentPage.getByRole('link', { name: /Sumar fracciones/ }).filter({ visible: true }).first();
await lessonLink.waitFor({ timeout: 8000 });
check('mis prácticas lista las lecciones con su avance', await studentPage.getByText(/de 3 resueltos|Sin ejercicios|de 3 resuelto/).first().isVisible());
await lessonLink.click();
await studentPage.waitForURL(/\/lecciones\/practica\/[0-9a-f-]{36}/);
const runner = studentPage.locator('section[aria-labelledby="practice-title"]').filter({ visible: true });
await runner.getByRole('button', { name: /^Ejercicio 1\b/ }).click();
await runner.getByText('¿Cuánto es 1/2 + 1/4?').waitFor({ timeout: 8000 });
// Se pide la página otra vez (HTML + datos de React): las rutas visitadas antes siguen en el DOM y tienen otros textos.
const raw = await (await studentPage.request.get(studentPage.url())).text();
check('el navegador no recibe la respuesta ni la explicación antes de responder', raw.includes('¿Cuánto es 1/2 + 1/4?') && !/correctOption|correctNumber|denominador común/i.test(raw));
await runner.getByLabel('2/6').check();
await runner.getByRole('button', { name: 'Comprobar' }).click();
const wrongText = await waitForText(runner.locator('[aria-live="polite"]').last(), (t) => t.includes('Todavía no'));
check('respuesta incorrecta: lo dice y muestra la explicación', wrongText.includes('Todavía no') && /denominador común/.test(await runner.innerText()), wrongText);
await runner.getByLabel('3/4').check();
await runner.getByRole('button', { name: 'Comprobar' }).click();
await waitForText(runner.locator('[aria-live="polite"]').last(), (t) => t.includes('Correcto'));
check('respuesta correcta: ¡Correcto! y botón para seguir', await runner.getByRole('button', { name: 'Siguiente ejercicio →' }).isVisible());
await runner.getByRole('button', { name: 'Siguiente ejercicio →' }).click();
const answer = runner.getByLabel('¿Cuánto es 1/4 + 1/4 en decimal?');
await answer.fill('medio');
await runner.getByRole('button', { name: 'Comprobar' }).click();
check('formato inválido: se avisa sin enviar', (await waitForText(runner.locator('[aria-live="polite"]').last(), (t) => t.includes('Escribe un número'))).includes('Escribe un número'));
await answer.fill('0,5');
await runner.getByRole('button', { name: 'Comprobar' }).click();
await waitForText(runner.locator('[aria-live="polite"]').last(), (t) => t.includes('Correcto'));
const progressText = await runner.locator('header p').innerText();
check('el avance de la lección sube con cada acierto', /^[23] de 3 resueltos/.test(progressText), progressText);
await studentPage.screenshot({ path: join(output, 'practica-celular.png'), fullPage: true });
check('práctica sin desborde en el celular', await noHorizontalScroll(studentPage));
await studentPage.context().close();

// 10) Profesora en tableta (SCRUM-70): entra por «Equipo», ve sus grupos, toma asistencia en un clic
const teacherContext = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
const teacher = await teacherContext.newPage();
teacher.on('pageerror', (e) => errors.push(e.message));
await teacher.goto(`${base}/ingreso`, { waitUntil: 'networkidle' });
await teacher.getByRole('tab', { name: 'Equipo' }).click();
const staffForm = teacher.locator('form:visible');
await staffForm.locator('input[name="email"]').fill('lucia@matefacil.pe');
await staffForm.locator('input[name="password"]').fill('matefacil123');
await staffForm.getByRole('button', { name: 'Entrar al panel' }).click();
await teacher.waitForURL(/\/profesor$/, { timeout: 10000 });
const cards = teacher.locator('a[href^="/profesor/grupos/"]').filter({ visible: true });
await cards.first().waitFor({ timeout: 8000 });
// Sus dos grupos de la demo (más el que el flujo 4 le asignó); nunca el del laboratorio, que no es suyo.
const cardText = (await cards.allInnerTexts()).join(' | ');
check('la profesora entra a su área y ve solo sus grupos', cardText.includes('Grupo A') && cardText.includes('Grupo B') && !cardText.includes('Grupo único'), cardText);
await cards.filter({ hasText: 'Grupo A' }).click();
await teacher.waitForURL(/\/profesor\/grupos\/[0-9a-f-]{36}$/);
await teacher.getByRole('heading', { name: 'Alumnos' }).waitFor({ timeout: 8000 });
const groupText = await teacher.locator('main').filter({ visible: true }).innerText();
check('el grupo muestra clases y alumnos con su avance', /Clase 1/.test(groupText) && /resueltos|Sin ejercicios/.test(groupText), groupText.slice(0, 200));
await teacher.screenshot({ path: join(output, 'profesor-grupo-tableta.png'), fullPage: true });
const take = teacher.getByRole('link', { name: /Tomar asistencia|Ver o corregir/ }).filter({ visible: true }).first();
await take.click();
await teacher.waitForURL(/\/clases\/[0-9a-f-]{36}\?n=1/);
// La URL cambia antes de que llegue el contenido nuevo: se espera la lista de la clase.
await teacher.locator('[aria-label="Resumen de la clase"]').filter({ visible: true }).waitFor({ timeout: 8000 });
const allPresent = teacher.getByRole('button', { name: 'Todos presentes' }).filter({ visible: true });
if (await allPresent.count()) {
  await allPresent.click();
  await waitForText(teacher.locator('[aria-label="Resumen de la clase"]').filter({ visible: true }), (t) => /Sin marcar\s*0/.test(t));
}
const summary = await teacher.locator('[aria-label="Resumen de la clase"]').filter({ visible: true }).innerText();
check('asistencia en un clic: no queda nadie sin marcar', /Sin marcar\s*0/.test(summary), summary);
const unchecked = await teacher.locator('form ol li').filter({ visible: true }).filter({ hasNot: teacher.locator('input[type="radio"]:checked') }).count();
check('la lista refleja lo guardado (nadie queda sin opción elegida)', unchecked === 0, unchecked);
await teacher.screenshot({ path: join(output, 'profesor-asistencia-tableta.png'), fullPage: true });
check('pantallas del profesor sin desborde en tableta', await noHorizontalScroll(teacher));
const foreign = await teacher.goto(`${base}/admin`, { waitUntil: 'networkidle' });
check('la profesora no entra a la administración', teacher.url().endsWith('/profesor'), [foreign?.status(), teacher.url()]);
await teacherContext.close();

check('sin errores en consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
finish();
