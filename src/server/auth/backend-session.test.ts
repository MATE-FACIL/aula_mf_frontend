import { afterEach, describe, expect, it, vi } from 'vitest';
import { jwtExpiresAt, needsRenewal, refreshTokenFrom, renewBackendSession } from './backend-session';

const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;

describe('needsRenewal', () => {
  it('renueva cuando falta menos de un minuto o ya venció', () => {
    const now = 1_000_000_000_000;
    expect(needsRenewal(jwt(now / 1000 + 600), now)).toBe(false);
    expect(needsRenewal(jwt(now / 1000 + 30), now)).toBe(true);
    expect(needsRenewal(jwt(now / 1000 - 5), now)).toBe(true);
  });

  it('ignora tokens que no son JWT (modo mock)', () => {
    expect(jwtExpiresAt('mock.abc.def')).toBeNull();
    expect(needsRenewal('no-es-jwt')).toBe(false);
  });
});

describe('refreshTokenFrom', () => {
  it('lee solo la cookie de renovación del backend', () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'otra=1; Path=/');
    headers.append('Set-Cookie', 'aula_virtual_refresh=abc%2B123; Path=/api/v1/auth; HttpOnly');
    expect(refreshTokenFrom(new Response(null, { headers }))).toBe('abc+123');
    expect(refreshTokenFrom(new Response(null))).toBeNull();
  });
});

describe('renewBackendSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('peticiones simultáneas con el mismo token hacen UNA sola renovación (el backend rota y revoca reusos)', async () => {
    const fetchMock = vi.fn(async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie', 'aula_virtual_refresh=nuevo; Path=/api/v1/auth; HttpOnly');
      return new Response(JSON.stringify({ accessToken: 'acceso', expiresIn: 900 }), { status: 200, headers });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([1, 2, 3, 4].map(() => renewBackendSession('token-unico-1')));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const result of results) expect(result).toEqual({ accessToken: 'acceso', expiresIn: 900, refreshToken: 'nuevo' });
  });

  it('distingue sesión terminada (401) de backend caído', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    expect(await renewBackendSession('token-401')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await renewBackendSession('token-caido')).toBe('unavailable');
  });
});
