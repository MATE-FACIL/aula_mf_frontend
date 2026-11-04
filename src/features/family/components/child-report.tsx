import { Kpi, ProgressBar } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { BadgeGrid, CertificateList, PortfolioGrid } from '@/features/achievements/components/achievements';
import { EvaluationList } from '@/features/assessments/components/evaluation-list';
import { MathLevels } from '@/features/learning/components/learning';
import { AttendanceList } from '@/features/schedule/components/schedule';
import type { ChildOverview, Membership } from '@/types/domain';
import { ChildClasses } from './child-classes';
import styles from './family.module.css';
import { MessageThread, type MessageView } from './message-thread';

// Informe por hijo, organizado en secciones (Resumen, Evaluaciones, Asistencia, Proyectos,
// Certificados y logros, Mensajes, Membresía). Se arma en el servidor; solo pestañas y mensajes son interactivos.

interface Props {
  child: ChildOverview;
  messages: MessageView[];
  membership: Membership;
  timeZone: string;
}

export function ChildReport({ child, messages, membership, timeZone }: Props) {
  const { profile, report } = child;
  const classes = <ChildClasses child={child} timeZone={timeZone} />;

  // Hijo real: el backend aún no tiene notas, asistencia ni proyectos. Se muestra lo que existe, sin inventar datos.
  if (!profile) {
    return (
      <div className={styles.section}>
        {classes}
        <p className={styles.note}>Las notas, la asistencia y los proyectos aparecerán aquí cuando empiecen las clases.</p>
      </div>
    );
  }

  const attended = child.attendance.filter((a) => a.status !== 'absent').length;
  const attendancePct = child.attendance.length ? Math.round((attended / child.attendance.length) * 100) : 0;

  const kpis = (
    <div className={styles.kpis}>
      <Kpi
        label={`Matemáticas · ${profile.stage.toLowerCase()}`}
        value={profile.math.level ?? 'En definición'}
        hint={profile.math.level ? `${profile.math.progress} % del nivel · empezó en ${profile.math.startLevel}` : profile.math.note}
      >
        {profile.math.level && <ProgressBar value={profile.math.progress} />}
      </Kpi>
      <Kpi label="Evaluaciones semanales" value={child.weeklyAverage === null ? '—' : `${child.weeklyAverage} %`} hint="promedio">
        {child.weeklyAverage !== null && <ProgressBar value={child.weeklyAverage} color="var(--ruta-innovator)" />}
      </Kpi>
      <Kpi label="Asistencia" value={`${attended}/${child.attendance.length}`} hint={`${attendancePct} %${report ? ` · ${report.recordingsWatched} grabaciones vistas` : ''}`}>
        <ProgressBar value={attendancePct} color="var(--ok)" />
      </Kpi>
      <Kpi label={`Lab de ${profile.lab.month}`} value={`${profile.lab.progress} %`} hint={profile.lab.name}>
        <ProgressBar value={profile.lab.progress} color="var(--ruta-creator)" />
      </Kpi>
    </div>
  );

  if (!report) {
    return (
      <div className={styles.section}>
        {kpis}
        {classes}
        <p className={styles.note}>
          En primaria los niveles de Matemáticas están en definición; el resto del informe (evaluaciones, asistencia, proyectos, certificados) se mostrará igual que para cada hijo.
        </p>
      </div>
    );
  }

  const summary = (
    <div className={styles.section}>
      <p className={styles.week}>{report.weekLabel}</p>
      {kpis}
      {classes}
      <MathLevels level={profile.math.level} startLevel={profile.math.startLevel} progress={profile.math.progress} />
      <div className={styles.grid}>
        <article className={styles.cardF}>
          <h3>Comentario de la profesora</h3>
          <p className={styles.quote}>«{report.teacherComment.text}»</p>
          <small className="muted">{report.teacherComment.author}</small>
          <p className={styles.next}><b>Siguiente paso:</b> {report.nextStep}</p>
        </article>
        <article className={styles.cardF}>
          <h3>Uso del tutor IA</h3>
          <p><b>{report.tutor.questions} preguntas</b> esta semana · {report.tutor.escalated} enviadas a la profesora</p>
          <ul role="list" className={styles.tags}>{report.tutor.topics.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className={styles.note}>El tutor da pistas y nunca entrega respuestas ni hace tareas. Se pausa en las evaluaciones.</p>
        </article>
        <article className={styles.cardF}>
          <h3>Práctica de la semana</h3>
          <p><b>{report.practice.exercises}</b> ejercicios · <b>{report.practice.accuracy} %</b> de aciertos · {report.practice.minutes} min</p>
          <h3>Avisos</h3>
          <ul role="list" className={styles.alerts}>{report.alerts.map((a) => <li key={a}>⚠️ {a}</li>)}</ul>
        </article>
      </div>
    </div>
  );

  return (
    <Tabs
      label="Secciones del informe"
      variant="chips"
      items={[
        { id: 'resumen', label: 'Resumen', panel: summary },
        {
          id: 'evaluaciones',
          label: 'Evaluaciones',
          panel: (
            <div className={styles.section}>
              <EvaluationList items={child.evaluations} />
              <p className={styles.note}>Las semanales se califican automáticamente; los proyectos del laboratorio los califica el profesor con una rúbrica.</p>
            </div>
          ),
        },
        { id: 'asistencia', label: 'Asistencia', panel: <AttendanceList records={child.attendance} /> },
        {
          id: 'proyectos',
          label: 'Proyectos',
          panel: (
            <div className={styles.section}>
              <p className={styles.note}>Un proyecto por laboratorio mensual.</p>
              <PortfolioGrid items={child.portfolio} />
            </div>
          ),
        },
        { id: 'logros', label: 'Certificados y logros', panel: <div className={styles.section}><CertificateList certificates={child.certificates} /><BadgeGrid badges={child.badges} /></div> },
        { id: 'mensajes', label: 'Mensajes', panel: <MessageThread initial={messages} /> },
        {
          id: 'membresia',
          label: 'Membresía',
          panel: (
            <article className={styles.cardF}>
              <h3>Membresía</h3>
              <p><b>{membership.plan}</b> · {membership.detail}</p>
              <p className={styles.note}>Próxima renovación: {membership.renewalLabel} · Precio {membership.price ?? <span className="tag-demo">Pendiente</span>}</p>
            </article>
          ),
        },
      ]}
    />
  );
}
