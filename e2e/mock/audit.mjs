// Responsive y modo oscuro: mide desborde y contraste WCAG AA en cada pantalla, tamaño y tema.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { base, launch, mockToken, output } from '../lib.mjs';

const SESSIONS = { student: ['stu-valentina', 'student'], family: ['fam-roque', 'family'], admin: ['adm-equipo', 'admin'] };
const VIEWPORTS = [[320, 640], [390, 844], [768, 1024], [1280, 800]];
const THEMES = [['claro', 'claro'], ['oscuro', 'oscuro']];

async function auditPage() {
  const toRgba = (() => {
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    return (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
  })();
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none') return null; // degradado o imagen: no se puede medir con fiabilidad
      const c = toRgba(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    let base = [255, 255, 255, 1];
    for (const layer of layers.reverse()) base = over(layer, base);
    return base;
  };
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05;
  };

  const vw = document.documentElement.clientWidth;
  const issues = { overflow: [], pageScroll: document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : 0, contrast: [], targets: [], clipped: [] };

  const scrollable = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if ((o === 'auto' || o === 'scroll') && n !== document.body && n !== document.documentElement) return true;
    }
    return false;
  };

  const seen = new Set();
  for (const el of document.querySelectorAll('main *, header *, nav *, footer *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrollable(el) && !el.closest('[hidden]')) {
      const key = label(el);
      if (!seen.has(key)) { seen.add(key); issues.overflow.push(`${key} (${Math.round(r.left)}–${Math.round(r.right)} de ${vw})`); }
    }
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (direct) {
      const s = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        issues.clipped.push(label(el));
      }
      const bg = bgOf(el);
      if (bg) {
        const fg = over(toRgba(s.color), bg);
        const size = parseFloat(s.fontSize);
        const bold = +s.fontWeight >= 700;
        const min = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        const value = ratio(fg, bg);
        if (value < min && !el.closest('[aria-hidden="true"]') && !el.closest('[disabled]')) {
          const text = el.textContent.trim().slice(0, 28);
          issues.contrast.push(`${value.toFixed(2)} «${text}» ${label(el)}`);
        }
      }
    }
  }
  if (vw <= 480) {
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="tab"]')) {
      if (!visible(el) || el.type === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.height < 32 || r.width < 32) {
        if (['checkbox', 'radio'].includes(el.type) || el.closest('[aria-hidden="true"]')) continue;
        if (getComputedStyle(el).display === 'inline') continue; // enlaces dentro de un párrafo
        issues.targets.push(`${Math.round(r.width)}×${Math.round(r.height)} «${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}» ${label(el)}`);
      }
    }
  }
  return issues;
}

const browser = await launch();
const results = [];

async function discover(role, context) {
  if (role === 'student') return ['/inicio', '/ruta', '/lecciones', '/evaluaciones', '/clases', '/logros'];
  if (role === 'family') return ['/familia'];
  const page = await context.newPage();
  const find = async (url, re) => { await page.goto(base + url); await page.waitForLoadState('networkidle'); return (await page.content()).match(re)?.[1]; };
  const courseId = await find('/admin/cursos', /href="\/admin\/cursos\/([0-9a-f-]{36})"/);
  const groupId = await find(`/admin/cursos/${courseId}`, new RegExp(`/admin/cursos/${courseId}/grupos/([0-9a-f-]{36})`));
  const userId = await find('/admin/usuarios?rol=student', /href="\/admin\/usuarios\/([0-9a-f-]{36})"/);
  const guardianId = await find('/admin/familias', /href="\/admin\/usuarios\/([0-9a-f-]{36})"/);
  await page.close();
  return ['/admin', '/admin/usuarios', '/admin/usuarios/nuevo', `/admin/usuarios/${userId}`, `/admin/usuarios/${guardianId}?buscar=a`, '/admin/familias', '/admin/matriculas',
    '/admin/cursos', '/admin/cursos/nuevo', `/admin/cursos/${courseId}`, `/admin/cursos/${courseId}/grupos/nuevo`, `/admin/cursos/${courseId}/grupos/${groupId}`, '/admin/categorias'];
}

const login = await browser.newContext();
for (const [role, [sub, cookieRole]] of Object.entries(SESSIONS)) {
  const cookies = [
    { name: 'mf_session', value: mockToken(sub, cookieRole), url: base },
    { name: 'mf_role', value: cookieRole, url: base },
  ];
  const seedContext = await browser.newContext();
  await seedContext.addCookies(cookies);
  const paths = await discover(role, seedContext);
  await seedContext.close();

  for (const [width, height] of VIEWPORTS) {
    for (const [themeName, stored] of THEMES) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      await context.addCookies(cookies);
      await context.addInitScript((t) => localStorage.setItem('mf-tema', t), stored);
      const page = await context.newPage();
      for (const path of paths) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        results.push({ role, path, width, theme: themeName, issues: await page.evaluate(auditPage) });
                // El contenido de cada pestaña solo es medible cuando está visible.
        const tabs = page.getByRole('tab');
        for (let i = 0, n = await tabs.count(); i < n; i++) {
          if (!(await tabs.nth(i).isVisible())) continue;
          const name = (await tabs.nth(i).innerText()).trim().slice(0, 18);
          await tabs.nth(i).click();
          results.push({ role, path: `${path}#${name}`, width, theme: themeName, issues: await page.evaluate(auditPage) });
        }
      }
      await context.close();
    }
  }
}
// Pantalla de ingreso (sin sesión)
for (const [width, height] of VIEWPORTS) {
  for (const [themeName, stored] of THEMES) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript((t) => localStorage.setItem('mf-tema', t), stored);
    const page = await context.newPage();
    await page.goto(`${base}/ingreso`, { waitUntil: 'networkidle' });
    results.push({ role: 'público', path: '/ingreso', width, theme: themeName, issues: await page.evaluate(auditPage) });
        await context.close();
  }
}
await login.close();
await browser.close();

writeFileSync(join(output, 'audit.json'), JSON.stringify(results, null, 1));

// Resumen: cada problema una vez, con dónde aparece
const norm = (p) => p.replace(/[0-9a-f-]{36}/g, ':id');
const group = (kind) => {
  const map = new Map();
  for (const r of results) {
    for (const item of r.issues[kind]) {
      const key = item.replace(/^\d+(\.\d+)?×?\d* /, '').replace(/\(\-?\d+–\d+ de \d+\)/, '').trim();
      const entry = map.get(key) ?? { sample: item, where: new Set() };
      entry.where.add(`${norm(r.path)}@${r.width}/${r.theme}`);
      map.set(key, entry);
    }
  }
  return [...map.values()];
};
const scroll = results.filter((r) => r.issues.pageScroll);
console.log(`Combinaciones revisadas: ${results.length}`);
console.log(`\n== Scroll horizontal de la página: ${scroll.length}`);
for (const r of scroll.slice(0, 30)) console.log(`  ${norm(r.path)} @${r.width}/${r.theme}: ${r.issues.pageScroll}px`);
for (const kind of ['overflow', 'clipped', 'contrast', 'targets']) {
  const items = group(kind);
  console.log(`\n== ${kind}: ${items.length} distintos`);
  for (const { sample, where } of items.slice(0, 45)) {
    const list = [...where];
    console.log(`  ${sample}  [${list.length}x, ej. ${list[0]}]`);
  }
}

const failed = scroll.length + group('overflow').length + group('contrast').length;
console.log(failed ? `\n${failed} problemas de desborde o contraste` : '\nTodo OK');
process.exit(failed ? 1 : 0);
