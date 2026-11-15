import Link from 'next/link';
import type { CSSProperties } from 'react';
import { AREA_COLOR } from '@/config/areas';
import { cn } from '@/lib/cn';
import { MATH_LEVELS, type ClassFrequency, type LessonSummary, type MathLevel, type MonthlyLab } from '@/types/domain';
import styles from './learning.module.css';

// Piezas de la ruta de aprendizaje (Server Components, sin JavaScript en el navegador).

/** Los 4 niveles de Matemáticas (curso pivote): dónde empezó (prueba de entrada) y dónde está hoy. */
export function MathLevels({ level, startLevel, progress }: { level: MathLevel | null; startLevel?: MathLevel | null; progress?: number }) {
  if (!level) return <p className={styles.note}>Los niveles de Matemáticas de primaria están en definición.</p>;
  const current = MATH_LEVELS.indexOf(level);
  return (
    <ol role="list" className={styles.levels} aria-label="Niveles de Matemáticas de secundaria">
      {MATH_LEVELS.map((name, i) => (
        <li key={name} className={cn(styles.level, i < current && styles.levelDone, i === current && styles.levelCurrent)} aria-current={i === current ? 'step' : undefined}>
          <b>{name}</b>
          {i === current && progress !== undefined && <small>{progress} % del nivel</small>}
          {name === startLevel && i !== current && <small>Empezó aquí</small>}
        </li>
      ))}
    </ol>
  );
}

export function FrequencyList({ items }: { items: ClassFrequency[] }) {
  return (
    <ul role="list" className={styles.frequency}>
      {items.map((f) => (
        <li key={f.course} className={f.track === 'math' ? styles.freqMath : styles.freqLab}>
          <b>{f.course}</b>
          <span>{f.detail}</span>
          <small>{f.days}</small>
        </li>
      ))}
    </ul>
  );
}

const LAB_STATUS = { done: '✓ Completado', current: '● Este mes', upcoming: 'Próximo' } as const;

export function MonthlyLabs({ labs }: { labs: MonthlyLab[] }) {
  return (
    <ol role="list" className={styles.labs}>
      {labs.map((lab) => (
        <li key={lab.month} className={cn(styles.lab, styles[`lab_${lab.status}`])} style={{ '--c': AREA_COLOR[lab.area] } as CSSProperties}>
          <span className={styles.labMonth}>{lab.month}</span>
          <span className={styles.labArea}>{lab.area}</span>
          <b>{lab.name}</b>
          <small>{LAB_STATUS[lab.status]}</small>
        </li>
      ))}
    </ol>
  );
}

/** Lista de lecciones de una unidad o módulo con su estado y estrellas. */
export function LessonList({ lessons, color, href = '/lecciones' }: { lessons: LessonSummary[]; color: string; href?: string }) {
  return (
    <ol role="list" className={styles.lessons} style={{ '--c': color } as CSSProperties}>
      {lessons.map((l, i) => (
        <li key={l.id} className={cn(styles.lesson, styles[`lesson_${l.status}`])}>
          <span className={styles.lessonNum} aria-hidden="true">{l.status === 'done' ? '✓' : l.status === 'locked' ? '🔒' : i + 1}</span>
          <div className={styles.lessonText}>
            {l.status === 'current' || l.status === 'open' ? <Link href={href}><b>{l.title}</b></Link> : <b>{l.title}</b>}
            <small>
              {l.duration}
              {l.status === 'done' && l.stars ? ` · ${'⭐'.repeat(l.stars)}` : ''}
              {l.status === 'locked' ? ' · se desbloquea al terminar la anterior' : ''}
            </small>
          </div>
          {l.status === 'current' && <Link className={styles.lessonGo} href={href}>Continuar</Link>}
        </li>
      ))}
    </ol>
  );
}
