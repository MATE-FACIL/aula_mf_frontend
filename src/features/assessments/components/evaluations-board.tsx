'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { Kpi } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { EvaluationSummary, MathLevel, QuizAttempt, QuizResult } from '@/types/domain';
import { useStudySession } from '@/features/lessons/study-session';
import { startEvaluationAction } from '../actions';
import { EvaluationList } from './evaluation-list';
import { TimedQuiz } from './timed-quiz';
import styles from './assessments.module.css';

// Módulo de evaluación: prueba de entrada + semanales con calificación automática y resultado por competencia.

interface Props {
  initial: EvaluationSummary[];
  startLevel: MathLevel | null;
  currentLevel: MathLevel | null;
}

interface ActiveAttempt {
  evaluationId: string;
  attempt: QuizAttempt;
  receivedAt: number;
  clockOffsetMs: number;
}

export function EvaluationsBoard({ initial, startLevel, currentLevel }: Props) {
  const session = useStudySession();
  const { notify } = useToast();
  const [evaluations, setEvaluations] = useState(initial);
  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [pending, startTransition] = useTransition();
  const quizRef = useRef<HTMLDivElement>(null);

  const weekly = evaluations.filter((e) => e.kind === 'Semanal' && e.score !== null);
  const average = weekly.length ? Math.round(weekly.reduce((a, e) => a + (e.score ?? 0), 0) / weekly.length) : null;
  const pendingCount = evaluations.filter((e) => e.status === 'available').length;

  const start = (evaluationId: string) =>
    startTransition(async () => {
      const result = await startEvaluationAction(evaluationId);
      if (!result.ok) {
        notify(result.error, 'error');
        return;
      }
      const receivedAt = Date.now();
      setActive({ evaluationId, attempt: result.data.attempt, receivedAt, clockOffsetMs: result.data.serverNow - receivedAt });
      session.emit({ type: 'evaluation-started' });
      requestAnimationFrame(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });

  const finished = useCallback((result: QuizResult) => {
    setEvaluations((list) =>
      list.map((e) => (e.id === active?.evaluationId ? { ...e, status: 'graded', score: result.score, resultLabel: `${String(result.points).replace('.', ',')} de 20 puntos`, dateLabel: 'Hoy' } : e)),
    );
    session.emit({ type: 'evaluation-finished', score: result.score });
    notify(`Evaluación calificada: ${result.score} %`, 'success');
  }, [active?.evaluationId, notify, session]);

  return (
    <div className={styles.board}>
      <div className="grid-3">
        <Kpi label="Promedio semanales" value={average === null ? '—' : `${average} %`} hint={`${weekly.length} evaluaciones calificadas`} />
        <Kpi label="Prueba de entrada" value={startLevel ?? '—'} hint={currentLevel ? `Hoy está en ${currentLevel}` : 'Niveles en definición'} />
        <Kpi label="Pendientes" value={pendingCount} hint={pendingCount ? 'Semanal de esta semana' : '¡Todo al día!'} />
      </div>

      <EvaluationList
        items={evaluations}
        renderAction={(e) =>
          e.status === 'available' && !active ? (
            <button type="button" className="btn btn--primary" onClick={() => start(e.id)} disabled={pending}>
              {pending ? 'Preparando…' : 'Rendir ahora'}
            </button>
          ) : undefined
        }
      />

      {active && (
        <div ref={quizRef} className={styles.quizAnchor}>
          <TimedQuiz attempt={active.attempt} receivedAt={active.receivedAt} clockOffsetMs={active.clockOffsetMs} onFinished={finished} />
        </div>
      )}
    </div>
  );
}
