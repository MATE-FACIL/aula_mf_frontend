// Panel de la familia (SCRUM-67, SCRUM-68) con login real por formulario, contra la API en Docker.
import { check, finish, getPage as get, realApi, seedCourse, submitLogin } from '../lib.mjs';

const { call } = realApi();
const tag = Date.now().toString().slice(-6);
const { course, offering } = await seedCourse(call, tag, [1440, 4320]);
const person = (path, data) => call('POST', path, data);
const mom = await person('/admin/guardians', { givenNames: 'Rosa', firstSurname: `Madre${tag}`, email: `rosa.${tag}@example.com` });
const dad = await person('/admin/guardians', { givenNames: 'Otro', firstSurname: `Padre${tag}`, email: `otro.${tag}@example.com` });
const student = (given, surname, doc, guardianUserId) => person('/admin/students', { givenNames: given, firstSurname: surname, documentType: 'DNI', documentNumber: doc, guardianUserId });
const ana = await student('Ana', `Hija${tag}`, `3${tag}1`, mom.userId);
const luis = await student('Luis', `Hijo${tag}`, `3${tag}2`, mom.userId);
const ajeno = await student('Ajeno', `Vecino${tag}`, `3${tag}3`, dad.userId);
const enroll = (who) => call('POST', '/enrollments', { studentUserId: who.userId, courseOfferingId: offering.id });
const anaSeat = await enroll(ana);
await enroll(luis);
await enroll(ajeno);
await call('POST', `/enrollments/${anaSeat.id}/activate`, { paymentNote: 'Yape' });
const loginFront = (email, password) => submitLogin({ email, password });

const session = await loginFront(mom.loginIdentifier, mom.initialPassword);
check('aula: login real de la madre con rol familia', session.cookies.mf_role === 'family' && session.cookies.mf_refresh, session);
let page = await get('/familia', session.cookies);
check('aula: muestra a sus dos hijos con su nombre real', page.status === 200 && page.html.includes(`Ana Hija${tag}`) && page.html.includes(`Luis Hijo${tag}`), page.status);
check('aula: no aparece el hijo de otra familia', !page.html.includes(`Vecino${tag}`));
check('aula: matrículas, próximas clases y profesor reales', page.html.includes(course.title) && page.html.includes('Próximas clases') && page.html.includes(`Lucía Paredes ${tag}`));
check('aula: pendiente con su aviso', page.html.includes('Pendiente de pago') && page.html.includes('aparecen cuando se confirma el pago'));
check('aula: sin datos de ejemplo de otros niños', !page.html.includes('Valentina') && !page.html.includes('Mateo') && !page.html.includes('Fracciones'));

const noKids = await person('/admin/guardians', { givenNames: 'Sin', firstSurname: `Hijos${tag}`, email: `sin.${tag}@example.com` });
const empty = await loginFront(noKids.loginIdentifier, noKids.initialPassword);
page = await get('/familia', empty.cookies);
check('aula: padre sin hijos ve un mensaje claro', page.html.includes('Todavía no hay hijos vinculados'), page.status);

finish();
