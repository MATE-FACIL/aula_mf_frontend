import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { DiagnosticStageSummary } from '@/types/diagnostic';
import { startDiagnosticAction } from '../actions';
import { answeredLabel } from '../rules';
import styles from './diagnostic.module.css';

// Resumen del alumno (SCRUM-49): una tarjeta por etapa. Componente de servidor; el único JavaScript es el envío del
// formulario para empezar.

const DESCRIPTION: Record<DiagnosticStageSummary['stage'], string> = {
  primary: 'Para alumnos de 3.º a 6.º de primaria.',
  secondary: 'Para alumnos de 1.º a 5.º de secundaria.',
};

function StageCard({ stage }: { stage: DiagnosticStageSummary }) {
  const href = stage.attemptId ? `/diagnostico/${stage.attemptId}` : null;
  return (
    <article className={cn('card', styles.stage)}>
      <h2>{stage.stageLabel}</h2>
      <p>{DESCRIPTION[stage.stage]}</p>
      {stage.status === 'completed' && stage.result ? (
        <>
          <p className={styles.stageState}>
            Terminado · {stage.result.confirmed ? `Nivel confirmado: ${stage.result.confirmed.label}` : `Nivel sugerido: ${stage.result.suggested.label}`}
          </p>
          <Link className="btn" href={href!}>Ver mi resultado</Link>
        </>
      ) : stage.status === 'in_progress' ? (
        <>
          <p className={styles.stageState}>En curso · {answeredLabel(stage.answered, stage.total)}</p>
          <Link className="btn btn--primary" href={href!}>Continuar</Link>
        </>
      ) : stage.available ? (
        <form action={startDiagnosticAction}>
          <input type="hidden" name="stage" value={stage.stage} />
          <button className="btn btn--primary" type="submit">Empezar el diagnóstico</button>
        </form>
      ) : (
        <p className={styles.stageState}>Todavía no está disponible.</p>
      )}
    </article>
  );
}

export function DiagnosticOverview({ stages, error }: { stages: DiagnosticStageSummary[]; error: boolean }) {
  return (
    <>
      {error && <p className={styles.alert} role="alert">Este diagnóstico todavía no está disponible. Avísale a tu profesor.</p>}
      <div className={styles.stages}>
        {stages.map((stage) => <StageCard key={stage.stage} stage={stage} />)}
      </div>
    </>
  );
}
