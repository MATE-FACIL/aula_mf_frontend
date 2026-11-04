'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/tabs';
import { loginFamilyAction, loginStudentAction } from '../actions';
import styles from './login.module.css';

// Ingreso amigable para niños: usuario + 3 figuras secretas (6–11 años).
// Familia y equipo: correo + contraseña (funciona incluso antes de que cargue el JavaScript: Server Action directa).
// Ambos usan el mismo ingreso; el servidor decide a qué área entra cada uno según su rol.
// El límite de intentos lo aplica el servidor; aquí solo se muestra el mensaje.

const PICTOGRAMS = ['🦊', '🚀', '🍕', '🎮', '⭐', '🌈', '🐢', '🎨', '⚽'] as const;
const SECRET_LENGTH = 3;

export interface DemoCredentials {
  student: { username: string; pictograms: readonly string[] };
  family: { email: string; password: string };
  admin: { email: string; password: string };
}

interface Props {
  next?: string;
  expired?: boolean;
  demo?: DemoCredentials;
  /** Alumno con usuario y contraseña de texto (backend real) en vez de figuras. */
  passwordLogin?: boolean;
}

/**
 * Limpia el formulario al salir de la pantalla. Tras entrar, Next deja la ruta de ingreso oculta en vez de
 * desmontarla (sus efectos sí se limpian): sin esto, la contraseña seguiría escrita en un campo oculto.
 */
function useClearOnLeave() {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    return () => form?.reset();
  }, []);
  return formRef;
}

function StudentPasswordForm({ next }: Pick<Props, 'next'>) {
  const [state, formAction, pending] = useActionState(loginStudentAction, {});
  const [visible, setVisible] = useState(false);
  const formRef = useClearOnLeave();
  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      {next && <input type="hidden" name="next" value={next} />}
      <label className="label">
        Tu usuario
        <input className="input" name="username" autoComplete="username" placeholder="Ej.: P99000001" required />
      </label>
      <label className="label">
        Contraseña
        <span className={styles.passwordWrap}>
          <input className={`input ${styles.passwordInput}`} name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </span>
      </label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="btn btn--primary btn--lg" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar a mi aula'}
      </button>
    </form>
  );
}

function StudentForm({ next, demo }: Pick<Props, 'next' | 'demo'>) {
  const [state, formAction, pending] = useActionState(loginStudentAction, {});
  const [secret, setSecret] = useState<string[]>([]);
  const formRef = useClearOnLeave();
  useEffect(() => () => setSecret([]), []);

  const toggle = (p: string) =>
    setSecret((current) => (current.length >= SECRET_LENGTH ? [p] : current.includes(p) ? current : [...current, p]));

  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      {next && <input type="hidden" name="next" value={next} />}
      <input type="hidden" name="pictograms" value={secret.join(',')} />
      <label className="label">
        Tu usuario
        <input className="input" name="username" autoComplete="username" placeholder="Ej.: valentina.r" required defaultValue={demo?.student.username} />
      </label>

      <div className={styles.secret}>
        <div className={styles.secretHead}>
          <span className="label" id="secret-label">Tu clave secreta</span>
          {secret.length > 0 && <button type="button" className="link" onClick={() => setSecret([])}>Borrar</button>}
        </div>
        <div className={styles.chosen} aria-live="polite" aria-label={`Elegiste ${secret.length} de ${SECRET_LENGTH} figuras`}>
          {Array.from({ length: SECRET_LENGTH }, (_, i) => (
            <span key={i} className={secret[i] ? styles.slotFull : styles.slot}>{secret[i] ?? ''}</span>
          ))}
        </div>
        <div className={styles.pictograms} role="group" aria-labelledby="secret-label">
          {PICTOGRAMS.map((p) => (
            <button key={p} type="button" aria-pressed={secret.includes(p)} onClick={() => toggle(p)} aria-label={`Figura ${p}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="btn btn--primary btn--lg" type="submit" disabled={pending || secret.length !== SECRET_LENGTH}>
        {pending ? 'Entrando…' : 'Entrar a mi aula'}
      </button>
      <p className={styles.help}>Los alumnos de 6 a 11 años entran con figuras. Los de 12 a 17 pueden usar una contraseña.</p>
    </form>
  );
}

const EMAIL_FORM_COPY = {
  family: { email: 'Correo de la familia', placeholder: 'familia@correo.com', submit: 'Entrar como familia', help: '¿Primera vez? Usa el enlace que te enviamos por WhatsApp al matricular.' },
  staff: { email: 'Correo del equipo', placeholder: 'nombre@matefacil.pe', submit: 'Entrar al panel', help: 'Para el equipo de Mate Fácil: administración de usuarios, familias y cursos.' },
} as const;

function EmailForm({ next, defaultEmail, variant }: Pick<Props, 'next'> & { defaultEmail?: string; variant: keyof typeof EMAIL_FORM_COPY }) {
  const [state, formAction, pending] = useActionState(loginFamilyAction, {});
  const [visible, setVisible] = useState(false);
  const copy = EMAIL_FORM_COPY[variant];
  const formRef = useClearOnLeave();
  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      {next && <input type="hidden" name="next" value={next} />}
      <label className="label">
        {copy.email}
        <input className="input" name="email" type="email" autoComplete="email" placeholder={copy.placeholder} required defaultValue={defaultEmail} />
      </label>
      <label className="label">
        Contraseña
        <span className={styles.passwordWrap}>
          <input className={`input ${styles.passwordInput}`} name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </span>
      </label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="btn btn--primary btn--lg" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : copy.submit}
      </button>
      <p className={styles.help}>{copy.help}</p>
    </form>
  );
}

export function LoginForms({ next, expired, demo, passwordLogin }: Props) {
  const defaultTab = next?.startsWith('/familia') ? 'family' : next?.startsWith('/admin') ? 'staff' : 'student';
  return (
    <>
      {expired && <p className={styles.notice}>Tu sesión terminó. Vuelve a ingresar para continuar.</p>}
      <Tabs
        label="Tipo de cuenta"
        variant="segmented"
        defaultTab={defaultTab}
        items={[
          { id: 'student', label: 'Soy alumno', panel: passwordLogin ? <StudentPasswordForm next={next} /> : <StudentForm next={next} demo={demo} /> },
          { id: 'family', label: 'Soy familia', panel: <EmailForm next={next} variant="family" defaultEmail={demo?.family.email} /> },
          { id: 'staff', label: 'Equipo', panel: <EmailForm next={next} variant="staff" defaultEmail={demo?.admin.email} /> },
        ]}
      />
      {demo && (
        <details className={styles.demo}>
          <summary>Datos de prueba (modo demo)</summary>
          <p>Alumno: <code>{demo.student.username}</code> + {demo.student.pictograms.join(' ')}</p>
          <p>Familia: <code>{demo.family.email}</code> / <code>{demo.family.password}</code></p>
          <p>Equipo: <code>{demo.admin.email}</code> / <code>{demo.admin.password}</code></p>
        </details>
      )}
    </>
  );
}
