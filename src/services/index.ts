import 'server-only';
import { env } from '@/config/env';
import type { Services } from './contracts';
import { httpServices } from './http';
import { hybridServices } from './hybrid';
import { mockServices } from './mock';

/** Punto único de acceso a datos. Cambiar API_MODE=http para usar la API .NET. */
export const services: Services = env.apiMode === 'http' ? httpServices : env.apiMode === 'hybrid' ? hybridServices : mockServices;

export const isMockMode = env.apiMode === 'mock';

/** El alumno ingresa con usuario y contraseña de texto (backend real) en lugar de figuras. */
export const usesPasswordLogin = env.apiMode !== 'mock';

export type { RequestContext } from './contracts';
