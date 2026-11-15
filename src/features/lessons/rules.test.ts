import { describe, expect, it } from 'vitest';
import type { CourseContent, StudentCourseContent } from '@/types/content';
import { firstLesson, initialCourse, isPlayableVideo, pickLesson } from './rules';

const lesson = (id: string, extra = {}) => ({ id, unitId: 'u', number: 1, title: id, summary: null, videoUrl: null, videoFileId: null, videoContentType: null, isPublished: true, materials: [], ...extra });
const course = (kind: 'math' | 'lab', ids: string[]): StudentCourseContent => ({
  courseId: kind, courseTitle: kind, offeringName: 'G', kind, levelLabel: null,
  content: { courseId: kind, courseTitle: kind, units: [{ id: 'u', title: 'U', position: 1, lessons: ids.map((id) => lesson(id)) }] } satisfies CourseContent,
});

describe('isPlayableVideo', () => {
  it('reproduce archivos propios y enlaces directos a MP4/WebM, y no YouTube', () => {
    expect(isPlayableVideo(lesson('a', { videoUrl: 'https://s.com/v?sig=1', videoFileId: 'f', videoContentType: 'video/mp4' }))).toBe(true);
    expect(isPlayableVideo(lesson('a', { videoUrl: 'https://s.com/clase.MP4?x=1' }))).toBe(true);
    expect(isPlayableVideo(lesson('a', { videoUrl: 'https://www.youtube.com/watch?v=1' }))).toBe(false);
    expect(isPlayableVideo(lesson('a'))).toBe(false);
    expect(isPlayableVideo(lesson('a', { videoUrl: 'no es url' }))).toBe(false);
  });
});

describe('selección de curso y sesión', () => {
  const courses = [course('lab', ['l1']), course('math', ['m1', 'm2'])];

  it('Matemáticas por defecto, el laboratorio si se pide y el primero si falta el tipo', () => {
    expect(initialCourse(courses, undefined)?.kind).toBe('math');
    expect(initialCourse(courses, 'lab')?.kind).toBe('lab');
    expect(initialCourse([course('lab', ['l1'])], undefined)?.kind).toBe('lab');
    expect(initialCourse([], 'lab')).toBeNull();
  });

  it('pide una sesión o cae en la primera si no es del curso', () => {
    expect(pickLesson(courses[1], 'm2')?.id).toBe('m2');
    expect(pickLesson(courses[1], 'otra')?.id).toBe('m1');
    expect(pickLesson(courses[1], null)?.id).toBe('m1');
    expect(firstLesson(courses[0])?.id).toBe('l1');
  });
});
