'use client';

import { useActionState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { AdminActionState } from '../actions';
import styles from './admin.module.css';

type Action = (prev: AdminActionState, form: FormData) => Promise<AdminActionState>;

/** Botón de envío que se deshabilita mientras la acción corre (evita dobles envíos). */
export function SubmitButton({ children, pendingLabel, className }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={cn('btn', className)} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? 'Guardando…') : children}
    </button>
  );
}

type Notify = ReturnType<typeof useToast>['notify'];

function reportResult(state: AdminActionState, notify: Notify) {
  if (state.message) notify(state.message, 'success');
  else if (state.error && !state.fieldErrors) notify(state.error, 'error');
}

/** Avisa con un toast el resultado de cada envío (éxito o error general). */
export function useResultToast(state: AdminActionState) {
  const { notify } = useToast();
  useEffect(() => {
    if (state.at) reportResult(state, notify);
  }, [state, notify]);
}

interface Props {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Pide confirmación antes de enviar (acciones destructivas). */
  confirmMessage?: string;
  /** Limpia los campos tras un envío exitoso (p. ej. «nueva categoría»). */
  resetOnSuccess?: boolean;
}

/**
 * Formulario pequeño para una acción del panel (activar, vincular, publicar, borrar…).
 * El aviso sale al terminar la acción y no en un efecto: muchas acciones hacen desaparecer su propio formulario
 * (publicar, activar, retirar, quitar un vínculo) y un efecto ya no llegaría a correr.
 */
export function ActionForm({ action, children, className, confirmMessage, resetOnSuccess }: Props) {
  const { notify } = useToast();
  const [state, formAction] = useActionState(async (prev: AdminActionState, form: FormData) => {
    const result = await action(prev, form);
    reportResult(result, notify);
    return result;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.at && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={cn(styles.inline, className)}>
      {children}
      {state.fieldErrors && <span className={styles.fieldError} role="alert">{Object.values(state.fieldErrors)[0]}</span>}
    </form>
  );
}
