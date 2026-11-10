'use client';

import Link from 'next/link';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { ProgressBar } from '@/components/ui/primitives';
import { answerFormatError, PRACTICE_ANSWER_MAX } from '@/features/practice/answer';
import { cn } from '@/lib/cn';
import type { DiagnosticResult as Result, StudentDiagnostic } from '@/types/diagnostic';
import { answerDiagnosticAction } from '../actions';
import { answeredLabel, firstUnanswered } from '../rules';
import { DiagnosticResult } from './diagnostic-result';
import styles from './diagnostic.module.css';

// Pantalla del diagnóstico (SCRUM-49, prototipo B): una pregunta a la vez, barra de avance y resultado al final.
// Es una prueba de ubicación: no dice si acertó, y cada pregunta se responde una sola vez. Retoma donde quedó.
// Una petición por respuesta; nada más.

export function DiagnosticRunner({ diagnostic, backHref }: { diagnostic: StudentDiagnostic; backHref: string }) {
  const { questions, total } = diagnostic;
  const [answered, setAnswered] = useState(() => new Set(questions.filter((q) => q.answered).map((q) => q.id)));
  const [index, setIndex] = useState(() => firstUnanswered(questions));
  const [result, setResult] = useState<Result | null>(diagnostic.result);
  const [choice, setChoice] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const question = questions[index];
  const percent = total === 0 ? 0 : (answered.size * 100) / total;

  const send = (answer: string, skip: boolean) => {
    if (!question || pending) return;
    startTransition(async () => {
      const response = await answerDiagnosticAction(diagnostic.attemptId, question.id, answer, skip);
      if (!response.ok) {
        setMessage(response.error);
        return;
      }
      const next = new Set(answered).add(question.id);
      setAnswered(next);
      setChoice('');
      setMessage('');
      if (response.data.completed) {
        setResult(response.data.result);
        return;
      }
      const pendingIndex = questions.findIndex((q, i) => i > index && !next.has(q.id));
      setIndex(pendingIndex === -1 ? questions.findIndex((q) => !next.has(q.id)) : pendingIndex);
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question) return;
    const answer = question.kind === 'multiple_choice' ? choice : (inputRef.current?.value ?? '');
    const formatError = answerFormatError(question, answer);
    if (formatError) {
      setMessage(formatError);
      return;
    }
    send(answer.trim(), false);
  };

  if (result) {
    return (
      <section className={styles.runner} aria-labelledby="result-title">
        <header className={styles.head}>
          <h2 id="result-title">¡Terminaste el diagnóstico de {diagnostic.stageLabel.toLowerCase()}! 🎉</h2>
        </header>
        <DiagnosticResult result={result} audience="student" />
        <Link className="btn" href={backHref}>Volver</Link>
      </section>
    );
  }

  if (!question) {
    return <p className="muted">Este diagnóstico no tiene preguntas. <Link className="link" href={backHref}>Volver</Link></p>;
  }

  return (
    <section className={styles.runner} aria-labelledby="diagnostic-title">
      <header className={styles.head}>
        <h2 id="diagnostic-title">Diagnóstico de {diagnostic.stageLabel.toLowerCase()}</h2>
        <p className={styles.count} aria-live="polite">{answeredLabel(answered.size, total)}</p>
      </header>
      <ProgressBar value={percent} label="Avance del diagnóstico" />

      <form key={question.id} className={styles.question} onSubmit={submit} noValidate>
        <p className={styles.topic}>Pregunta {index + 1} de {total} · {question.topic}</p>

        {question.kind === 'multiple_choice' ? (
          <fieldset className={styles.options}>
            <legend className={styles.prompt}>{question.prompt}</legend>
            {question.options.map((option, i) => (
              <label key={i} className={styles.option}>
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  value={String(i)}
                  checked={choice === String(i)}
                  onChange={() => { setChoice(String(i)); setMessage(''); }}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label className={styles.prompt} htmlFor={`answer-${question.id}`}>{question.prompt}</label>
            <input
              ref={inputRef}
              id={`answer-${question.id}`}
              className={styles.input}
              autoComplete="off"
              inputMode="decimal"
              placeholder="Ej.: 3,5"
              maxLength={PRACTICE_ANSWER_MAX}
              aria-describedby={`message-${question.id}`}
              onInput={() => message && setMessage('')}
            />
          </>
        )}

        <div className={styles.row}>
          <button type="submit" className={cn('btn btn--primary', styles.wide)} disabled={pending} aria-busy={pending}>
            {pending ? 'Guardando…' : answered.size + 1 >= total ? 'Responder y terminar' : 'Responder y seguir'}
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => send('', true)}>No lo sé</button>
        </div>
        <p id={`message-${question.id}`} className={styles.message} aria-live="polite">{message}</p>
        <p className={styles.hint}>Responde con calma: no es un examen con nota. Si no sabes, elige «No lo sé»; así ubicamos mejor tu nivel.</p>
      </form>
    </section>
  );
}
