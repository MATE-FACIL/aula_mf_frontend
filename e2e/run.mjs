// Levanta el build de producción y corre las pruebas en navegador. Requiere `pnpm build`.
//   node e2e/run.mjs mock   flujos, responsive y contraste; no necesita backend (CI)
//   node e2e/run.mjs real   contra la API en Docker del repositorio del backend
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SUITES = {
  mock: { port: '3123', env: { API_MODE: 'mock' }, scripts: ['mock/audit', 'mock/flows'] },
  real: {
    port: '3124',
    env: { API_MODE: 'hybrid', API_BASE_URL: `http://localhost:${process.env.API_PORT ?? '5087'}/api/v1` },
    scripts: ['real/walkthrough', 'real/family', 'real/session', 'real/practice-teacher', 'real/diagnostic'],
  },
};
const suite = SUITES[process.argv[2]];
if (!suite) {
  console.error('Uso: node e2e/run.mjs mock|real');
  process.exit(2);
}

const server = '.next/standalone/server.js';
if (!existsSync(server)) {
  console.error('Falta el build. Ejecuta primero: pnpm build');
  process.exit(2);
}

// El secreto de las sesiones mock solo tiene que coincidir entre el servidor y las pruebas.
const localSecret = existsSync('.env.local') ? readFileSync('.env.local', 'utf8').match(/^MOCK_SESSION_SECRET=(.*)$/m)?.[1].trim() : undefined;
const shared = {
  E2E_PORT: suite.port,
  MOCK_SESSION_SECRET: process.env.MOCK_SESSION_SECRET ?? localSecret ?? randomBytes(32).toString('hex'),
};
const child = spawn(process.execPath, [server], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, ...suite.env, ...shared, HOSTNAME: '127.0.0.1', PORT: suite.port },
});

let code = 1;
try {
  const url = `http://127.0.0.1:${suite.port}/ingreso`;
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await fetch(url).then((r) => r.ok, () => false);
    if (!ready) await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) throw new Error(`El aula no respondió en ${url}.`);

  let failed = 0;
  for (const script of suite.scripts) {
    console.log(`\n=== ${script}`);
    const file = fileURLToPath(new URL(`./${script}.mjs`, import.meta.url));
    const { status } = spawnSync(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, ...shared } });
    if (status !== 0) failed++;
  }
  console.log(failed ? `\n${failed} suites con fallos` : '\nTodas las suites pasaron');
  code = failed ? 1 : 0;
} finally {
  child.kill();
}
process.exit(code);
