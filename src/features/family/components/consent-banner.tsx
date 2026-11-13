import Link from 'next/link';
import type { FamilyConsent } from '@/types/consent';
import { listNames, pendingChildren } from '../consent';
import styles from './family.module.css';

/** Aviso del panel de la familia mientras falte la aceptación de algún hijo (SCRUM-38). No bloquea nada. */
export function ConsentBanner({ consent }: { consent: FamilyConsent }) {
  const waiting = pendingChildren(consent);
  if (waiting.length === 0) return null;
  return (
    <aside className={styles.consentBanner} aria-label="Consentimiento pendiente">
      <p>
        <b>Falta tu aceptación.</b>{' '}
        Para {listNames(waiting.map((child) => child.fullName))}, lee y acepta los términos de uso y la política de privacidad.
      </p>
      <Link className="btn btn--primary btn--sm" href="/familia/consentimiento">Leer y aceptar</Link>
    </aside>
  );
}
