import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { EvaluationSummary } from '@/types/domain';
import styles from './assessments.module.css';

/** Lista de evaluaciones (la usan el alumno y el panel de la familia). */
export function EvaluationList({ items, renderAction }: { items: EvaluationSummary[]; renderAction?: (e: EvaluationSummary) => ReactNode }) {
  return (
    <ul role="list" className={styles.list}>
      {items.map((e) => (
        <li key={e.id} className={cn(styles.item, e.status === 'available' && styles.itemAvailable)}>
          <span className={styles.kind}>{e.kind}</span>
          <div className={styles.text}>
            <b>{e.topic}</b>
            <small>{e.dateLabel} · {e.resultLabel}</small>
          </div>
          {e.score !== null ? (
            <span className={styles.score}>{e.score} %</span>
          ) : (
            renderAction?.(e) ?? <span className={styles.upcoming}>{e.status === 'available' ? 'Por rendir' : e.status === 'missed' ? 'Sin rendir' : 'Próxima'}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
