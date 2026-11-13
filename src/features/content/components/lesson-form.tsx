'use client';

import Link from 'next/link';
import { startTransition, useActionState, useId, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { ActionForm, SubmitButton, useResultToast } from '@/features/admin/components/action-form';
import admin from '@/features/admin/components/admin.module.css';
import { Field } from '@/features/admin/components/field';
import type { ContentLesson } from '@/types/content';
import { deleteLessonAction, grantLessonUploadAction, saveLessonAction } from '../actions';
import { acceptFor, contentTypeOf, fileProblem, formatBytes, LESSON_SUMMARY_MAX, LESSON_TITLE_MAX, LINK_MAX, MATERIAL_TITLE_MAX, MAX_MATERIALS } from '../rules';
import { uploadToStorage } from '../upload';
import styles from './content.module.css';

// Formulario de una sesión (SCRUM-71): título, resumen, video y materiales. El video y cada material son un
// enlace o un archivo; los archivos se suben directo al almacenamiento y se adjuntan al guardar la sesión.

type Kind = 'video' | 'material';

interface Slot {
  mode: 'link' | 'file';
  url: string;
  fileId: string;
  /** Qué archivo hay subido, para mostrarlo. */
  label: string;
  /** Enlace firmado para verlo (vence a los 15 minutos), si ya estaba guardado. */
  viewUrl: string | null;
}

interface Row extends Slot {
  key: number;
  title: string;
}

const EMPTY: Slot = { mode: 'link', url: '', fileId: '', label: '', viewUrl: null };

function slotOfVideo(lesson?: ContentLesson): Slot {
  if (lesson?.videoFileId) return { mode: 'file', url: '', fileId: lesson.videoFileId, label: `Video subido (${lesson.videoContentType ?? 'archivo'})`, viewUrl: lesson.videoUrl };
  return { ...EMPTY, url: lesson?.videoUrl ?? '' };
}

function rowsOf(lesson?: ContentLesson): Row[] {
  return (lesson?.materials ?? []).map((material, key) => material.fileId
    ? { key, title: material.title, mode: 'file', url: '', fileId: material.fileId, label: `Archivo subido${material.size ? ` · ${formatBytes(material.size)}` : ''}`, viewUrl: material.url }
    : { key, title: material.title, ...EMPTY, url: material.url ?? '' });
}

/** Elige un archivo, pide el permiso al backend y lo sube directo al almacenamiento, con su avance. */
function FilePicker({ kind, courseId, lessonId, onUploaded }: {
  kind: Kind; courseId: string; lessonId: string; onUploaded: (file: { fileId: string; label: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const hintId = useId();

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const problem = fileProblem(kind, file);
    if (problem) {
      setError(problem);
      input.value = '';
      return;
    }
    setError('');
    setBusy(true);
    setProgress(0);
    try {
      const grant = await grantLessonUploadAction(courseId, lessonId, kind, contentTypeOf(file), file.size);
      if (!grant.ok) {
        setError(grant.error);
        return;
      }
      await uploadToStorage(file, grant.data, setProgress);
      onUploaded({ fileId: grant.data.fileId, label: `${file.name} · ${formatBytes(file.size)}` });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo subir el archivo.');
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  return (
    <div className={styles.file}>
      <input className="input" type="file" accept={acceptFor(kind)} onChange={choose} disabled={busy} aria-describedby={hintId} />
      <span id={hintId} className={styles.hint} aria-live="polite">
        {busy ? `Subiendo… ${Math.round(progress * 100)} %` : kind === 'video' ? 'MP4 o WebM, hasta 2 GB. Se adjunta al guardar la sesión.' : 'PDF, imagen u Office, hasta 50 MB. Se adjunta al guardar la sesión.'}
      </span>
      {busy && <div className={styles.progress} role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la subida"><i style={{ '--v': `${Math.round(progress * 100)}%` } as CSSProperties} /></div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

/** El video o un material: un enlace o un archivo. Siempre manda los dos campos para que las filas queden alineadas. */
function Attachment({ kind, slot, onChange, courseId, lessonId, linkName, fileName, label }: {
  kind: Kind; slot: Slot; onChange: (slot: Slot) => void; courseId: string; lessonId?: string; linkName: string; fileName: string; label: string;
}) {
  const group = useId();
  return (
    <div className={styles.file}>
      <div className={styles.choice} role="radiogroup" aria-label={`${label}: enlace o archivo`}>
        <label>
          <input type="radio" name={group} checked={slot.mode === 'link'} onChange={() => onChange({ ...slot, mode: 'link' })} /> Enlace
        </label>
        <label>
          <input type="radio" name={group} checked={slot.mode === 'file'} disabled={!lessonId} onChange={() => onChange({ ...slot, mode: 'file' })} /> Archivo
        </label>
      </div>
      {!lessonId && <p className={styles.hint}>Para subir un archivo, guarda primero la sesión.</p>}

      {slot.mode === 'link' ? (
        <>
          <input className="input" name={linkName} type="url" inputMode="url" value={slot.url} maxLength={LINK_MAX} placeholder="https://…" aria-label={`${label}: enlace`}
            onChange={(event) => onChange({ ...slot, url: event.target.value })} />
          <input type="hidden" name={fileName} value="" />
        </>
      ) : (
        <>
          <input type="hidden" name={linkName} value="" />
          <input type="hidden" name={fileName} value={slot.fileId} />
          {slot.fileId && (
            <div className={styles.fileCurrent}>
              <span>{slot.label}</span>
              {slot.viewUrl && <a className="link" href={slot.viewUrl} target="_blank" rel="noreferrer">Ver</a>}
              <button type="button" className="btn btn--sm" onClick={() => onChange({ ...EMPTY, mode: 'file' })}>Quitar archivo</button>
            </div>
          )}
          {lessonId && <FilePicker kind={kind} courseId={courseId} lessonId={lessonId}
            onUploaded={({ fileId, label: name }) => onChange({ ...slot, mode: 'file', fileId, label: name, viewUrl: null, url: '' })} />}
        </>
      )}
    </div>
  );
}

interface Props {
  courseId: string;
  units: { id: string; title: string }[];
  /** Sin `lesson`, crea una sesión nueva. */
  lesson?: ContentLesson;
  defaultUnitId: string;
}

export function LessonForm({ courseId, units, lesson, defaultUnitId }: Props) {
  const [state, formAction, saving] = useActionState(saveLessonAction, {});
  useResultToast(state);
  const errors = state.fieldErrors;
  const [video, setVideo] = useState<Slot>(() => slotOfVideo(lesson));
  const [rows, setRows] = useState<Row[]>(() => rowsOf(lesson));
  const nextKey = useRef(rows.length);
  const lessonId = lesson?.id;

  // Se envía a mano y no con `action={…}`: React 19 vacía los campos tras cada envío con `action`, y con un error de
  // validación el administrador perdería lo que escribió (el título, el resumen…).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  const setRow = (key: number, patch: Partial<Row>) => setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <>
      <form onSubmit={submit} className={styles.editor} noValidate>
        <input type="hidden" name="courseId" value={courseId} />
        {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}

        <label className="label">
          Unidad
          <select className="input" name="unitId" defaultValue={lesson?.unitId ?? defaultUnitId} aria-invalid={errors?.unitId ? true : undefined}>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
          </select>
          {errors?.unitId && <span className={admin.fieldError}>{errors.unitId}</span>}
        </label>

        <Field label="Título de la sesión" name="title" required maxLength={LESSON_TITLE_MAX} defaultValue={lesson?.title} error={errors?.title} full />

        <label className="label">
          Resumen (opcional)
          <textarea className={`input ${admin.textarea}`} name="summary" rows={3} maxLength={LESSON_SUMMARY_MAX} defaultValue={lesson?.summary ?? ''} />
          {errors?.summary && <span className={admin.fieldError}>{errors.summary}</span>}
        </label>

        <fieldset className={styles.group}>
          <legend>Video (opcional)</legend>
          <Attachment kind="video" slot={video} onChange={setVideo} courseId={courseId} lessonId={lessonId} linkName="videoUrl" fileName="videoFileId" label="Video" />
          {errors?.video && <p className={styles.error} role="alert">{errors.video}</p>}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Materiales ({rows.length} de {MAX_MATERIALS})</legend>
          {rows.length === 0 && <p className={styles.hint}>Guías, fichas o enlaces que el alumno puede abrir. Las filas vacías se ignoran.</p>}
          {rows.map((row, index) => (
            <div key={row.key} className={styles.material}>
              <div className={styles.materialHead}>
                <b>Material {index + 1}</b>
                <button type="button" className="btn btn--sm" onClick={() => setRows((all) => all.filter((item) => item.key !== row.key))}>Quitar</button>
              </div>
              <label className="label">
                Título
                <input className="input" name="materialTitle" value={row.title} maxLength={MATERIAL_TITLE_MAX} placeholder="Ej.: Guía de práctica"
                  onChange={(event) => setRow(row.key, { title: event.target.value })} />
              </label>
              <Attachment kind="material" slot={row} onChange={(slot) => setRow(row.key, slot)} courseId={courseId} lessonId={lessonId}
                linkName="materialUrl" fileName="materialFileId" label={`Material ${index + 1}`} />
            </div>
          ))}
          {rows.length < MAX_MATERIALS && (
            <div>
              <button type="button" className="btn btn--sm"
                onClick={() => setRows((all) => [...all, { key: nextKey.current++, title: '', ...EMPTY }])}>+ Agregar material</button>
            </div>
          )}
          {errors?.materials && <p className={styles.error} role="alert">{errors.materials}</p>}
        </fieldset>

        <label className={styles.publish}>
          <input type="checkbox" name="isPublished" defaultChecked={lesson?.isPublished ?? false} />
          <span>Publicada: la ven los alumnos con matrícula activa. Sin marcar, solo la ve el equipo.</span>
        </label>

        {state.error && <p className={styles.error} role="alert">{state.error}</p>}
        <div className={styles.footer}>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Guardando…' : lessonId ? 'Guardar sesión' : 'Crear sesión'}
          </button>
          <Link className="btn" href={`/admin/cursos/${courseId}/contenido`}>Volver al contenido</Link>
        </div>
      </form>

      {lessonId && (
        <div className={styles.danger}>
          <ActionForm action={deleteLessonAction} confirmMessage={`¿Borrar la sesión «${lesson?.title}»? También se borran sus archivos subidos.`}>
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="lessonId" value={lessonId} />
            <SubmitButton pendingLabel="Borrando…">Borrar sesión</SubmitButton>
          </ActionForm>
        </div>
      )}
    </>
  );
}
