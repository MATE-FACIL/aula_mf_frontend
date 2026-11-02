import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './admin.module.css';

// Campo de formulario con etiqueta, ayuda y error accesibles (aria-invalid + aria-describedby).

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  full?: boolean;
}

export function Field({ label, name, error, hint, full, className, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <label className={cn('label', full && styles.full)}>
      {label}
      <input className={cn('input', className)} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}
      {error && <span id={`${id}-error`} className={styles.fieldError}>{error}</span>}
    </label>
  );
}

interface AreaProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: ReactNode;
  rows?: number;
}

export function TextArea({ label, name, defaultValue, hint, rows = 4 }: AreaProps) {
  const id = useId();
  return (
    <label className={cn('label', styles.full)}>
      {label}
      <textarea className={cn('input', styles.textarea)} name={name} defaultValue={defaultValue ?? ''} rows={rows} maxLength={8000} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}
    </label>
  );
}
