'use client';

import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/cn';
import styles from './schedule.module.css';

// Clases en vivo con acceso LIMITADO POR HORARIO: «Entrar» se habilita 10 min antes del inicio
// y se cierra al terminar. Se revisa cada 30 s (no cada segundo) y se pausa con la pestaña oculta.
// Fechas y horas llegan ya formateadas desde el servidor → el HTML hidrata sin diferencias.

export const JOIN_WINDOW_MIN = 10;
const TICK_MS = 30_000;

export interface LiveClassView {
  id: string;
  startsAtMs: number;
  endsAtMs: number;
  dayLabel: string;
  timeLabel: string;
  zoneLabel: string;
  course: string;
  topic: string;
  teacher: string;
  joinUrl: string | null;
}

type Phase = 'later' | 'soon' | 'open' | 'live' | 'ended';

function phaseOf(c: LiveClassView, now: number): Phase {
  if (now >= c.endsAtMs) return 'ended';
  if (now >= c.startsAtMs) return 'live';
  if (now >= c.startsAtMs - JOIN_WINDOW_MIN * 60_000) return 'open';
  if (c.startsAtMs - now < 3 * 60 * 60_000) return 'soon';
  return 'later';
}

const minutesUntil = (ms: number, now: number) => Math.max(1, Math.ceil((ms - now) / 60_000));

export function LiveClasses({ classes, serverNow }: { classes: LiveClassView[]; serverNow: number }) {
  const now = useNow(TICK_MS, serverNow);

  return (
    <div className={styles.classes}>
      {classes.map((c) => {
        const phase = phaseOf(c, now);
        const canJoin = phase === 'open' || phase === 'live';
        return (
          <article key={c.id} className={cn(styles.liveClass, canJoin && styles.liveClassOpen, phase === 'ended' && styles.liveClassEnded)}>
            <div className={styles.when}>
              <b>{c.dayLabel}</b>
              <span>{c.timeLabel}</span>
              <small>{c.zoneLabel}</small>
            </div>
            <div className={styles.what}>
              <span className={styles.liveTag}>{phase === 'live' ? '● En vivo ahora' : '● Clase en vivo'}</span>
              <h3>{c.course}</h3>
              <p>{c.topic} · {c.teacher}</p>
            </div>
            {canJoin && c.joinUrl ? (
              <a className={styles.join} href={c.joinUrl} target="_blank" rel="noopener noreferrer">
                {phase === 'live' ? 'Entrar a la clase' : `Entrar · empieza en ${minutesUntil(c.startsAtMs, now)} min`}
              </a>
            ) : canJoin ? (
              <span className={styles.soon}>El enlace de esta clase aún no está listo. Avísale a tu profesor.</span>
            ) : (
              <span className={styles.soon}>
                {phase === 'ended' ? 'Terminó · la grabación estará en Lecciones' : phase === 'soon' ? `Empieza en ${minutesUntil(c.startsAtMs, now)} min · se habilita ${JOIN_WINDOW_MIN} min antes` : `Se habilita ${JOIN_WINDOW_MIN} min antes`}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
