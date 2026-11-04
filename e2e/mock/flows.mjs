// Flujos reales en el navegador con datos mock, en celular y modo oscuro.
import { join } from 'node:path';
import { base, check, finish, launch, mockToken, noHorizontalScroll, output } from '../lib.mjs';

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

check('sin errores en consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
finish();
