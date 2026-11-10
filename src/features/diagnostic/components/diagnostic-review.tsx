import Link from 'next/link';
import { EmptyState, SectionTitle } from '@/components/ui/primitives';
import admin from '@/features/admin/components/admin.module.css';
import { SCHEDULE_TIME_ZONE } from '@/features/admin/schedule';
import { cn } from '@/lib/cn';
import { formatShortDate, formatTime } from '@/lib/time';
import type { DiagnosticFilter, DiagnosticListItem, DiagnosticPage, DiagnosticReview as Review } from '@/types/diagnostic';
import { answeredLabel, decimalComma, FILTERS } from '../rules';
import { ConfirmLevelForm } from './confirm-level-form';
import { DiagnosticResult } from './diagnostic-result';
import styles from './diagnostic.module.css';

// Revisión del diagnóstico (SCRUM-48) para el profesor y el administrador: la misma pantalla en las dos áreas, con su
// propia ruta base. Componentes de servidor; solo el formulario de confirmación usa JavaScript.

const tz = SCHEDULE_TIME_ZONE;
const when = (iso: string) => `${formatShortDate(iso, tz)} · ${formatTime(iso, tz)}`;

function State({ item }: { item: DiagnosticListItem }) {
  if (item.status === 'in_progress') return <span className="muted">En curso · {answeredLabel(item.answered, item.total)}</span>;
  if (item.confirmed) return <span>Confirmado: <b>{item.confirmed.label}</b></span>;
  return <span className={admin.badge}>Por confirmar</span>;
}

export function DiagnosticList({ page, filter, basePath }: { page: DiagnosticPage; filter: DiagnosticFilter; basePath: string }) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const href = (value: DiagnosticFilter, number = 1) => `${basePath}?estado=${value}${number > 1 ? `&pagina=${number}` : ''}`;
  return (
    <>
      <nav className={styles.filters} aria-label="Filtrar diagnósticos">
        {FILTERS.map((f) => (
          <Link key={f.value} className="btn btn--sm" href={href(f.value)} aria-current={f.value === filter ? 'page' : undefined}>{f.label}</Link>
        ))}
      </nav>
      {page.items.length === 0 ? (
        <EmptyState>{filter === 'pending' ? 'No hay diagnósticos por confirmar.' : 'No hay diagnósticos en esta lista.'}</EmptyState>
      ) : (
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr><th>Alumno</th><th>Etapa</th><th>Sugerido</th><th>Estado</th><th>Empezó (hora de Perú)</th><th><span className="visually-hidden">Acciones</span></th></tr>
            </thead>
            <tbody>
              {page.items.map((item) => (
                <tr key={item.attemptId}>
                  <td data-label="Alumno"><b>{item.studentName}</b></td>
                  <td data-label="Etapa">{item.stageLabel}</td>
                  <td data-label="Sugerido">{item.suggested?.label ?? '—'}</td>
                  <td data-label="Estado"><State item={item} /></td>
                  <td data-label="Empezó">{when(item.startedAt)}</td>
                  <td data-label="">
                    <Link className={cn('btn btn--sm', item.status === 'completed' && !item.confirmed && 'btn--primary')} href={`${basePath}/${item.attemptId}`}>
                      {item.status === 'completed' && !item.confirmed ? 'Revisar y confirmar' : 'Ver'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Páginas">
          {page.page > 1 ? <Link className="btn btn--sm" href={href(filter, page.page - 1)}>← Anterior</Link> : <span />}
          <span className="muted small">Página {page.page} de {pages} · {page.total} diagnósticos</span>
          {page.page < pages ? <Link className="btn btn--sm" href={href(filter, page.page + 1)}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export function DiagnosticReviewDetail({ review }: { review: Review }) {
  const { summary, result } = review;
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{summary.studentName}</h1>
          <p>Diagnóstico de {summary.stageLabel.toLowerCase()} · empezó el {when(summary.startedAt)}
            {summary.completedAt && <> · terminó el {when(summary.completedAt)}</>}</p>
        </div>
      </header>

      {result ? (
        <div className="grid-2">
          <section className="card section" aria-labelledby="level-title">
            <SectionTitle title={<span id="level-title">Resultado</span>} />
            <DiagnosticResult result={result} audience="teacher" />
          </section>
          <section className="card section" aria-labelledby="confirm-title">
            <SectionTitle title={<span id="confirm-title">{summary.confirmed ? 'Nivel confirmado' : 'Confirmar el nivel'}</span>} />
            {summary.confirmed && review.confirmedByName && (
              <p className="muted small">{summary.confirmed.label}, confirmado por {review.confirmedByName}
                {review.confirmedAt && <> el {when(review.confirmedAt)}</>}.</p>
            )}
            <p className="small">Revisa las respuestas de abajo. Puedes confirmar el nivel sugerido o elegir otro.</p>
            {/* key: tras confirmar, el formulario vuelve a montarse con el nivel guardado. */}
            <ConfirmLevelForm
              key={(summary.confirmed ?? result.suggested).code}
              attemptId={summary.attemptId}
              initial={(summary.confirmed ?? result.suggested).code}
              confirmed={!!summary.confirmed}
            />
          </section>
        </div>
      ) : (
        <p className="card">El alumno todavía está rindiendo el diagnóstico ({answeredLabel(summary.answered, summary.total)}). Podrás confirmar el nivel cuando termine.</p>
      )}

      <section className="section" aria-labelledby="answers-title">
        <SectionTitle title={<span id="answers-title">Respuestas</span>} />
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr><th>#</th><th>Pregunta</th><th>Tema · nivel</th><th>Respondió</th><th>Correcta</th></tr>
            </thead>
            <tbody>
              {review.answers.map((a) => (
                <tr key={a.number}>
                  <td data-label="#">{a.number}</td>
                  <td data-label="Pregunta">
                    {a.prompt}
                    {a.explanation && <p className={styles.explain}>{a.explanation}</p>}
                  </td>
                  <td data-label="Tema · nivel">{a.topic} · {a.levelLabel}</td>
                  <td data-label="Respondió">
                    {!a.answered ? <span className={styles.skipped}>Sin responder</span>
                      : a.answer === null ? <span className={styles.skipped}>No lo sé</span>
                        : <span className={a.isCorrect ? styles.right : styles.wrong}>{a.isCorrect ? '✔' : '✖'} {a.answer}</span>}
                  </td>
                  <td data-label="Correcta">{decimalComma(a.correctAnswer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
