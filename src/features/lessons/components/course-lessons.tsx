'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/features/content/rules';
import type { ContentLesson, StudentCourseContent } from '@/types/content';
import { isPlayableVideo, pickLesson } from '../rules';
import styles from './course-lessons.module.css';

// Lecciones reales del alumno (SCRUM-56): selector Matemáticas / Laboratorio y, por sesión, las pestañas
// «Clase grabada · Práctica · Materiales». Todo llega ya filtrado por el backend (solo sesiones publicadas de
// cursos con matrícula activa); aquí solo se muestra. El video es <video preload="none">: no descarga nada hasta dar play.

export function CourseLessons({ courses, initialCourseId }: { courses: StudentCourseContent[]; initialCourseId: string }) {
  const [courseId, setCourseId] = useState(initialCourseId);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const course = courses.find((item) => item.courseId === courseId) ?? courses[0];
  const lesson = pickLesson(course, lessonId);

  return (
    <div className="stack">
      {courses.length > 1 && (
        <div className={styles.courses} role="group" aria-label="Elegir ruta">
          {courses.map((item) => (
            <button key={item.courseId} type="button" aria-pressed={item.courseId === course.courseId}
              className={cn(styles.course, item.kind === 'math' ? styles.math : styles.lab)}
              onClick={() => { setCourseId(item.courseId); setLessonId(null); }}>
              <span>{item.kind === 'math' ? 'Matemáticas' : 'Laboratorio'}</span>
              <small>{item.levelLabel ?? item.courseTitle}</small>
            </button>
          ))}
        </div>
      )}

      <div className={styles.layout}>
        <nav className={styles.units} aria-label="Temario del curso">
          {course.content.units.filter((unit) => unit.lessons.length > 0).map((unit) => (
            <section key={unit.id} className={styles.unit}>
              <h3>{unit.title}</h3>
              <div className={styles.list}>
                {unit.lessons.map((item) => (
                  <button key={item.id} type="button" className={styles.item} aria-current={item.id === lesson?.id}
                    onClick={() => setLessonId(item.id)}>
                    <b>{item.number}</b>{item.title}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {lesson && <LessonView key={lesson.id} course={course} lesson={lesson} />}
      </div>
    </div>
  );
}

function LessonView({ course, lesson }: { course: StudentCourseContent; lesson: ContentLesson }) {
  const unit = course.content.units.find((item) => item.id === lesson.unitId);
  return (
    <article>
      <header className={styles.head}>
        <small>{unit?.title} · Sesión {lesson.number}</small>
        <h2>{lesson.title}</h2>
        {lesson.summary && <p className={styles.summary}>{lesson.summary}</p>}
      </header>
      <Tabs
        label="Contenido de la lección"
        variant="folder"
        items={[
          { id: 'clase', label: '1 · Clase grabada', panel: <Recording lesson={lesson} /> },
          { id: 'practica', label: '2 · Práctica', panel: <PracticeLink lesson={lesson} /> },
          { id: 'materiales', label: `Materiales${lesson.materials.length ? ` (${lesson.materials.length})` : ''}`, panel: <Materials lesson={lesson} /> },
        ]}
      />
    </article>
  );
}

function Recording({ lesson }: { lesson: ContentLesson }) {
  if (!lesson.videoUrl) return <p className={styles.empty}>La grabación de esta clase aún no está disponible.</p>;
  if (isPlayableVideo(lesson)) {
    return <video className={styles.video} src={lesson.videoUrl} controls playsInline preload="none" aria-label={`Grabación: ${lesson.title}`} />;
  }
  return (
    <p>
      <a className="btn btn--primary" href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Ver la clase grabada</a>
    </p>
  );
}

function PracticeLink({ lesson }: { lesson: ContentLesson }) {
  return (
    <div className="card">
      <p>Resuelve los ejercicios de esta lección. Se corrigen al momento y te explican el porqué.</p>
      <p><Link className="btn btn--primary" href={`/lecciones/practica/${lesson.id}`}>Practicar esta lección</Link></p>
    </div>
  );
}

function Materials({ lesson }: { lesson: ContentLesson }) {
  if (lesson.materials.length === 0) return <p className={styles.empty}>Esta sesión no tiene materiales.</p>;
  return (
    <ul role="list" className="stack">
      {lesson.materials.map((material) => (
        <li key={material.id} className="card">
          <span aria-hidden="true">📄</span> {material.title}
          {material.size ? <small> · {formatBytes(material.size)}</small> : null}
          {material.url
            ? <> <a className="link" href={material.url} target="_blank" rel="noopener noreferrer">Abrir</a></>
            : <small> · no disponible por ahora</small>}
        </li>
      ))}
    </ul>
  );
}
