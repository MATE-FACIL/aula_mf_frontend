// Carga de contenido (SCRUM-71) contra la API real en Docker, con el almacenamiento local: el administrador crea
// unidades y sesiones, pone un video y materiales como enlace o como archivo (subida directa del navegador al
// almacenamiento), reordena, mueve y borra. Pase o falle, al terminar no queda ningún archivo en el almacenamiento.
// Necesita: docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d --build (en el backend).
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { base, check, deleteStorageKeys, finish, launch, noHorizontalScroll, output, realApi, STORAGE_HOST_RULE, storageGet, storageKeys, waitForText } from '../lib.mjs';

const { adminToken, call } = realApi();
const tag = Date.now().toString().slice(-6);
const errors = [];
const course = await call('POST', '/courses', { title: `Contenido ${tag}` });
// Las claves del almacenamiento llevan los identificadores SIN guiones.
const compact = (id) => id.replaceAll('-', '');
const prefix = `courses/${compact(course.id)}/`;
const hugeFile = join(tmpdir(), `enorme-${tag}.pdf`);
const contentOf = () => call('GET', `/courses/${course.id}/content`);
const lessonsOf = async () => (await contentOf()).units.flatMap((unit) => unit.lessons);
const until = async (read, ok, ms = 12000) => {
  const limit = Date.now() + ms;
  let value = await read();
  while (!ok(value) && Date.now() < limit) {
    await new Promise((done) => setTimeout(done, 250));
    value = await read();
  }
  return value;
};
const vis = (locator) => locator.filter({ visible: true });

// ¿Hay almacenamiento? Sin él las subidas responden 503 y esa parte se omite (todo lo demás se prueba igual).
const probeUnit = await call('POST', `/courses/${course.id}/content/units`, { title: 'Sondeo' });
const probeLesson = await call('POST', `/courses/${course.id}/content/units/${probeUnit.id}/lessons`, { title: 'Sondeo', isPublished: false, materials: [] });
const probe = await fetch(`http://localhost:${process.env.API_PORT ?? '5087'}/api/v1/courses/${course.id}/content/lessons/${probeLesson.id}/uploads`, {
  method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ kind: 'material', contentType: 'application/pdf', size: 10 }),
});
const storage = probe.status === 201;
await call('DELETE', `/courses/${course.id}/content/lessons/${probeLesson.id}`);
await call('DELETE', `/courses/${course.id}/content/units/${probeUnit.id}`);
if (!storage) console.log('OMITIDA la subida de archivos: este ambiente no tiene almacenamiento (usa docker-compose.storage.yml).');

const browser = await launch({ args: [STORAGE_HOST_RULE] });
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-PE' });
  await desktop.addCookies([{ name: 'mf_session', value: adminToken, url: base }, { name: 'mf_role', value: 'admin', url: base }]);
  const page = await desktop.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  const main = () => vis(page.locator('main'));

  // ─── Del curso al contenido, y las unidades ──────────────────────────
  await page.goto(`${base}/admin/cursos/${course.id}`, { waitUntil: 'networkidle' });
  await vis(page.getByRole('link', { name: 'Administrar contenido' })).click();
  await page.waitForURL(/\/contenido$/);
  await waitForText(main(), (t) => t.includes('todavía no tiene unidades'));
  check('un curso nuevo no tiene unidades y lo dice', (await main().innerText()).includes('todavía no tiene unidades'));
  for (const name of ['Fracciones', 'Decimales']) {
    await vis(page.getByLabel('Nombre de la unidad', { exact: true })).fill(name);
    await vis(page.getByRole('button', { name: 'Crear unidad' })).click();
    await vis(page.locator(`section[aria-label="Unidad ${name}"]`)).waitFor({ timeout: 10000 });
  }
  check('se crean las dos unidades, en orden', (await contentOf()).units.map((u) => u.title).join() === 'Fracciones,Decimales');

  // ─── Una sesión con video y material como enlace ─────────────────────
  await vis(page.locator('section[aria-label="Unidad Fracciones"]').getByRole('link', { name: '+ Nueva sesión' })).click();
  await page.waitForURL(/\/sesiones\/nueva\?unidad=/);
  const unitSelect = vis(page.locator('select[name="unitId"]'));
  await unitSelect.waitFor({ timeout: 10000 });
  check('la sesión nueva parte de la unidad desde la que se creó', (await unitSelect.evaluate((el) => el.selectedOptions[0].textContent)) === 'Fracciones');
  await vis(page.getByLabel('Título de la sesión')).fill('Sumar fracciones');
  await vis(page.getByLabel('Resumen (opcional)')).fill('Con distinto denominador');
  await vis(page.getByRole('textbox', { name: 'Video: enlace' })).fill('http://sitio.com/video');
  await vis(page.getByRole('button', { name: '+ Agregar material' })).click();
  await vis(page.getByLabel('Título', { exact: true })).fill('Guía en línea');
  await vis(page.getByRole('textbox', { name: 'Material 1: enlace' })).fill('https://ejemplo.com/guia.pdf');
  await vis(page.getByRole('button', { name: 'Crear sesión' })).click();
  check('un video con http:// se rechaza y no se pierde lo escrito', (await waitForText(main(), (t) => t.includes('El video debe ser un enlace https://'))).includes('El video debe ser un enlace https://') &&
    (await vis(page.getByLabel('Título de la sesión')).inputValue()) === 'Sumar fracciones');
  await vis(page.getByRole('textbox', { name: 'Video: enlace' })).fill('https://www.youtube.com/watch?v=sumar');
  await vis(page.getByLabel('Publicada')).check();
  await vis(page.getByRole('button', { name: 'Crear sesión' })).click();
  await page.waitForURL(/\/sesiones\/[0-9a-f-]{36}\?creada=1$/);
  const lessonUrl = page.url().split('?')[0];
  const first = (await lessonsOf())[0];
  check('la sesión se guarda con su video, su material y publicada, y lleva a su pantalla', first?.title === 'Sumar fracciones' && first.summary === 'Con distinto denominador' &&
    first.videoUrl === 'https://www.youtube.com/watch?v=sumar' && first.isPublished && first.materials[0]?.url === 'https://ejemplo.com/guia.pdf' && lessonUrl.endsWith(first.id), first);

  if (storage) {
    // ─── Subir un video y un PDF directo al almacenamiento ───────────────
    await vis(page.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
    const video = Buffer.alloc(300 * 1024, 7);
    await vis(page.getByRole('radiogroup', { name: 'Video: enlace o archivo' }).getByLabel('Archivo')).check();
    await vis(page.locator('input[type="file"]')).first().setInputFiles({ name: 'clase.mp4', mimeType: 'video/mp4', buffer: video });
    check('el video se sube y aparece como archivo listo para adjuntar', (await waitForText(main(), (t) => t.includes('clase.mp4'), 20000)).includes('clase.mp4'));
    await vis(page.getByRole('button', { name: 'Guardar sesión' })).click();
    const withVideo = (await until(lessonsOf, (all) => all[0]?.videoFileId))[0];
    check('al guardar, el backend adjunta el video subido', !!withVideo.videoFileId && withVideo.videoContentType === 'video/mp4', withVideo);
    const download = await storageGet(withVideo.videoUrl);
    check('el archivo está en el almacenamiento y se descarga con el enlace firmado, igual de grande', download.status === 200 && download.body.length === video.length && download.body.equals(video), [download.status, download.body.length]);

    await vis(page.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
    await vis(page.getByRole('button', { name: '+ Agregar material' })).click();
    const material2 = vis(page.getByRole('radiogroup', { name: 'Material 2: enlace o archivo' }));
    await vis(page.getByLabel('Título', { exact: true })).last().fill('Ficha en PDF');
    await material2.getByLabel('Archivo').check();
    const pdf = Buffer.from(`%PDF-1.4\n% Ficha ${tag}\n`);
    const pickerOf2 = material2.locator('xpath=..').locator('input[type="file"]');
    await pickerOf2.setInputFiles({ name: 'ficha.pdf', mimeType: 'application/pdf', buffer: pdf });
    check('el PDF se sube', (await waitForText(main(), (t) => t.includes('ficha.pdf'), 20000)).includes('ficha.pdf'));
    const keysBefore = storageKeys(prefix).length;
    check('hasta aquí hay dos archivos en el almacenamiento: el video y el PDF', keysBefore === 2, storageKeys(prefix));

    // Reglas: se revisan antes de subir nada
    await pickerOf2.setInputFiles({ name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
    check('un tipo no permitido se rechaza antes de subir', (await waitForText(main(), (t) => t.includes('Tipo de archivo no permitido: usa PDF'))).includes('Tipo de archivo no permitido: usa PDF'));
    // Más de 50 MB no se puede pasar como búfer a Playwright: va por ruta, y el archivo se borra al terminar.
    writeFileSync(hugeFile, Buffer.alloc(51 * 1024 * 1024, 1));
    await pickerOf2.setInputFiles(hugeFile);
    check('un material de más de 50 MB se rechaza antes de subir', (await waitForText(main(), (t) => t.includes('El archivo supera el máximo de 50 MB.'), 20000)).includes('El archivo supera el máximo de 50 MB.'));
    check('y no se subió nada de eso', storageKeys(prefix).length === keysBefore, [keysBefore, storageKeys(prefix).length]);
    await vis(page.getByRole('button', { name: 'Guardar sesión' })).click();
    const withPdf = (await until(lessonsOf, (all) => all[0]?.materials.length === 2))[0];
    check('al guardar, el backend adjunta el PDF (con su tamaño) junto al enlace', withPdf.materials[0].url === 'https://ejemplo.com/guia.pdf' && !!withPdf.materials[1].fileId &&
      withPdf.materials[1].size === pdf.length, withPdf.materials);

    // Quitar el video: el archivo se borra del almacenamiento
    const videoKey = storageKeys(prefix).find((k) => k.key.includes(compact(withPdf.videoFileId)));
    check('antes de quitarlo, el video está en el almacenamiento', !!videoKey);
    await vis(page.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
    await vis(page.getByRole('button', { name: 'Quitar archivo' })).first().click();
    await vis(page.getByRole('button', { name: 'Guardar sesión' })).click();
    const noVideo = (await until(lessonsOf, (all) => !all[0]?.videoFileId))[0];
    const gone = await until(async () => storageKeys(prefix).some((k) => k.key.includes(compact(withPdf.videoFileId))), (still) => !still);
    check('quitar el video lo borra de la sesión y del almacenamiento', !noVideo.videoFileId && !noVideo.videoUrl && gone === false, noVideo);
  } else {
    // Sin almacenamiento el editor sigue sirviendo para enlaces, y explica por qué no se puede subir un archivo.
    await vis(page.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
    await vis(page.getByRole('radiogroup', { name: 'Video: enlace o archivo' }).getByLabel('Archivo')).check();
    await vis(page.locator('input[type="file"]')).first().setInputFiles({ name: 'clase.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(1024, 7) });
    const explanation = 'La subida de archivos no está activa en este ambiente';
    check('sin almacenamiento: explica que la subida no está activa y que use un enlace', (await waitForText(main(), (t) => t.includes(explanation))).includes(explanation));
  }

  // ─── Reordenar, mover de unidad y editar ─────────────────────────────
  await call('POST', `/courses/${course.id}/content/units/${first.unitId}/lessons`, { title: 'Restar fracciones', isPublished: false, materials: [] });
  await page.goto(`${base}/admin/cursos/${course.id}/contenido`, { waitUntil: 'networkidle' });
  const fractions = vis(page.locator('section[aria-label="Unidad Fracciones"]'));
  await fractions.waitFor({ timeout: 10000 });
  check('una sesión en borrador se ve como tal', /borrador/i.test(await fractions.innerText()) && /publicada/i.test(await fractions.innerText()));
  await vis(fractions.getByRole('button', { name: 'Subir la sesión Restar fracciones' })).click();
  const order = await until(async () => (await lessonsOf()).map((l) => l.title).join(), (titles) => titles.startsWith('Restar'));
  check('subir una sesión cambia el orden en el backend y la numeración', order === 'Restar fracciones,Sumar fracciones' && (await lessonsOf())[0].number === 1, order);
  await vis(page.getByRole('button', { name: 'Subir la unidad Decimales' })).click();
  const units = await until(async () => (await contentOf()).units.map((u) => u.title).join(), (titles) => titles.startsWith('Decimales'));
  check('subir una unidad la pone primero', units === 'Decimales,Fracciones', units);

  await page.goto(`${lessonUrl}`, { waitUntil: 'networkidle' });
  await vis(page.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
  await vis(page.locator('select[name="unitId"]')).selectOption({ label: 'Decimales' });
  await vis(page.getByRole('button', { name: 'Guardar sesión' })).click();
  const moved = await until(lessonsOf, (all) => all.find((l) => l.id === first.id)?.unitId !== first.unitId);
  const decimals = (await contentOf()).units.find((u) => u.title === 'Decimales');
  check('cambiar la unidad en el editor mueve la sesión y conserva sus archivos', moved.find((l) => l.id === first.id)?.unitId === decimals.id &&
    (!storage || moved.find((l) => l.id === first.id).materials.some((m) => m.fileId)), moved.map((l) => l.unitId));

  // ─── Celular ───────────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-PE' });
  await phone.addCookies([{ name: 'mf_session', value: adminToken, url: base }, { name: 'mf_role', value: 'admin', url: base }]);
  const m = await phone.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto(`${base}/admin/cursos/${course.id}/contenido`, { waitUntil: 'networkidle' });
  await vis(m.locator('section[aria-label="Unidad Decimales"]')).waitFor({ timeout: 10000 });
  await m.screenshot({ path: join(output, 'real-contenido-esquema-celular.png'), fullPage: true });
  check('el esquema del curso no se desborda en el celular', await noHorizontalScroll(m));
  await m.goto(lessonUrl, { waitUntil: 'networkidle' });
  await vis(m.getByLabel('Título de la sesión')).waitFor({ timeout: 10000 });
  await m.screenshot({ path: join(output, 'real-contenido-sesion-celular.png'), fullPage: true });
  check('el editor de la sesión no se desborda en el celular', await noHorizontalScroll(m));
  await phone.close();

  // ─── Borrar ────────────────────────────────────────────────────────
  await page.goto(lessonUrl, { waitUntil: 'networkidle' });
  await vis(page.getByRole('button', { name: 'Borrar sesión' })).waitFor({ timeout: 10000 });
  page.once('dialog', (dialog) => dialog.accept());
  await vis(page.getByRole('button', { name: 'Borrar sesión' })).click();
  await page.waitForURL(/\/contenido\?borrada=1$/);
  check('borrar una sesión la quita y avisa', (await waitForText(main(), (t) => t.includes('Sesión borrada.'))).includes('Sesión borrada.') && !(await lessonsOf()).some((l) => l.id === first.id));
  const left = await until(async () => storageKeys(prefix).length, (n) => n === 0);
  check('y se borran también sus archivos del almacenamiento', !storage || left === 0, left);
  await desktop.close();

  // Una unidad con sesiones no se borra por la API (409): la pantalla ni ofrece el botón
  const withLessons = (await contentOf()).units.find((u) => u.lessons.length > 0);
  const refusal = await fetch(`http://localhost:${process.env.API_PORT ?? '5087'}/api/v1/courses/${course.id}/content/units/${withLessons.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  check('el backend no deja borrar una unidad con sesiones (409)', refusal.status === 409, refusal.status);
} finally {
  await browser.close();
  rmSync(hugeFile, { force: true });
  // Pase o falle: no queda nada en el almacenamiento.
  for (const lesson of await lessonsOf().catch(() => [])) await call('DELETE', `/courses/${course.id}/content/lessons/${lesson.id}`).catch(() => undefined);
  if (storage) {
    deleteStorageKeys(prefix);
    check('al terminar no queda ningún archivo de la prueba en el almacenamiento', storageKeys(prefix).length === 0, storageKeys(prefix));
  }
}

check('sin errores en el navegador', errors.length === 0, errors.slice(0, 3).join(' | '));
finish();
