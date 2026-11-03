'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { CopyButton } from '@/features/achievements/components/copy-button';
import type { IssuedCredentials } from '@/types/admin';
import { createGuardianAction, createInstructorAction, createStudentAction, type AdminActionState } from '../actions';
import { DOCUMENT_TYPES } from '../format';
import { SubmitButton, useResultToast } from './action-form';
import styles from './admin.module.css';
import { Field } from './field';

// Alta de alumnos y de padres/tutores. Tras crear, la contraseña inicial se muestra UNA vez
// (el backend solo guarda su hash): hay que copiarla y entregarla a la familia.

function CredentialsCard({ credentials, onAnother }: { credentials: IssuedCredentials; onAnother: () => void }) {
  const text = `Usuario: ${credentials.loginIdentifier}\nContraseña: ${credentials.initialPassword}`;
  return (
    <div className={styles.credentials} role="status">
      <b>Cuenta creada. Entrega estos datos de acceso:</b>
      <dl>
        <dt>Usuario</dt>
        <dd className={styles.mono}>{credentials.loginIdentifier}</dd>
        <dt>Contraseña</dt>
        <dd className={styles.mono}>{credentials.initialPassword}</dd>
      </dl>
      <p className={styles.warning}>Esta contraseña no se volverá a mostrar. Cópiala ahora.</p>
      <div className={styles.actions}>
        <CopyButton value={text} label="Copiar usuario y contraseña">Copiar datos de acceso</CopyButton>
        <Link className="btn btn--sm" href={`/admin/usuarios/${credentials.userId}`}>Ver ficha</Link>
        <button type="button" className="btn btn--sm btn--dark" onClick={onAnother}>Crear otra persona</button>
      </div>
    </div>
  );
}

function DocumentType({ name = 'documentType' }: { name?: string }) {
  return (
    <label className="label">
      Tipo de documento
      <select className="input" name={name} defaultValue="DNI">
        {DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}
      </select>
    </label>
  );
}

type Action = (prev: AdminActionState, form: FormData) => Promise<AdminActionState>;

/** `formKey` cambia para montar un formulario limpio («Crear otra persona»). */
function PersonForm({ action, children, submitLabel }: { action: Action; children: (errors: AdminActionState['fieldErrors']) => React.ReactNode; submitLabel: string }) {
  const [formKey, setFormKey] = useState(0);
  return <PersonFormInner key={formKey} action={action} submitLabel={submitLabel} onAnother={() => setFormKey((k) => k + 1)}>{children}</PersonFormInner>;
}

function PersonFormInner({ action, children, submitLabel, onAnother }: { action: Action; children: (errors: AdminActionState['fieldErrors']) => React.ReactNode; submitLabel: string; onAnother: () => void }) {
  const [state, formAction] = useActionState(action, {});
  useResultToast(state);
  if (state.credentials) return <CredentialsCard credentials={state.credentials} onAnother={onAnother} />;
  return (
    <form action={formAction} className={styles.form} noValidate>
      <div className={styles.fields}>{children(state.fieldErrors)}</div>
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <SubmitButton className="btn--primary" pendingLabel="Creando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function NameFields({ errors }: { errors: AdminActionState['fieldErrors'] }) {
  return (
    <>
      <Field label="Nombres" name="givenNames" required maxLength={150} autoComplete="off" error={errors?.givenNames} />
      <Field label="Primer apellido" name="firstSurname" required maxLength={100} autoComplete="off" error={errors?.firstSurname} />
      <Field label="Segundo apellido (opcional)" name="secondSurname" maxLength={100} autoComplete="off" />
    </>
  );
}

export interface GuardianOption {
  id: string;
  fullName: string;
}

export function CreatePersonForms({ guardian, defaultTab }: { guardian?: GuardianOption; defaultTab?: 'student' | 'guardian' | 'instructor' }) {
  return (
    <Tabs
      label="Tipo de persona"
      variant="segmented"
      defaultTab={guardian ? 'student' : defaultTab}
      items={[
        {
          id: 'student',
          label: 'Alumno',
          panel: (
            <PersonForm action={createStudentAction} submitLabel="Crear alumno">
              {(errors) => (
                <>
                  <NameFields errors={errors} />
                  <DocumentType />
                  <Field label="Número de documento" name="documentNumber" required maxLength={20} inputMode="text" autoComplete="off" error={errors?.documentNumber}
                    hint="El usuario será la inicial del primer apellido + el documento (p. ej. Q77340061)." />
                  <Field label="Correo (opcional)" name="email" type="email" maxLength={254} autoComplete="off" error={errors?.email} />
                  {guardian && (
                    <p className={`${styles.hint} ${styles.full}`}>
                      <input type="hidden" name="guardianUserId" value={guardian.id} />
                      Se vinculará con <b>{guardian.fullName}</b> como padre o tutor.
                    </p>
                  )}
                </>
              )}
            </PersonForm>
          ),
        },
        {
          id: 'guardian',
          label: 'Padre o tutor',
          panel: (
            <PersonForm action={createGuardianAction} submitLabel="Crear padre o tutor">
              {(errors) => (
                <>
                  <NameFields errors={errors} />
                  <Field label="Correo" name="email" type="email" required maxLength={254} autoComplete="off" error={errors?.email} hint="Es su usuario para entrar al panel de la familia." />
                  <DocumentType />
                  <Field label="Número de documento (opcional)" name="documentNumber" maxLength={20} autoComplete="off" error={errors?.documentNumber} />
                </>
              )}
            </PersonForm>
          ),
        },
        {
          id: 'instructor',
          label: 'Profesor',
          panel: (
            <PersonForm action={createInstructorAction} submitLabel="Crear profesor">
              {(errors) => (
                <>
                  <NameFields errors={errors} />
                  <Field label="Correo" name="email" type="email" required maxLength={254} autoComplete="off" error={errors?.email} hint="Con este correo entra al aula; queda listo para asignarlo a grupos." />
                  <DocumentType />
                  <Field label="Número de documento (opcional)" name="documentNumber" maxLength={20} autoComplete="off" error={errors?.documentNumber} />
                </>
              )}
            </PersonForm>
          ),
        },
      ]}
    />
  );
}
