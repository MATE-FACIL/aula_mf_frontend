import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { provisionMathLevelsAction } from '@/features/admin/actions';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import styles from '@/features/admin/components/admin.module.css';
import { cn } from '@/lib/cn';
import { requireSession } from '@/server/auth/dal';
import { services } from '@/services';
import type { MathLevel } from '@/types/admin';

export const metadata: Metadata = { title: 'Niveles de Matemáticas' };

// Niveles de Matemáticas (SCRUM-39): cuatro por etapa, cada uno es un curso con sus 14 sesiones.
export default function MathLevelsPage() {
  return (
    <div className="page">
      <Link className="link" href="/admin/cursos">← Cursos</Link>
      <PageHeader
        title="Niveles de Matemáticas"
        description="Prebásico, Básico, Intermedio y Avanzado para primaria y secundaria. Cada nivel es un curso con sus 14 sesiones."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Levels />
      </Suspense>
    </div>
  );
}

async function Levels() {
  const ctx = await requireSession('admin');
  const levels = await services.admin.listMathLevels(ctx);
  const missing = levels.filter((level) => !level.courseId).length;

  return (
    <>
      {missing > 0 && (
        <section className="card section">
          <p>
            Faltan <b>{missing} de 8</b> niveles. Se crean como cursos en borrador, cada uno con 14 sesiones en borrador para que el
            equipo académico cargue el contenido. Los niveles que ya existen no se tocan.
          </p>
          <ActionForm action={provisionMathLevelsAction}>
            <SubmitButton className="btn--primary" pendingLabel="Creando…">Crear los niveles que faltan</SubmitButton>
          </ActionForm>
        </section>
      )}
      {(['primary', 'secondary'] as const).map((stage) => (
        <section key={stage} className="section" aria-labelledby={`etapa-${stage}`}>
          <h2 id={`etapa-${stage}`}>{stage === 'primary' ? 'Primaria' : 'Secundaria'}</h2>
          <ul className={styles.levels} role="list">
            {levels.filter((level) => level.stage === stage).map((level) => <LevelCard key={level.level} level={level} />)}
          </ul>
        </section>
      ))}
    </>
  );
}

function LevelCard({ level }: { level: MathLevel }) {
  if (!level.courseId) {
    return (
      <li className={cn(styles.level, styles.levelMissing)}>
        <h3>{level.levelLabel}</h3>
        <span>Sin crear · clases de {level.sessionMinutes} min</span>
      </li>
    );
  }
  return (
    <li className={styles.level}>
      <h3><Link href={`/admin/cursos/${level.courseId}`}>{level.levelLabel}</Link></h3>
      <span className={styles.sub}>{level.courseTitle}</span>
      <span>{level.lessons} sesiones · {level.publishedLessons} publicadas</span>
      <span className={styles.sub}>Clases de {level.sessionMinutes} min · {level.coursePublished ? 'curso publicado' : 'curso en borrador'}</span>
    </li>
  );
}
