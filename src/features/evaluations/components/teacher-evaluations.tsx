import Link from 'next/link';
import { EmptyState, Kpi, SectionTitle } from '@/components/ui/primitives';
import admin from '@/features/admin/components/admin.module.css';
import { formatShortDate, formatShortWeekday, formatTime } from '@/lib/time';
import type { CompetencyScore, EvaluationResults, StudentEvaluationResult, TeacherEvaluation } from '@/types/evaluations';
import { EVALUATION_TIME_ZONE, KIND_LABEL, windowState } from '../rules';
import styles from './evaluations.module.css';

// Pantallas de evaluaciones del profesor (SCRUM-62/63): la lista de un grupo y los resultados de una evaluación.
// Componentes de servidor (sin JavaScript en el navegador). Las horas, en la de Perú, como el horario.

const when = (iso: string) => `${formatShortWeekday(iso, EVALUATION_TIME_ZONE)} ${formatShortDate(iso, EVALUATION_TIME_ZONE)} · ${formatTime(iso, EVALUATION_TIME_ZONE)}`;
const number = (value: number) => String(value).replace('.', ',');

const WINDOW_LABEL = { upcoming: 'Próxima', open: 'Abierta', closed: 'Cerrada' } as const;

export function GroupEvaluations({ offeringId, evaluations, now }: { offeringId: string; evaluations: TeacherEvaluation[]; now: number }) {
  return (
    <>
      <SectionTitle title="Evaluaciones" action={<Link className="btn btn--sm" href={`/profesor/grupos/${offeringId}/evaluaciones/nueva`}>Nueva evaluación</Link>} />
      {evaluations.length === 0 ? (
        <EmptyState>Este grupo todavía no tiene evaluaciones. Crea la primera: se corrige sola y te da la nota de cada alumno.</EmptyState>
      ) : (
        <ul role="list" className={styles.list}>
          {evaluations.map((item) => (
            <li key={item.id} className="card">
              <div className={styles.row}>
                <div>
                  <b>{item.title}</b>{' '}
                  <span className={admin.badge}>{KIND_LABEL[item.kind]}</span>{' '}
                  <span className={styles.status}>{item.isPublished ? WINDOW_LABEL[windowState(item.opensAt, item.closesAt, now)] : 'Borrador'}</span>
                  <small className={styles.small}>Abre {when(item.opensAt)} · cierra {when(item.closesAt)} · {item.durationMinutes} min</small>
                  <small className={styles.small}>
                    {item.questionCount} {item.questionCount === 1 ? 'pregunta' : 'preguntas'} · {item.submitted} de {item.enrolled} {item.enrolled === 1 ? 'alumno la envió' : 'alumnos la enviaron'}
                  </small>
                </div>
                <div className={styles.rowLinks}>
                  <Link className="btn btn--sm" href={`/profesor/evaluaciones/${item.id}`}>Editar</Link>
                  <Link className="btn btn--sm" href={`/profesor/evaluaciones/${item.id}/resultados`}>Resultados</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Competencies({ items }: { items: CompetencyScore[] }) {
  if (items.length === 0) return <small className={styles.muted}>—</small>;
  return (
    <>
      {items.map((item) => (
        <small key={item.competency} className={styles.small}>{item.label}: <b>{item.correct}/{item.total}</b></small>
      ))}
    </>
  );
}

const STATUS_LABEL: Record<StudentEvaluationResult['status'], string> = { graded: 'Calificada', in_progress: 'Empezó y no envió', not_started: 'No empezó' };

export function ResultsView({ results }: { results: EvaluationResults }) {
  const { evaluation, students, byCompetency, averageScore } = results;
  const graded = students.filter((student) => student.status === 'graded').length;
  return (
    <>
      <div className="grid-3">
        <Kpi label="Promedio del grupo" value={averageScore === null ? '—' : `${number(averageScore)} / 20`} hint={graded === 0 ? 'Nadie la ha enviado' : `${graded} calificadas`} />
        <Kpi label="Enviaron" value={`${evaluation.submitted} / ${evaluation.enrolled}`} hint={`${evaluation.started} empezaron`} />
        <Kpi label="Preguntas" value={evaluation.questionCount} hint={`${evaluation.durationMinutes} min para rendirla`} />
      </div>

      <section className="section" aria-labelledby="by-competency-title">
        <SectionTitle title={<span id="by-competency-title">Resultado por competencia (todo el grupo)</span>} />
        {byCompetency.length === 0 ? (
          <EmptyState>Cuando los alumnos envíen la evaluación, verás aquí en qué competencias acertó el grupo.</EmptyState>
        ) : (
          <ul role="list" className={styles.competencies}>
            {byCompetency.map((item) => (
              <li key={item.competency} className="card">
                <div className={styles.competency}>
                  <b>{item.label}</b>
                  <span>{item.total === 0 ? '—' : Math.round((item.correct * 100) / item.total)} % de aciertos</span>
                  <small className={styles.muted}>{item.correct} de {item.total} respuestas correctas</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="students-title">
        <SectionTitle title={<span id="students-title">Alumnos</span>} />
        {students.length === 0 ? (
          <EmptyState>Este grupo todavía no tiene alumnos con matrícula activa.</EmptyState>
        ) : (
          <div className={admin.tableWrap}>
            <table className={admin.table}>
              <thead>
                <tr><th>Alumno</th><th>Estado</th><th>Nota</th><th>Por competencia</th></tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.studentUserId}>
                    <td data-label="Alumno"><b>{student.fullName}</b></td>
                    <td data-label="Estado">
                      {STATUS_LABEL[student.status]}
                      {student.isLate && <small className={styles.late}>Enviada fuera de tiempo</small>}
                    </td>
                    <td data-label="Nota">
                      {student.score === null ? <span className={styles.muted}>—</span> : <b>{number(student.score)} / 20 <small className={styles.muted}>({student.percent} %)</small></b>}
                    </td>
                    <td data-label="Por competencia"><Competencies items={student.byCompetency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
