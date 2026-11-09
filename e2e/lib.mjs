// Utilidades de las pruebas en navegador. Se corren con `pnpm e2e:mock` o `pnpm e2e:real`; ver docs/pruebas/README.md.
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const base = `http://127.0.0.1:${process.env.E2E_PORT ?? '3123'}`;
export const output = fileURLToPath(new URL('./.output/', import.meta.url));
mkdirSync(output, { recursive: true });

/** E2E_BROWSER=chromium usa el Chromium de Playwright (CI); por defecto, el Edge instalado en la máquina. */
export const launch = (options = {}) => {
  const channel = process.env.E2E_BROWSER ?? 'msedge';
  return chromium.launch({ headless: true, ...(channel !== 'chromium' && { channel }), ...options });
};

let failures = 0;
export const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ` → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};
export const finish = () => {
  console.log(failures ? `\n${failures} fallos` : '\nTodo OK');
  process.exit(failures ? 1 : 0);
};

export function mockToken(sub, role) {
  const body = Buffer.from(JSON.stringify({ sub, role, exp: Date.now() + 3600_000 })).toString('base64url');
  return `mock.${body}.${createHmac('sha256', process.env.MOCK_SESSION_SECRET).update(body).digest('base64url')}`;
}

/** Espera a que desaparezcan los esqueletos de carga: `networkidle` llega antes que el contenido en streaming. */
export const settled = (page) => page.waitForFunction(
  () => ![...document.querySelectorAll('.skeleton, [aria-busy="true"]')].some((el) => el.offsetParent !== null),
  undefined, { timeout: 15000 },
);
/** Espera (hasta 8 s) a que el texto visible de `locator` cumpla `test`; devuelve el último texto leído. */
export async function waitForText(locator, test, timeout = 8000) {
  const visible = locator.filter({ visible: true });
  const until = Date.now() + timeout;
  let text = '';
  while (Date.now() < until) {
    text = await visible.innerText().catch(() => '');
    if (test(text)) return text;
    await new Promise((done) => setTimeout(done, 200));
  }
  return text;
}

export const noHorizontalScroll = async (page) => {
  await settled(page);
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
};

// ── Backend real: `E2E_BACKEND_DIR` apunta al repositorio del backend con su Docker levantado ─────
const backendDir = process.env.E2E_BACKEND_DIR ?? fileURLToPath(new URL('../../aula_mf_backend/', import.meta.url));
const backendEnv = () => readFileSync(join(backendDir, '.env'), 'utf8');
const setting = (name, fallback) => process.env[name] || backendEnv().match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim() || fallback;

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function signJwt(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const key = Buffer.from(setting('JWT_SIGNING_KEY'), 'utf8');
  return `${head}.${body}.${createHmac('sha256', key).update(`${head}.${body}`).digest('base64url')}`;
}

function findAdministrator() {
  const sql = `select a.id, a.user_id from auth.auth_accounts a
    join "authorization".user_roles ur on ur.user_id = a.user_id
    join "authorization".roles r on r.id = ur.role_id
    where r.code = 'administrator' limit 1`;
  const found = execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql',
    '-U', setting('POSTGRES_USER', 'aula'), '-d', setting('POSTGRES_DB', 'aula_virtual_dev'), '-At', '-F', ' ', '-c', sql],
  { cwd: backendDir, encoding: 'utf8' }).trim();
  if (!found) throw new Error('No hay administrador: ejecuta sh tests/e2e/setup-admin.sh en el backend.');
  return found.split(' ');
}

/** Sesión de administrador firmada con la clave de desarrollo, y llamadas a la API con ella. */
export function realApi() {
  const [account, user] = findAdministrator();
  const now = Math.floor(Date.now() / 1000);
  const adminToken = signJwt({ sub: account, user_id: user, jti: randomUUID(), iat: now, exp: now + 3600, iss: 'AulaVirtual.Api', aud: 'AulaVirtual.Web' });
  const apiBase = `http://localhost:${setting('API_PORT', '5087')}/api/v1`;

  async function call(method, path, payload) {
    const res = await fetch(apiBase + path, {
      method,
      headers: { Accept: 'application/json', Authorization: `Bearer ${adminToken}`, ...(payload !== undefined && { 'Content-Type': 'application/json' }) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : undefined;
  }
  return { adminToken, call };
}

const FUTURE_MINUTE = 60000;
/** Curso publicable con profesor (y sus credenciales) y un grupo publicado; `minutes` son los minutos hasta cada clase. */
export async function seedCourse(call, tag, minutes) {
  const category = await call('POST', '/course-categories', { name: `Demo ${tag}` });
  const course = await call('POST', '/courses', { title: `Geometría ${tag}`, categoryId: category.id, shortDescription: 'Figuras, ángulos y áreas con ejercicios guiados.' });
  const teacher = await call('POST', '/admin/instructors', { givenNames: 'Lucía', firstSurname: `Paredes ${tag}`, email: `lucia.${tag}@example.com` });
  const start = (m) => new Date(Math.floor((Date.now() + m * FUTURE_MINUTE) / FUTURE_MINUTE) * FUTURE_MINUTE);
  const session = (m) => ({ id: null, startsAt: start(m).toISOString(), endsAt: new Date(start(m).getTime() + 3600000).toISOString(), virtualLink: 'https://meet.example.com/geometria' });
  const offering = await call('POST', `/courses/${course.id}/offerings`, {
    name: 'Grupo Tarde', maximumCapacity: 8, basePrice: 180, currencyCode: 'PEN', plannedSessionCount: minutes.length, sessions: minutes.map(session),
  });
  await call('PUT', `/courses/${course.id}/offerings/${offering.id}/instructors`, { instructorIds: [teacher.instructorId] });
  await call('POST', `/courses/${course.id}/offerings/${offering.id}/publish`);
  return { course, offering, session, teacher };
}

const cookiesFrom = (res) => Object.fromEntries(res.headers.getSetCookie().map((c) => c.split(';')[0]).map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]));
const cookieHeader = (cookies) => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

/** Envía el formulario de ingreso sin JavaScript (Server Action con mejora progresiva). */
export async function submitLogin(fields) {
  const page = await (await fetch(`${base}/ingreso`)).text();
  const name = Object.keys(fields)[0];
  const html = [...page.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(`name="${name}"`));
  const form = new FormData();
  for (const [tag] of html.matchAll(/<input[^>]*>/g)) {
    const field = tag.match(/name="([^"]+)"/)?.[1];
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? '';
    if (field?.startsWith('$ACTION')) form.append(field, value.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
  }
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const res = await fetch(`${base}/ingreso`, { method: 'POST', body: form, redirect: 'manual' });
  return { status: res.status, cookies: cookiesFrom(res), maxAge: res.headers.getSetCookie().find((c) => c.startsWith('mf_refresh=')) ?? '' };
}

export async function getPage(path, cookies) {
  const res = await fetch(base + path, { headers: { cookie: cookieHeader(cookies) }, redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), set: cookiesFrom(res), html: (await res.text()).replaceAll('<!-- -->', '') };
}
