import 'server-only';

// Configuración del servidor validada una sola vez al arrancar.
// Nada de aquí llega al navegador (no usa el prefijo NEXT_PUBLIC_).

type ApiMode = 'mock' | 'http' | 'hybrid';

function readMode(value: string | undefined): ApiMode {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'http' || value === 'hybrid') return value;
  throw new Error(`API_MODE inválido: «${value}». Usa «mock», «hybrid» o «http».`);
}

function readPositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} debe ser un entero positivo.`);
  return n;
}

const mode = readMode(process.env.API_MODE);
const apiBaseUrl = process.env.API_BASE_URL ?? '';

if (mode !== 'mock' && !/^https?:\/\//.test(apiBaseUrl)) {
  throw new Error('API_BASE_URL es obligatorio cuando API_MODE=http o hybrid (ej.: https://api.matefacil.pe/api).');
}

export const env = {
  apiMode: mode,
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
  apiTimeoutMs: readPositiveInt(process.env.API_TIMEOUT_MS, 8000, 'API_TIMEOUT_MS'),
  isProduction: process.env.NODE_ENV === 'production',
} as const;
