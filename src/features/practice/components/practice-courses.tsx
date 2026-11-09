import Link from 'next/link';
import { EmptyState, ProgressBar } from '@/components/ui/primitives';
import type { PracticeCourse } from '@/types/practice';
import { progressLabel } from '../answer';
import styles from './practice.module.css';

// Mis prácticas (SCRUM-60/61): cada curso con matrícula activa, su avance total y el de cada lección publicada.
// Componente de servidor: no agrega JavaScript al navegador.

export function PracticeCourses({ courses }: { courses: PracticeCourse[] }) {
  if (courses.length === 0) {
    return <EmptyState>Todavía no tienes cursos activos. Cuando tu matrícula esté confirmada, aquí verás tus prácticas.</EmptyState>;
  }
  return (
    <div className={styles.courses}>
      {courses.map((course) => (
        <section key={course.courseId} className={`card ${styles.course}`} aria-labelledby={`course-${course.courseId}`}>
          <div className={styles.courseHead}>
            <h2 id={`course-${course.courseId}`}>{course.courseTitle}</h2>
            <p>{[course.levelLabel, course.offeringName].filter(Boolean).join(' · ')}</p>
          </div>
          <ProgressBar value={course.progress.percent ?? 0} label={`Avance en ${course.courseTitle}`} />
          <p className={styles.progressText}>{progressLabel(course.progress)}</p>
          {course.lessons.length === 0 ? (
            <EmptyState>Tu profesor todavía no publicó lecciones en este curso.</EmptyState>
          ) : (
            <ol className={styles.lessons}>
              {course.lessons.map((lesson) => {
                const { total, solved } = lesson.progress;
                return (
                  <li key={lesson.lessonId} className={styles.lesson}>
                    <b>{lesson.title}</b>
                    <small>{progressLabel(lesson.progress)}</small>
                    {total > 0 && (
                      <Link className={`btn btn--sm ${solved === total ? '' : 'btn--primary'}`} href={`/lecciones/practica/${lesson.lessonId}`}>
                        {solved === 0 ? 'Empezar' : solved === total ? 'Repasar' : 'Continuar'}
                        <span className="visually-hidden"> {lesson.title}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
