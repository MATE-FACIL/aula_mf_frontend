// Pantalla de Lecciones del alumno (SCRUM-56) contra la API real en Docker, con login real por formulario: solo ve las
// sesiones PUBLICADAS de su curso, con pestañas Clase grabada · Práctica · Materiales, y en el celular no hay scroll horizontal.
import { base, check, finish, getPage as get, launch, noHorizontalScroll, realApi, seedCourse, submitLogin } from '../lib.mjs';

const { call } = realApi();
const tag = Date.now().toString().slice(-6);
const { course, offering } = await seedCourse(call, tag, [2880]);

const content = `/courses/${course.id}/content`;
const unit = await call('POST', `${content}/units`, { title: `Fracciones ${tag}` });
const published = await call('POST', `${content}/units/${unit.id}/lessons`, {
  title: `Sumar fracciones ${tag}`, summary: 'Con el mismo denominador', isPublished: true,
  videoUrl: 'https://www.youtube.com/watch?v=abc123',
  materials: [{ title: `Guía ${tag}`, url: 'https://ejemplo.com/guia.pdf' }],
});
await call('POST', `${content}/units/${unit.id}/lessons`, { title: `Borrador secreto ${tag}`, isPublished: false, materials: [] });
const second = await call('POST', `${content}/units/${unit.id}/lessons`, { title: `Restar fracciones ${tag}`, isPublished: true, materials: [] });

const student = async (name, doc, enroll) => {
  const created = await call('POST', '/admin/students', { givenNames: name, firstSurname: `Lecciones${tag}`, documentType: 'DNI', documentNumber: doc });
  if (enroll) {
    const seat = await call('POST', '/enrollments', { studentUserId: created.userId, courseOfferingId: offering.id });
    await call('POST', `/enrollments/${seat.id}/activate`, { paymentNote: 'Yape' });
  }
  return created;
};
const ana = await student('Ana', `7${tag}1`, true);
const luis = await student('Luis', `7${tag}2`, false);

// ─── HTML del servidor ─────────────────────────────────────────────────
const anaLogin = await submitLogin({ username: ana.loginIdentifier, password: ana.initialPassword });
let page = await get('/lecciones', anaLogin.cookies);
check('Ana ve su curso real y sus sesiones publicadas', page.status === 200 && page.html.includes(`Sumar fracciones ${tag}`) && page.html.includes(`Restar fracciones ${tag}`), page.status);
check('el borrador nunca llega al navegador', !page.html.includes('Borrador secreto'));

const luisLogin = await submitLogin({ username: luis.loginIdentifier, password: luis.initialPassword });
page = await get('/lecciones', luisLogin.cookies);
check('sin matrícula activa: sin lecciones ni datos del curso', page.status === 200 && page.html.includes('Todavía no tienes lecciones') && !page.html.includes(`Sumar fracciones ${tag}`), page.status);

// ─── Navegador (celular) ───────────────────────────────────────────────
const browser = await launch();
const cookiesFor = (cookies) => Object.entries(cookies).map(([name, value]) => ({ name, value, url: base }));
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await phone.addCookies(cookiesFor(anaLogin.cookies));
const p = await phone.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${base}/lecciones`, { waitUntil: 'networkidle' });
const visible = (locator) => locator.filter({ visible: true });

check('abre en la primera sesión con sus tres pestañas', (await visible(p.getByRole('tab')).count()) === 3
  && await p.getByRole('heading', { name: `Sumar fracciones ${tag}` }).isVisible());
check('el video de YouTube se abre aparte (no se incrusta)', await p.getByRole('link', { name: 'Ver la clase grabada' }).getAttribute('href') === 'https://www.youtube.com/watch?v=abc123'
  && (await p.locator('video').count()) === 0);

await p.getByRole('tab', { name: /Materiales/ }).click();
check('materiales: el enlace del material', await p.getByRole('link', { name: 'Abrir' }).getAttribute('href') === 'https://ejemplo.com/guia.pdf');

await p.getByRole('tab', { name: /Práctica/ }).click();
check('práctica: lleva a la práctica de esa lección', (await p.getByRole('link', { name: 'Practicar esta lección' }).getAttribute('href')) === `/lecciones/practica/${published.id}`);

await p.getByRole('button', { name: new RegExp(`Restar fracciones ${tag}`) }).click();
check('elegir otra sesión la abre y vuelve a «Clase grabada»', await p.getByRole('heading', { name: `Restar fracciones ${tag}` }).isVisible()
  && await p.getByText('La grabación de esta clase aún no está disponible.').isVisible());
check('en el celular no hay scroll horizontal', await noHorizontalScroll(p));
check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));

void second;
await browser.close();
await finish();
