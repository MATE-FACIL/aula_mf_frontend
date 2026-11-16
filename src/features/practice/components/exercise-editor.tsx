'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { useResultToast } from '@/features/admin/components/action-form';
import type { Competency } from '@/types/evaluations';
import type { ExerciseAdmin, ExerciseKind } from '@/types/practice';
import { saveExercisesAction } from '../editor-actions';
import {
  blankDraft, MAX_EXERCISES, MAX_EXPLANATION, MAX_OPTION, MAX_OPTIONS, MAX_PROMPT, MIN_OPTIONS, removeOption, toDrafts, toInputs,
  validateDrafts, type ExerciseDraft,
} from '../editor-rules';
import styles from './exercise-editor.module.css';

// Editor de los ejercicios de una sesión (SCRUM-59), para el administrador y para el profesor del curso. El estado vive
// en el navegador y se envía de una vez, como una lista ordenada: así lo escrito no se pierde si hay un error. Al
// guardar, la página se vuelve a pedir y el editor se monta de nuevo con lo guardado (con sus identificadores).

const KIND_LABEL: Record<ExerciseKind, string> = { multiple_choice: 'Opción múltiple', numeric: 'Respuesta numérica' };

export function ExerciseEditor({ scope, courseId, lessonId, exercises }: {
  scope: 'admin' | 'teacher';
  courseId: string;
  lessonId: string;
  exercises: ExerciseAdmin[];
}) {
  const [drafts, setDrafts] = useState<ExerciseDraft[]>(() => toDrafts(exercises));
  const [problems, setProblems] = useState<Record<number, string>>({});
  const [state, formAction, saving] = useActionState(saveExercisesAction, {});
  useResultToast(state);

  const change = (index: number, patch: Partial<ExerciseDraft>) =>
    setDrafts((all) => all.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, direction: -1 | 1) =>
    setDrafts((all) => {
      const to = index + direction;
      if (to < 0 || to >= all.length) return all;
      const next = [...all];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateDrafts(drafts);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const data = new FormData();
    data.set('scope', scope);
    data.set('courseId', courseId);
    data.set('lessonId', lessonId);
    data.set('exercises', JSON.stringify(toInputs(drafts)));
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={submit} className={styles.editor} noValidate>
      {drafts.length === 0 && <p className={styles.empty}>Esta sesión todavía no tiene ejercicios. Agrega el primero.</p>}
      <div className={styles.list}>
        {drafts.map((draft, index) => (
          <ExerciseCard key={draft.key} draft={draft} index={index} count={drafts.length} problem={problems[index]}
            onChange={(patch) => change(index, patch)} onMove={(direction) => move(index, direction)}
            onRemove={() => setDrafts((all) => all.filter((_, i) => i !== index))} />
        ))}
      </div>

      {problems[-1] && <p className={styles.problem} role="alert">{problems[-1]}</p>}
      {state.error && <p className={styles.problem} role="alert">{state.error}</p>}

      <div className={styles.footer}>
        <div className={styles.tools}>
          <button type="button" className="btn btn--sm" disabled={drafts.length >= MAX_EXERCISES} onClick={() => setDrafts((all) => [...all, blankDraft('multiple_choice')])}>
            + Opción múltiple
          </button>
          <button type="button" className="btn btn--sm" disabled={drafts.length >= MAX_EXERCISES} onClick={() => setDrafts((all) => [...all, blankDraft('numeric')])}>
            + Respuesta numérica
          </button>
        </div>
        <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Guardando…' : `Guardar ejercicios (${drafts.length})`}
        </button>
      </div>
      <p className={styles.hint}>
        Los ejercicios que quites dejan de verse para los alumnos, pero lo que ya respondieron se conserva. Cuando un alumno responde, ve la
        explicación; la respuesta correcta nunca viaja a su navegador antes de responder.
      </p>
    </form>
  );
}

/** Un ejercicio del editor. Con `competencies` (preguntas de una evaluación) pide también la competencia que mide. */
export function ExerciseCard({ draft, index, count, problem, competencies, onChange, onMove, onRemove }: {
  draft: ExerciseDraft;
  index: number;
  count: number;
  problem?: string;
  competencies?: Competency[];
  onChange: (patch: Partial<ExerciseDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const label = `Ejercicio ${index + 1}`;
  return (
    <section className="card" aria-label={label}>
      <div className={styles.card}>
        <div className={styles.top}>
          <h3>{label}</h3>
          <div className={styles.tools}>
            <button type="button" className="btn btn--sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Subir ${label}`}>↑</button>
            <button type="button" className="btn btn--sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Bajar ${label}`}>↓</button>
            <button type="button" className="btn btn--sm" onClick={onRemove} aria-label={`Quitar ${label}`}>Quitar</button>
          </div>
        </div>

        <label className="label">
          Tipo
          <select className="input" value={draft.kind} onChange={(event) => onChange({ kind: event.target.value as ExerciseKind })}>
            {Object.entries(KIND_LABEL).map(([kind, text]) => <option key={kind} value={kind}>{text}</option>)}
          </select>
        </label>

        {competencies && (
          <label className="label">
            Competencia que mide
            <select className="input" value={draft.competency} onChange={(event) => onChange({ competency: event.target.value })}>
              <option value="">Elige una…</option>
              {competencies.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
        )}

        <label className="label">
          Enunciado
          <textarea className="input" rows={2} maxLength={MAX_PROMPT} value={draft.prompt} onChange={(event) => onChange({ prompt: event.target.value })} />
        </label>

        {draft.kind === 'multiple_choice' ? (
          <fieldset className={styles.options}>
            <legend>Opciones (marca la correcta)</legend>
            {draft.options.map((option, i) => (
              <div key={i} className={styles.option}>
                <input type="radio" name={`correct-${draft.key}`} checked={draft.correctOption === i} onChange={() => onChange({ correctOption: i })} aria-label={`La opción ${i + 1} es la correcta`} />
                <input className="input" value={option} maxLength={MAX_OPTION} aria-label={`Opción ${i + 1}`}
                  onChange={(event) => onChange({ options: draft.options.map((current, j) => (j === i ? event.target.value : current)) })} />
                <button type="button" className="btn btn--sm" disabled={draft.options.length <= MIN_OPTIONS} onClick={() => onChange(removeOption(draft, i))} aria-label={`Quitar la opción ${i + 1}`}>✕</button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn--sm" disabled={draft.options.length >= MAX_OPTIONS} onClick={() => onChange({ options: [...draft.options, ''] })}>+ Opción</button>
            </div>
          </fieldset>
        ) : (
          <div className={styles.numbers}>
            <label className="label">
              Número correcto
              <input className="input" inputMode="decimal" value={draft.correctNumber} onChange={(event) => onChange({ correctNumber: event.target.value })} />
            </label>
            <label className="label">
              Tolerancia
              <input className="input" inputMode="decimal" value={draft.tolerance} onChange={(event) => onChange({ tolerance: event.target.value })} />
              <span className={styles.hint}>0 = exacto. Con 0,01 vale 3,14 ± 0,01.</span>
            </label>
          </div>
        )}

        <label className="label">
          Explicación (la ve el alumno después de responder)
          <textarea className="input" rows={2} maxLength={MAX_EXPLANATION} value={draft.explanation} onChange={(event) => onChange({ explanation: event.target.value })} />
        </label>

        {problem && <p className={styles.problem} role="alert">{label}: {problem}</p>}
      </div>
    </section>
  );
}
