import { ProgressBar } from '@/components/ui/primitives';
import type { DiagnosticResult as Result, ScoreLine } from '@/types/diagnostic';
import styles from './diagnostic.module.css';

// Resultado del diagnóstico (SCRUM-48/49): el nivel (sugerido o ya confirmado por el profesor) y el avance por tema y
// por nivel. Sin estado: sirve en el servidor y dentro de la pantalla de la prueba.

function Lines({ lines, label }: { lines: ScoreLine[]; label: string }) {
  return (
    <ul role="list" className={styles.lines} aria-label={label}>
      {lines.map((line) => (
        <li key={line.label} className={styles.line}>
          <span>{line.label}</span>
          <small>{line.correct} de {line.total} · {line.percent} %</small>
          <ProgressBar value={line.percent} label={`${line.label}: ${line.percent} %`} color={line.percent >= 60 ? 'var(--ok)' : undefined} />
        </li>
      ))}
    </ul>
  );
}

/** `audience`: el alumno ve un mensaje para él; el profesor, los datos para decidir. */
export function DiagnosticResult({ result, audience }: { result: Result; audience: 'student' | 'teacher' }) {
  const confirmed = result.confirmed;
  return (
    <div className={styles.result}>
      <div className={styles.level} role="status">
        <small>{confirmed ? (audience === 'student' ? 'Nivel confirmado por tu profesor' : 'Nivel confirmado') : 'Nivel sugerido'}</small>
        <b>{(confirmed ?? result.suggested).label}</b>
        {audience === 'student' ? (
          <p>{confirmed
            ? 'Con este nivel empiezas tus clases de Matemáticas.'
            : 'Tu profesor revisará tus respuestas y confirmará el nivel con el que empiezas.'}</p>
        ) : (
          confirmed && confirmed.code !== result.suggested.code && <p>El sistema sugería {result.suggested.label}.</p>
        )}
      </div>
      <section className="section" aria-labelledby="topics-title">
        <h3 id="topics-title">Por tema</h3>
        <Lines lines={result.topics} label="Resultado por tema" />
      </section>
      <section className="section" aria-labelledby="levels-title">
        <h3 id="levels-title">Por nivel</h3>
        <Lines lines={result.levels} label="Resultado por nivel" />
        <p className="muted small">Un nivel se domina con el 60 % de sus preguntas bien.</p>
      </section>
    </div>
  );
}
