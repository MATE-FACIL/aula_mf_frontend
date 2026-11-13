import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/time';
import type { AdminConsent, AdminConsentStatus } from '@/types/admin';
import styles from './admin.module.css';

// Cómo va el consentimiento del padre para los datos del alumno (SCRUM-38), en la ficha del alumno.

const LABEL: Record<AdminConsentStatus, string> = {
  accepted: 'Aceptado',
  pending: 'Pendiente',
  no_guardian: 'Sin padre vinculado',
};

const STYLE: Record<AdminConsentStatus, string> = {
  accepted: styles.status_active,
  pending: styles.status_no_account,
  no_guardian: styles.status_inactive,
};

export function ConsentStatus({ consent, timeZone }: { consent: AdminConsent; timeZone: string }) {
  return (
    <div className="section" aria-labelledby="consent-status-title">
      <h3 id="consent-status-title">Consentimiento de los datos</h3>
      <p><span className={cn(styles.badge, STYLE[consent.status])}>{LABEL[consent.status]}</span></p>
      {consent.status === 'accepted' && consent.acceptedAt && (
        <p className={styles.sub}>
          El {formatShortDate(consent.acceptedAt, timeZone)}{consent.acceptedByName ? ` · por ${consent.acceptedByName}` : ''} · versión {consent.currentVersion}
        </p>
      )}
      {consent.status === 'pending' && (
        <p className={styles.sub}>Ningún padre vinculado aceptó todavía la versión vigente. Lo ven en su panel de la familia.</p>
      )}
      {consent.status === 'no_guardian' && (
        <p className={styles.sub}>Vincula a un padre o tutor para que pueda dar el consentimiento.</p>
      )}
      {consent.isProvisional && (
        <p className={styles.sub}>El texto vigente es provisional: falta que el dueño lo valide. Al validarlo, los padres tendrán que aceptarlo de nuevo.</p>
      )}
    </div>
  );
}
