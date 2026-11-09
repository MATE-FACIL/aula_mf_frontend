import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/time';
import type { AttendanceMarkStatus, SessionAttendance } from '@/types/admin';
import { markAttendanceAction } from '../actions';
import { SCHEDULE_TIME_ZONE } from '../schedule';
import { ATTENDANCE_NOTE_MAX } from '../validation';
import { ActionForm, SubmitButton } from './action-form';
import styles from './admin.module.css';

// Asistencia de una clase (SCRUM-53). Componente de servidor: la lista es un formulario normal que funciona sin
// JavaScript, y se guarda completa en un solo envío (una petición y una transacción en el backend).

const CHOICES: { value: AttendanceMarkStatus; label: string }[] = [
  { value: 'present', label: 'Asistió' },
  { value: 'late', label: 'Tarde' },
  { value: 'absent', label: 'Faltó' },
];

const LABEL: Record<AttendanceMarkStatus, string> = { present: 'Asistió', late: 'Tarde', absent: 'Faltó' };

export function attendanceCounts(attendance: SessionAttendance) {
  const count = (status: AttendanceMarkStatus) => attendance.students.filter((s) => s.status === status).length;
  return { present: count('present'), late: count('late'), absent: count('absent'), pending: attendance.students.filter((s) => s.enrolled && !s.status).length };
}

export function AttendanceSheet({ attendance }: { attendance: SessionAttendance }) {
  const enrolled = attendance.students.filter((s) => s.enrolled);
  const former = attendance.students.filter((s) => !s.enrolled);

  if (attendance.students.length === 0) {
    return <EmptyState>Este grupo todavía no tiene alumnos con matrícula activa.</EmptyState>;
  }

  if (!attendance.canMark) {
    return (
      <p className={styles.warning} role="status">
        La asistencia se abre a las {formatTime(attendance.opensAt, SCHEDULE_TIME_ZONE)} (hora de Perú), 15 minutos antes de la clase.
      </p>
    );
  }

  return (
    <ActionForm action={markAttendanceAction} className={styles.roster}>
      <input type="hidden" name="sessionId" value={attendance.sessionId} />
      <ol className={styles.rosterList}>
        {enrolled.map((student) => (
          <li key={student.studentUserId} className={styles.rosterItem}>
            <input type="hidden" name="student" value={student.studentUserId} />
            <fieldset className={styles.choices}>
              <legend className={styles.rosterName}>
                {student.fullName}
                {!student.status && <span className={styles.sub}>Sin marcar</span>}
              </legend>
              {CHOICES.map((choice) => (
                <label key={choice.value} className={cn(styles.choice, styles[`choice_${choice.value}`])}>
                  <input type="radio" name={`status-${student.studentUserId}`} value={choice.value} defaultChecked={student.status === choice.value} />
                  {choice.label}
                </label>
              ))}
            </fieldset>
            <input
              className="input"
              name={`note-${student.studentUserId}`}
              maxLength={ATTENDANCE_NOTE_MAX}
              defaultValue={student.note ?? ''}
              placeholder="Nota (opcional)"
              aria-label={`Nota sobre ${student.fullName}`}
            />
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        <SubmitButton className="btn--primary" pendingLabel="Guardando…">Guardar asistencia</SubmitButton>
        <span className={styles.sub}>Los alumnos sin marcar quedan pendientes. Puedes corregirla después.</span>
      </div>
      {former.length > 0 && (
        <div className={styles.formerList}>
          <b>Ya no están en el grupo</b>
          <ul>
            {former.map((s) => (
              <li key={s.studentUserId}>{s.fullName}{s.status ? ` · ${LABEL[s.status]}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </ActionForm>
  );
}
