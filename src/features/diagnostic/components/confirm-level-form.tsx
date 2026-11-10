'use client';

import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import type { DiagnosticLevelCode } from '@/types/diagnostic';
import { confirmDiagnosticLevelAction } from '../actions';
import { LEVELS } from '../rules';
import styles from './diagnostic.module.css';

/** Confirma el nivel: parte del sugerido (o del ya confirmado) y se puede elegir otro. */
export function ConfirmLevelForm({ attemptId, initial, confirmed }: { attemptId: string; initial: DiagnosticLevelCode; confirmed: boolean }) {
  return (
    <ActionForm action={confirmDiagnosticLevelAction} className={styles.confirm}>
      <input type="hidden" name="attemptId" value={attemptId} />
      <label>
        Nivel con el que empieza
        <select name="level" defaultValue={initial}>
          {LEVELS.map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}
        </select>
      </label>
      <SubmitButton className="btn--primary" pendingLabel="Confirmando…">{confirmed ? 'Cambiar nivel' : 'Confirmar nivel'}</SubmitButton>
    </ActionForm>
  );
}
