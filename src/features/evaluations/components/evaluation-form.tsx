'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { ActionForm, SubmitButton, useResultToast } from '@/features/admin/components/action-form';
import { ExerciseCard } from '@/features/practice/components/exercise-editor';
import { blankDraft, toDrafts, type ExerciseDraft } from '@/features/practice/editor-rules';
import type { Competency, TeacherEvaluationDetail } from '@/types/evaluations';
import { deleteEvaluationAction, saveEvaluationAction } from '../actions';
import {
  hasProblems, KIND_LABEL, MAX_DURATION, MAX_QUESTIONS, MIN_DURATION, TITLE_MAX, toLocalInput, toPayload, validateEvaluation,
  type EvaluationFormState, type EvaluationProblems,
} from '../rules';
import styles from './evaluations.module.css';

// Formulario de una evaluación (SCRUM-62/63): título, tipo, cuándo abre y cierra, tiempo para rendirla y sus preguntas
// (cada una con la competencia que mide). El estado vive en el navegador y se envía de una vez: si hay un error no se
// pierde lo escrito. Cuando ya hay alumnos que empezaron, las preguntas se muestran pero no se pueden cambiar.

export interface EvaluationFormDefaults {
  opens: string;
  closes: string;
}

export function EvaluationForm({ offeringId, detail, competencies, defaults }: {
  offeringId: string;
  detail?: TeacherEvaluationDetail;
  competencies: Competency[];
  defaults: EvaluationFormDefaults;
}) {
  const saved = detail?.evaluation;
  const locked = (saved?.started ?? 0) > 0;
  const [form, setForm] = useState<EvaluationFormState>(() => ({
    kind: saved?.kind ?? 'weekly',
    title: saved?.title ?? '',
    opens: saved ? toLocalInput(saved.opensAt) : defaults.opens,
    closes: saved ? toLocalInput(saved.closesAt) : defaults.closes,
    duration: String(saved?.durationMinutes ?? 30),
    isPublished: saved?.isPublished ?? false,
    drafts: detail ? toDrafts(detail.questions).map((draft, index) => ({ ...draft, competency: detail.questions[index].competency })) : [],
  }));
  const [problems, setProblems] = useState<EvaluationProblems>({ byQuestion: {} });
  const [state, formAction, saving] = useActionState(saveEvaluationAction, {});
  useResultToast(state);

  const set = <K extends keyof EvaluationFormState>(key: K, value: EvaluationFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const changeDraft = (index: number, patch: Partial<ExerciseDraft>) =>
    set('drafts', form.drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  const moveDraft = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= form.drafts.length) return;
    const next = [...form.drafts];
    [next[index], next[to]] = [next[to], next[index]];
    set('drafts', next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateEvaluation(form);
    setProblems(found);
    if (hasProblems(found)) return;
    const data = new FormData();
    if (saved) data.set('evaluationId', saved.id);
    else data.set('offeringId', offeringId);
    data.set('payload', JSON.stringify(toPayload(form)));
    startTransition(() => formAction(data));
  };

  return (
    <>
      <form onSubmit={submit} className={styles.form} noValidate>
        <section className="card">
          <div className={styles.fields}>
            <label className={`label ${styles.wide}`}>
              Título
              <input className="input" value={form.title} maxLength={TITLE_MAX} onChange={(event) => set('title', event.target.value)}
                aria-invalid={problems.title ? true : undefined} />
              {problems.title && <span className={styles.problem}>{problems.title}</span>}
            </label>
            <label className="label">
              Tipo
              <select className="input" value={form.kind} onChange={(event) => set('kind', event.target.value as EvaluationFormState['kind'])}>
                {Object.entries(KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
              </select>
            </label>
            <label className="label">
              Tiempo para rendirla (minutos)
              <input className="input" type="number" inputMode="numeric" min={MIN_DURATION} max={MAX_DURATION} value={form.duration}
                onChange={(event) => set('duration', event.target.value)} aria-invalid={problems.duration ? true : undefined} />
              {problems.duration && <span className={styles.problem}>{problems.duration}</span>}
            </label>
            <label className="label">
              Abre (hora de Perú)
              <input className="input" type="datetime-local" value={form.opens} onChange={(event) => set('opens', event.target.value)} aria-invalid={problems.window ? true : undefined} />
            </label>
            <label className="label">
              Cierra (hora de Perú)
              <input className="input" type="datetime-local" value={form.closes} onChange={(event) => set('closes', event.target.value)} aria-invalid={problems.window ? true : undefined} />
            </label>
            {problems.window && <p className={`${styles.problem} ${styles.wide}`}>{problems.window}</p>}
            <label className={`${styles.check} ${styles.wide}`}>
              <input type="checkbox" checked={form.isPublished} disabled={locked} onChange={(event) => set('isPublished', event.target.checked)} />
              Publicada: los alumnos del grupo la ven y la pueden rendir entre la apertura y el cierre
            </label>
          </div>
          <p className={styles.hint}>
            Cada alumno tiene {form.duration || '…'} minutos desde que empieza, sin pasar del cierre. El servidor controla el tiempo: fuera del plazo no se puede
            iniciar ni enviar.
          </p>
        </section>

        <section aria-labelledby="questions-title" className={styles.questions}>
          <h2 id="questions-title">Preguntas ({form.drafts.length})</h2>
          {locked && (
            <p className={styles.note} role="status">
              Ya hay {saved?.started} {saved?.started === 1 ? 'alumno que empezó' : 'alumnos que empezaron'} esta evaluación: las preguntas no se pueden cambiar.
              Sí puedes ampliar el plazo o corregir el título.
            </p>
          )}
          {form.drafts.length === 0 && <p className={styles.hint}>Todavía no hay preguntas. Agrega la primera.</p>}
          {form.drafts.map((draft, index) => (
            <fieldset key={draft.key} disabled={locked} className={styles.locked}>
              <ExerciseCard draft={draft} index={index} count={form.drafts.length} problem={problems.byQuestion[index]} competencies={competencies}
                onChange={(patch) => changeDraft(index, patch)} onMove={(direction) => moveDraft(index, direction)}
                onRemove={() => set('drafts', form.drafts.filter((_, i) => i !== index))} />
            </fieldset>
          ))}
          {problems.questions && <p className={styles.problem} role="alert">{problems.questions}</p>}
          {!locked && (
            <div className={styles.tools}>
              <button type="button" className="btn btn--sm" disabled={form.drafts.length >= MAX_QUESTIONS} onClick={() => set('drafts', [...form.drafts, blankDraft('multiple_choice')])}>+ Opción múltiple</button>
              <button type="button" className="btn btn--sm" disabled={form.drafts.length >= MAX_QUESTIONS} onClick={() => set('drafts', [...form.drafts, blankDraft('numeric')])}>+ Respuesta numérica</button>
            </div>
          )}
        </section>

        {state.error && <p className={styles.problem} role="alert">{state.error}</p>}
        <div className={styles.footer}>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Guardando…' : saved ? 'Guardar cambios' : 'Crear evaluación'}
          </button>
        </div>
      </form>

      {saved && !locked && (
        <ActionForm action={deleteEvaluationAction} confirmMessage="¿Borrar esta evaluación? No se puede deshacer." className={styles.danger}>
          <input type="hidden" name="evaluationId" value={saved.id} />
          <input type="hidden" name="offeringId" value={saved.offeringId} />
          <SubmitButton pendingLabel="Borrando…">Borrar evaluación</SubmitButton>
        </ActionForm>
      )}
    </>
  );
}
