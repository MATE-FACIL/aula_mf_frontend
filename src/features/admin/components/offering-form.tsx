'use client';

import { useActionState, useMemo, useState } from 'react';
import { formatLongDate, formatTime } from '@/lib/time';
import type { CourseOffering } from '@/types/admin';
import { saveOfferingAction } from '../actions';
import { DEFAULT_SESSION_MINUTES, generateSessions, SCHEDULE_TIME_ZONE, sessionMinutes, WEEKDAYS } from '../schedule';
import { OFFERING_CURRENCIES } from '../validation';
import { SubmitButton, useResultToast } from './action-form';
import styles from './admin.module.css';
import { Field } from './field';

// Alta y edición de un grupo en borrador (SCRUM-41/42). El horario se calcula en el navegador
// (sin peticiones) a partir de días, hora de Perú y duración por etapa; al guardar viaja una sola vez.
// Los campos del generador van en el mismo formulario: el servidor solo lee `sessions` (JSON ya validado).

type Plan = { id: string | null; startsAt: string; endsAt: string; virtualLink: string | null };

interface Props {
  courseId: string;
  /** Duración por defecto del curso (SCRUM-42). */
  courseSessionMinutes: number | null;
  offering?: CourseOffering;
}

export function OfferingForm({ courseId, courseSessionMinutes, offering }: Props) {
  const [state, formAction] = useActionState(saveOfferingAction, {});
  useResultToast(state);
  const errors = state.fieldErrors;

  // Al editar se conservan las sesiones existentes (con sus ids) hasta que se regenere el horario.
  const [sessions, setSessions] = useState<Plan[]>(offering?.sessions ?? []);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const defaultMinutes = (offering?.sessions[0] && sessionMinutes(offering.sessions[0])) || courseSessionMinutes || DEFAULT_SESSION_MINUTES;

  const generate = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const result = generateSessions({
      startDate: String(data.get('startDate') ?? ''),
      weekdays: data.getAll('weekday').map(Number),
      time: String(data.get('time') ?? ''),
      durationMinutes: Number(data.get('duration')),
      count: Number(data.get('count')),
    });
    if (!result.ok) {
      setScheduleError(result.error);
      return;
    }
    const link = String(data.get('commonLink') ?? '').trim() || null;
    setScheduleError(null);
    setSessions(result.sessions.map((s) => ({ id: null, ...s, virtualLink: link })));
  };

  const sessionsJson = useMemo(() => JSON.stringify(sessions), [sessions]);

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {offering && <input type="hidden" name="offeringId" value={offering.id} />}
      <input type="hidden" name="sessions" value={sessionsJson} />

      <div className={styles.fields}>
        <Field label="Nombre del grupo" name="name" required maxLength={200} defaultValue={offering?.name} placeholder="Grupo A · Lun y Mié 5 p. m." error={errors?.name} full />
        <Field label="Cupo máximo" name="maximumCapacity" type="number" min={1} max={500} required defaultValue={offering?.maximumCapacity ?? 8}
          hint="Matemáticas 8, IA y Habilidades digitales 12." error={errors?.maximumCapacity} />
        <Field label="Precio" name="basePrice" type="number" min={0} step="0.01" required defaultValue={offering?.basePrice ?? ''} error={errors?.basePrice} />
        <label className="label">
          Moneda
          <select className="input" name="currencyCode" defaultValue={offering?.currencyCode ?? 'PEN'}>
            {OFFERING_CURRENCIES.map((c) => <option key={c} value={c}>{c === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}</option>)}
          </select>
        </label>
      </div>

      <fieldset className={`card ${styles.form}`}>
        <legend className="label">Horario (hora de Perú)</legend>
        <div className={styles.fields}>
          <Field label="Primera clase desde" name="startDate" type="date" />
          <Field label="Hora de inicio" name="time" type="time" defaultValue="17:00" />
          <Field label="Duración (min)" name="duration" type="number" min={30} max={240} step={5} defaultValue={defaultMinutes} />
          <Field label="Cantidad de clases" name="count" type="number" min={1} max={60} defaultValue={offering?.plannedSessionCount ?? 14} />
          <div className={`label ${styles.full}`} role="group" aria-label="Días de clase">
            Días de clase
            <span className={styles.actions}>
              {WEEKDAYS.map((d) => (
                <label key={d.value} className={styles.inline}>
                  <input type="checkbox" name="weekday" value={d.value} /> {d.label}
                </label>
              ))}
            </span>
          </div>
          <Field label="Enlace de clase para todas (opcional)" name="commonLink" type="url" placeholder="https://meet.google.com/…" full />
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn--dark" onClick={(event) => event.currentTarget.form && generate(event.currentTarget.form)}>
            {sessions.length ? 'Volver a generar horario' : 'Generar horario'}
          </button>
          <span className={styles.hint}>{sessions.length ? `${sessions.length} clases listas` : 'Todavía sin clases'}</span>
        </div>
        {(scheduleError ?? errors?.sessions) && <p className={styles.formError} role="alert">{scheduleError ?? errors?.sessions}</p>}
        {sessions.length > 0 && <SessionPreview sessions={sessions} />}
      </fieldset>

      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <SubmitButton className="btn--primary">{offering ? 'Guardar grupo' : 'Crear grupo'}</SubmitButton>
      </div>
    </form>
  );
}

function SessionPreview({ sessions }: { sessions: Plan[] }) {
  return (
    <ol className={styles.list}>
      {sessions.map((s, i) => (
        <li key={s.id ?? s.startsAt} className={styles.listItem}>
          <span>
            <b>Clase {i + 1}</b> · {formatLongDate(s.startsAt, SCHEDULE_TIME_ZONE)}, {formatTime(s.startsAt, SCHEDULE_TIME_ZONE)} – {formatTime(s.endsAt, SCHEDULE_TIME_ZONE)}
          </span>
          {s.virtualLink && <span className={styles.sub}>con enlace</span>}
        </li>
      ))}
    </ol>
  );
}
