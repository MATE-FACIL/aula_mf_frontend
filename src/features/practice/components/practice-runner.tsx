'use client';

import Link from 'next/link';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import type { LessonPractice, PracticeProgress } from '@/types/practice';
import { answerPracticeAction } from '../actions';
import { answerFormatError, firstPending, PRACTICE_ANSWER_MAX, progressLabel } from '../answer';
import styles from './practice.module.css';

// Pantalla de práctica (SCRUM-61, prototipo B): un ejercicio a la vez, el servidor corrige y recién entonces llega
// la explicación. Retoma en el primer ejercicio sin resolver. Una petición por respuesta; nada más.

type Status = 'idle' | 'right' | 'wrong';

interface ExerciseState {
  status: Status;
  solved: boolean;
  attempts: number;
  explanation: string | null;
  /** Mensaje de formato o de error del servidor (no cuenta como intento). */
  message: string;
}

export function PracticeRunner({ practice, backHref }: { practice: LessonPractice; backHref: string }) {
  const { exercises } = practice;
  const [index, setIndex] = useState(() => firstPending(exercises));
  const [finished, setFinished] = useState(() => exercises.length > 0 && exercises.every((e) => e.solved));
  const [progress, setProgress] = useState<PracticeProgress>(practice.progress);
  const [state, setState] = useState<Record<string, ExerciseState>>(() =>
    Object.fromEntries(exercises.map((e) => [e.id, { status: 'idle', solved: e.solved, attempts: e.attempts, explanation: null, message: '' }])));
  const [choice, setChoice] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const exercise = exercises[index];
  const current = exercise ? state[exercise.id] : undefined;
  const patch = (id: string, value: Partial<ExerciseState>) => setState((all) => ({ ...all, [id]: { ...all[id], ...value } }));

  const move = (to: number) => {
    setIndex(to);
    setChoice('');
    if (exercise) patch(exercise.id, { status: 'idle', message: '' });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const goNext = () => (index + 1 >= exercises.length ? setFinished(true) : move(index + 1));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!exercise || !current || pending) return;
    const answer = exercise.kind === 'multiple_choice' ? choice : (inputRef.current?.value ?? '');
    const formatError = answerFormatError(exercise, answer);
    if (formatError) {
      patch(exercise.id, { message: formatError });
      return;
    }
    startTransition(async () => {
      const result = await answerPracticeAction(exercise.id, answer.trim());
      if (!result.ok) {
        patch(exercise.id, { message: result.error });
        return;
      }
      const { isCorrect, explanation, lessonProgress, attempts } = result.data;
      setProgress(lessonProgress);
      patch(exercise.id, {
        status: isCorrect ? 'right' : 'wrong',
        solved: current.solved || isCorrect,
        attempts,
        explanation,
        message: '',
      });
      if (isCorrect) requestAnimationFrame(() => nextRef.current?.focus());
    });
  };

  if (exercises.length === 0) {
    return <p className={styles.empty}>Esta lección todavía no tiene ejercicios. <Link className="link" href={backHref}>Volver a mis prácticas</Link></p>;
  }

  return (
    <section className={styles.practice} aria-labelledby="practice-title">
      <header className={styles.head}>
        <h2 id="practice-title">{practice.lessonTitle}</h2>
        <p className={styles.progressText} aria-live="polite">{progressLabel(progress)}</p>
      </header>
      <ProgressBar value={progress.percent ?? 0} label="Avance de la lección" />

      <ol role="list" className={styles.steps} aria-label="Ejercicios de la lección">
        {exercises.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              className={cn(styles.step, state[e.id]?.solved && styles.stepDone, i === index && !finished && styles.stepCurrent)}
              aria-current={i === index && !finished ? 'step' : undefined}
              onClick={() => { setFinished(false); move(i); }}
            >
              <span className="visually-hidden">Ejercicio </span>{i + 1}
              <span className="visually-hidden">{state[e.id]?.solved ? ', resuelto' : ''}</span>
            </button>
          </li>
        ))}
      </ol>

      {finished ? (
        <div className={styles.done} role="status">
          <p className={styles.doneTitle}>¡Práctica terminada! 🎉</p>
          <p>{progressLabel(progress)}. Tu profesor ve tu avance antes de la próxima clase.</p>
          <div className={styles.doneActions}>
            <button type="button" className="btn btn--sm" onClick={() => { setFinished(false); move(0); }}>Repasar desde el inicio</button>
            <Link className="btn btn--sm btn--primary" href={backHref}>Volver a mis prácticas</Link>
          </div>
        </div>
      ) : exercise && current && (
        <form
          key={exercise.id}
          className={cn(styles.exercise, current.status === 'right' && styles.right, current.status === 'wrong' && styles.wrong)}
          onSubmit={submit}
          noValidate
        >
          <p className={styles.num}>
            Ejercicio {index + 1} de {exercises.length}
            {current.solved && <span className={styles.solvedTag}>Resuelto</span>}
          </p>

          {exercise.kind === 'multiple_choice' ? (
            <fieldset className={styles.options} disabled={current.status === 'right'}>
              <legend className={styles.prompt}>{exercise.prompt}</legend>
              {exercise.options.map((option, i) => (
                <label key={i} className={styles.option}>
                  <input
                    type="radio"
                    name={`answer-${exercise.id}`}
                    value={String(i)}
                    checked={choice === String(i)}
                    onChange={() => { setChoice(String(i)); if (current.status === 'wrong' || current.message) patch(exercise.id, { status: 'idle', message: '' }); }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              <label className={styles.prompt} htmlFor={`answer-${exercise.id}`}>{exercise.prompt}</label>
              <input
                ref={inputRef}
                id={`answer-${exercise.id}`}
                className={styles.input}
                autoComplete="off"
                inputMode="decimal"
                placeholder="Ej.: 3,5"
                maxLength={PRACTICE_ANSWER_MAX}
                disabled={current.status === 'right'}
                aria-describedby={`feedback-${exercise.id}`}
                onInput={() => (current.status === 'wrong' || current.message) && patch(exercise.id, { status: 'idle', message: '' })}
              />
            </>
          )}

          <div className={styles.row}>
            {current.status === 'right' ? (
              <button ref={nextRef} type="button" className={cn('btn btn--dark', styles.wide)} onClick={goNext}>
                {index < exercises.length - 1 ? 'Siguiente ejercicio →' : 'Terminar práctica'}
              </button>
            ) : (
              <>
                <button type="submit" className={cn('btn btn--primary', styles.wide)} disabled={pending} aria-busy={pending}>
                  {pending ? 'Revisando…' : 'Comprobar'}
                </button>
                {current.status === 'wrong' && (
                  <button type="button" className="btn" onClick={goNext}>
                    {index < exercises.length - 1 ? 'Pasar al siguiente' : 'Terminar'}
                  </button>
                )}
              </>
            )}
          </div>

          <div id={`feedback-${exercise.id}`} className={styles.feedback} aria-live="polite">
            {current.message ? (
              <p className={styles.message}>{current.message}</p>
            ) : current.status === 'right' ? (
              <p className={styles.verdict}>¡Correcto! ✅</p>
            ) : current.status === 'wrong' ? (
              <p className={styles.verdict}>Todavía no. Revisa la explicación e inténtalo otra vez.</p>
            ) : null}
            {current.status !== 'idle' && current.explanation && (
              <div className={styles.explanation}>
                <b>Explicación</b>
                <p>{current.explanation}</p>
              </div>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
