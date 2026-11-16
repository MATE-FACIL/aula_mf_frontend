'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useCountdown } from '@/hooks/use-countdown';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/time';
import type { QuizAnswers, QuizAttempt, QuizResult } from '@/types/domain';
import { submitEvaluationAction } from '../actions';
import styles from './assessments.module.css';

// Evaluación con LÍMITE DE TIEMPO:
// - El servidor fija el plazo (deadline) y vuelve a validarlo al recibir las respuestas.
// - Cuenta regresiva con aviso en el último minuto; al llegar a 0 se envía sola.
// - Las respuestas se guardan en estado local (sin peticiones por cada tecla).
// - Si el alumno intenta cerrar la pestaña a mitad de la prueba, el navegador le avisa.

const WARNING_SEC = 60;

interface Props {
  attempt: QuizAttempt;
  receivedAt: number;
  clockOffsetMs: number;
  onFinished: (result: QuizResult) => void;
}

export function TimedQuiz({ attempt, receivedAt, clockOffsetMs, onFinished }: Props) {
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const send = useCallback((auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      const response = await submitEvaluationAction(attempt.attemptId, answersRef.current);
      if (!response.ok) {
        submittedRef.current = false;
        setError(auto ? `Se acabó el tiempo, pero no pudimos enviar: ${response.error}` : response.error);
        return;
      }
      setResult(response.data);
      onFinished(response.data);
    });
  }, [attempt.attemptId, onFinished]);

  const { remainingSec } = useCountdown({
    deadlineMs: new Date(attempt.deadline).getTime(),
    initialNow: receivedAt,
    clockOffsetMs,
    enabled: !result,
    onExpire: () => send(true),
  });

  // Aviso al salir solo mientras la prueba está en curso.
  useEffect(() => {
    if (result) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [result]);

  const setAnswer = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }));
  const answered = Object.values(answers).filter((v) => v.trim()).length;
  const locked = !!result || pending;
  const byId = new Map(result?.questions.map((q) => [q.questionId, q]));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(false);
  };

  return (
    <form className={cn('card', styles.quiz)} onSubmit={onSubmit} noValidate aria-labelledby="quiz-title">
      <header className={styles.quizHead}>
        <h3 id="quiz-title">{attempt.title}</h3>
        {!result && (
          <span className={cn(styles.clock, remainingSec <= WARNING_SEC && styles.clockWarning)} role="timer" aria-live={remainingSec <= WARNING_SEC ? 'assertive' : 'off'}>
            ⏱ {formatClock(remainingSec)}
          </span>
        )}
      </header>
      <p className={styles.notice}>
        Tienes {Math.round(attempt.durationSec / 60)} minutos. Calificación automática; al terminar el tiempo se envía sola. El tutor IA se pausa durante la evaluación.
      </p>
      {!result && remainingSec <= WARNING_SEC && remainingSec > 0 && (
        <p className={styles.warning} role="alert">¡Queda menos de un minuto! Revisa y envía.</p>
      )}

      {attempt.questions.map((q, i) => {
        const graded = byId.get(q.id);
        return (
          <fieldset key={q.id} className={cn(styles.question, graded && (graded.correct ? styles.right : styles.wrong))} disabled={locked}>
            <legend><span>{i + 1}.</span> {q.text}</legend>
            {q.type === 'choice' ? (
              <div className={styles.options}>
                {q.options.map((option, j) => (
                  <label key={option} className={answers[q.id] === String(j) ? styles.optionChecked : undefined}>
                    <input type="radio" name={q.id} value={j} checked={answers[q.id] === String(j)} onChange={() => setAnswer(q.id, String(j))} />
                    {option}
                  </label>
                ))}
              </div>
            ) : (
              <input
                className={cn('input', styles.answer)}
                name={q.id}
                autoComplete="off"
                inputMode={q.type === 'number' ? 'decimal' : 'text'}
                aria-label={`Respuesta ${i + 1}`}
                placeholder={q.type === 'fraction' ? 'Ej.: 3/4' : 'Ej.: 8'}
                maxLength={20}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}
            {graded && <p className={styles.explanation}>{graded.correct ? '✓ ' : '✗ Solución: '}{graded.explanation}</p>}
          </fieldset>
        );
      })}

      {error && <p className={styles.warning} role="alert">{error}</p>}

      {result ? (
        <div className={styles.result} aria-live="polite">
          <b className={styles.resultScore}>{result.score} %</b>
          <span>{result.correctCount} de {result.total} correctas · {String(result.points).replace('.', ',')} de 20 puntos</span>
          {result.late && <span className={styles.lateTag}>Enviada fuera de tiempo: tu profesor lo verá en el registro.</span>}
          <ul>
            {result.byCompetency.map((c) => <li key={c.competency}><b>{c.competency}</b>: {c.correct} de {c.total}</li>)}
          </ul>
          <small>La nota se guarda en tu historial y la ve tu familia. Repasa las explicaciones de cada pregunta.</small>
        </div>
      ) : (
        <div className={styles.submitRow}>
          <span className="muted small">{answered} de {attempt.questions.length} respondidas</span>
          <button className="btn btn--primary btn--lg" type="submit" disabled={pending}>
            {pending ? 'Calificando…' : 'Enviar y calificar'}
          </button>
        </div>
      )}
    </form>
  );
}
