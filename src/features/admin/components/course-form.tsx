'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition, type ChangeEvent } from 'react';
import { useToast } from '@/components/ui/toast';
import type { AdminCourse, CourseCategory } from '@/types/admin';
import { saveCourseAction } from '../actions';
import { checkCover, COVER_TYPES } from '../validation';
import { SubmitButton, useResultToast } from './action-form';
import styles from './admin.module.css';
import { Field, TextArea } from './field';

/** Crear (sin `course`) o editar un curso. Al crear, el servidor redirige a la ficha del curso nuevo. */
export function CourseForm({ course, categories }: { course?: AdminCourse; categories: CourseCategory[] }) {
  const [state, formAction] = useActionState(saveCourseAction, {});
  useResultToast(state);
  const errors = state.fieldErrors;
  return (
    <form action={formAction} className={styles.form} noValidate>
      {course && <input type="hidden" name="courseId" value={course.id} />}
      <div className={styles.fields}>
        <Field label="Título" name="title" required maxLength={200} defaultValue={course?.title} error={errors?.title} full />
        <label className="label">
          Categoría
          <select className="input" name="categoryId" defaultValue={course?.categoryId ?? ''} aria-invalid={errors?.categoryId ? true : undefined}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors?.categoryId && <span className={styles.fieldError}>{errors.categoryId}</span>}
        </label>
        <TextArea label="Descripción corta" name="shortDescription" defaultValue={course?.shortDescription} rows={2} hint="Se muestra en el catálogo público." />
        <TextArea label="Descripción completa" name="fullDescription" defaultValue={course?.fullDescription} rows={5} />
        <TextArea label="Objetivos" name="objectives" defaultValue={course?.objectives} />
        <TextArea label="Temario" name="syllabus" defaultValue={course?.syllabus} rows={6} />
        <TextArea label="¿Para quién es?" name="targetAudience" defaultValue={course?.targetAudience} rows={2} />
        <TextArea label="Requisitos previos" name="prerequisites" defaultValue={course?.prerequisites} rows={2} />
      </div>
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <SubmitButton className="btn--primary">{course ? 'Guardar cambios' : 'Crear curso'}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Sube la portada al Route Handler `/admin/cursos/[id]/portada` (límite propio de 5 MB) y luego
 * refresca la página para mostrar la imagen nueva. Valida tipo y tamaño antes de enviar nada.
 */
export function CoverUploader({ courseId, coverUrl, title }: { courseId: string; coverUrl: string | null; title: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    const problem = checkCover(file);
    setError(problem);
    if (problem || !file) return;

    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);
      try {
        const response = await fetch(`/admin/cursos/${courseId}/portada`, { method: 'POST', body });
        if (!response.ok) {
          const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
          setError(message ?? 'No se pudo subir la imagen.');
          return;
        }
        notify('Portada actualizada.', 'success');
        router.refresh();
      } catch {
        setError('No pudimos conectarnos. Revisa tu conexión.');
      } finally {
        input.value = '';
      }
    });
  };

  return (
    <div className={styles.form}>
      {coverUrl ? (
        // La portada ya es un archivo optimizado servido por el almacenamiento (R2): <img> simple, sin recorte en el VPS.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.cover} src={coverUrl} alt={`Portada de ${title}`} />
      ) : (
        <div className={`${styles.cover} ${styles.coverEmpty}`}>Sin portada</div>
      )}
      <label className="label">
        {coverUrl ? 'Cambiar portada' : 'Subir portada'}
        <input className="input" type="file" accept={COVER_TYPES.join(',')} onChange={onChange} disabled={pending} />
        <span className={styles.hint}>{pending ? 'Subiendo…' : 'JPG, PNG o WebP de hasta 5 MB. Ideal: 1280 × 720.'}</span>
      </label>
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </div>
  );
}
