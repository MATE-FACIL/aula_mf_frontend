import { describe, expect, it } from 'vitest';
import {
  contentTypeOf, fileProblem, formatBytes, LESSON_TITLE_MAX, MATERIAL_MAX_BYTES, MAX_MATERIALS, moveInOrder, parseHttpsLink,
  parseLessonForm, parseUnitTitle, VIDEO_MAX_BYTES,
} from './rules';

const UNIT = '0b6e8f3c-0000-4000-8000-000000000001';
const FILE = '0b6e8f3c-0000-4000-8000-000000000002';

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
};

describe('parseHttpsLink', () => {
  it('acepta https, deja vacío sin enlace y rechaza http y otros', () => {
    expect(parseHttpsLink(' https://www.youtube.com/watch?v=abc ')).toEqual({ ok: true, value: 'https://www.youtube.com/watch?v=abc' });
    expect(parseHttpsLink('   ')).toEqual({ ok: true, value: null });
    expect(parseHttpsLink(undefined)).toEqual({ ok: true, value: null });
    for (const bad of ['http://sitio.com/a', 'youtube.com/watch', 'ftp://sitio.com/a', 'javascript:alert(1)', 'https://localhost', 'no es un enlace']) {
      expect(parseHttpsLink(bad).ok).toBe(false);
    }
    expect(parseHttpsLink(`https://sitio.com/${'a'.repeat(2100)}`).ok).toBe(false);
  });
});

describe('fileProblem (igual que el backend)', () => {
  const file = (name: string, type: string, size = 1024) => ({ name, type, size });

  it('acepta los tipos permitidos de cada clase', () => {
    expect(fileProblem('material', file('guia.pdf', 'application/pdf'))).toBeNull();
    expect(fileProblem('material', file('foto.png', 'image/png'))).toBeNull();
    expect(fileProblem('video', file('clase.mp4', 'video/mp4'))).toBeNull();
    expect(fileProblem('video', file('clase.webm', 'video/webm'))).toBeNull();
  });

  it('un video no es un material y un material no es un video', () => {
    expect(fileProblem('video', file('guia.pdf', 'application/pdf'))).toBe('Tipo de archivo no permitido: usa MP4 o WebM.');
    expect(fileProblem('material', file('clase.mp4', 'video/mp4'))).toContain('Tipo de archivo no permitido');
    expect(fileProblem('material', file('virus.exe', 'application/x-msdownload'))).toContain('Tipo de archivo no permitido');
  });

  it('respeta los máximos (50 MB un material, 2 GB un video) y no deja pasar un archivo vacío', () => {
    expect(fileProblem('material', file('a.pdf', 'application/pdf', MATERIAL_MAX_BYTES))).toBeNull();
    expect(fileProblem('material', file('a.pdf', 'application/pdf', MATERIAL_MAX_BYTES + 1))).toBe('El archivo supera el máximo de 50 MB.');
    expect(fileProblem('video', file('a.mp4', 'video/mp4', VIDEO_MAX_BYTES))).toBeNull();
    expect(fileProblem('video', file('a.mp4', 'video/mp4', VIDEO_MAX_BYTES + 1))).toBe('El archivo supera el máximo de 2048 MB.');
    expect(fileProblem('material', file('a.pdf', 'application/pdf', 0))).toBe('El archivo está vacío.');
  });

  it('deduce el tipo de la extensión cuando el sistema no lo informa', () => {
    expect(contentTypeOf({ name: 'Plan.DOCX', type: '' })).toContain('wordprocessingml');
    expect(contentTypeOf({ name: 'sin-extension', type: '' })).toBe('');
    expect(fileProblem('material', file('Plan.docx', ''))).toBeNull();
    expect(fileProblem('material', file('raro.xyz', ''))).toContain('Tipo de archivo no permitido');
  });

  it('muestra los tamaños de forma legible', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2,0 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1,5 GB');
  });
});

describe('moveInOrder', () => {
  it('sube o baja un elemento y devuelve el orden nuevo completo', () => {
    expect(moveInOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('no mueve más allá de los bordes ni un elemento que no existe', () => {
    expect(moveInOrder(['a', 'b'], 'a', -1)).toBeNull();
    expect(moveInOrder(['a', 'b'], 'b', 1)).toBeNull();
    expect(moveInOrder(['a', 'b'], 'z', 1)).toBeNull();
  });

  it('no cambia la lista original', () => {
    const ids = ['a', 'b'];
    moveInOrder(ids, 'a', 1);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('parseUnitTitle', () => {
  it('limpia espacios y exige un nombre', () => {
    expect(parseUnitTitle('  Fracciones ')).toEqual({ ok: true, value: 'Fracciones' });
    expect(parseUnitTitle('  ').ok).toBe(false);
    expect(parseUnitTitle('x'.repeat(151)).ok).toBe(false);
    expect(parseUnitTitle('x'.repeat(150)).ok).toBe(true);
  });
});

describe('parseLessonForm', () => {
  it('arma una sesión con enlace de video y materiales, e ignora las filas vacías', () => {
    const result = parseLessonForm(form({
      unitId: UNIT, title: ' Sumar fracciones ', summary: ' Con distinto denominador ', videoUrl: 'https://youtu.be/abc', isPublished: 'on',
      materialTitle: ['Guía', '', 'Ficha'], materialUrl: ['https://sitio.com/guia.pdf', '', ''], materialFileId: ['', '', FILE],
    }));
    expect(result).toEqual({
      ok: true,
      value: {
        unitId: UNIT, title: 'Sumar fracciones', summary: 'Con distinto denominador', videoUrl: 'https://youtu.be/abc', videoFileId: null,
        isPublished: true,
        materials: [{ title: 'Guía', url: 'https://sitio.com/guia.pdf', fileId: null }, { title: 'Ficha', url: null, fileId: FILE }],
      },
    });
  });

  it('sin marcar «publicada» queda en borrador, y el resumen y el video son opcionales', () => {
    const result = parseLessonForm(form({ unitId: UNIT, title: 'Sesión 1' }));
    expect(result).toEqual({ ok: true, value: { unitId: UNIT, title: 'Sesión 1', summary: null, videoUrl: null, videoFileId: null, isPublished: false, materials: [] } });
  });

  it('un video subido como archivo', () => {
    const result = parseLessonForm(form({ unitId: UNIT, title: 'S', videoFileId: FILE }));
    expect(result.ok && result.value.videoFileId).toBe(FILE);
  });

  it('exige unidad y título, y limita su largo', () => {
    const missing = parseLessonForm(form({ title: ' ' }));
    expect(!missing.ok && Object.keys(missing.fieldErrors).sort()).toEqual(['title', 'unitId']);
    const long = parseLessonForm(form({ unitId: UNIT, title: 'x'.repeat(LESSON_TITLE_MAX + 1), summary: 'y'.repeat(2001) }));
    expect(!long.ok && Object.keys(long.fieldErrors).sort()).toEqual(['summary', 'title']);
  });

  it('el video es un enlace https o un archivo, nunca los dos', () => {
    expect(parseLessonForm(form({ unitId: UNIT, title: 'S', videoUrl: 'http://sitio.com/v' })).ok).toBe(false);
    const both = parseLessonForm(form({ unitId: UNIT, title: 'S', videoUrl: 'https://sitio.com/v', videoFileId: FILE }));
    expect(!both.ok && both.fieldErrors.video).toContain('no los dos');
    expect(parseLessonForm(form({ unitId: UNIT, title: 'S', videoFileId: 'no-es-id' })).ok).toBe(false);
  });

  it('cada material necesita título y un enlace o un archivo, y el error dice cuál', () => {
    const noTitle = parseLessonForm(form({ unitId: UNIT, title: 'S', materialTitle: ['Guía', ''], materialUrl: ['https://sitio.com/g', 'https://sitio.com/h'], materialFileId: ['', ''] }));
    expect(!noTitle.ok && noTitle.fieldErrors.materials).toBe('Material 2: escribe su título.');
    const nothing = parseLessonForm(form({ unitId: UNIT, title: 'S', materialTitle: ['Guía'], materialUrl: [''], materialFileId: [''] }));
    expect(!nothing.ok && nothing.fieldErrors.materials).toBe('Material 1: pon un enlace o sube un archivo.');
    const both = parseLessonForm(form({ unitId: UNIT, title: 'S', materialTitle: ['Guía'], materialUrl: ['https://sitio.com/g'], materialFileId: [FILE] }));
    expect(!both.ok && both.fieldErrors.materials).toBe('Material 1: es un enlace o un archivo, no los dos.');
    const http = parseLessonForm(form({ unitId: UNIT, title: 'S', materialTitle: ['Guía'], materialUrl: ['http://sitio.com/g'], materialFileId: [''] }));
    expect(!http.ok && http.fieldErrors.materials).toBe('Material 1: el enlace debe ser https:// válido.');
  });

  it('limita la cantidad de materiales (igual que el backend)', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `Material ${i}`);
    const make = (n: number) => parseLessonForm(form({
      unitId: UNIT, title: 'S', materialTitle: rows(n), materialUrl: rows(n).map((_, i) => `https://sitio.com/${i}`), materialFileId: rows(n).map(() => ''),
    }));
    expect(make(MAX_MATERIALS).ok).toBe(true);
    const over = make(MAX_MATERIALS + 1);
    expect(!over.ok && over.fieldErrors.materials).toContain('como máximo 20');
  });
});
