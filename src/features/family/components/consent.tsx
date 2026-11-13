'use client';

import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/time';
import type { FamilyConsent } from '@/types/consent';
import { acceptConsentAction } from '../actions';
import { declarationFor, listNames, pendingChildren } from '../consent';
import styles from './family.module.css';

// Consentimiento del padre (SCRUM-38): lee los términos y la privacidad, marca que es el padre, madre o tutor legal y
// acepta por todos sus hijos pendientes a la vez. Una petición; el backend guarda la fecha y la versión del texto.

export function ConsentPanel({ consent: initial, timeZone }: { consent: FamilyConsent; timeZone: string }) {
  const [consent, setConsent] = useState(initial);
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [justAccepted, setJustAccepted] = useState(false);
  const [busy, startTransition] = useTransition();
  const { text } = consent;
  const waiting = pendingChildren(consent);

  if (consent.children.length === 0) {
    return <EmptyState>Todavía no hay hijos vinculados a tu cuenta. Escríbenos y los agregamos.</EmptyState>;
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed || busy) return;
    startTransition(async () => {
      const result = await acceptConsentAction(text.version, waiting.map((child) => child.studentUserId));
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setConsent(result.data);
      setAgreed(false);
      setMessage('');
      setJustAccepted(true);
    });
  };

  return (
    <article className={styles.consent} aria-labelledby="consent-title">
      <header className={styles.consentHead}>
        <h2 id="consent-title">{text.title}</h2>
        {text.isProvisional && (
          <p className={styles.consentNote}>
            Este texto está en revisión y puede cambiar antes de que empiecen las clases. Si cambia, te pediremos que lo aceptes de nuevo.
          </p>
        )}
      </header>

      {text.sections.map((section) => (
        <section key={section.heading} className={styles.consentSection}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
      ))}

      <section className={styles.consentSection} aria-labelledby="consent-children">
        <h3 id="consent-children">Tus hijos</h3>
        <ul role="list" className={styles.consentChildren}>
          {consent.children.map((child) => (
            <li key={child.studentUserId}>
              <b>{child.fullName}</b>
              {child.status === 'accepted' ? (
                <span className={cn(styles.consentBadge, styles.consentOk)}>
                  Aceptado{child.acceptedAt ? ` el ${formatShortDate(child.acceptedAt, timeZone)}` : ''}{child.acceptedByName ? ` por ${child.acceptedByName}` : ''}
                </span>
              ) : (
                <span className={cn(styles.consentBadge, styles.consentWaiting)}>Falta tu aceptación</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {waiting.length > 0 ? (
        <form className={styles.consentForm} onSubmit={submit}>
          <label className={styles.consentCheck}>
            <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setMessage(''); }} />
            <span>{declarationFor(waiting.map((child) => child.fullName))}</span>
          </label>
          <button type="submit" className="btn btn--primary btn--lg" disabled={!agreed || busy} aria-busy={busy}>
            {busy ? 'Guardando…' : `Aceptar por ${listNames(waiting.map((child) => child.fullName.split(' ')[0]))}`}
          </button>
          {message && <p className={styles.consentError} role="alert">{message}</p>}
        </form>
      ) : (
        <div className={styles.consentDone} role="status">
          <p><b>{justAccepted ? '¡Listo! Quedó registrada tu aceptación.' : 'Ya aceptaste este texto por todos tus hijos.'}</b></p>
          <Link className="btn" href="/familia">Volver al panel de la familia</Link>
        </div>
      )}
    </article>
  );
}
