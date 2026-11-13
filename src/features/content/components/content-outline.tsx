import Link from 'next/link';
import { SectionTitle } from '@/components/ui/primitives';
import { ActionForm, SubmitButton } from '@/features/admin/components/action-form';
import { cn } from '@/lib/cn';
import type { ContentLesson, ContentUnit, CourseContent } from '@/types/content';
import { addUnitAction, deleteUnitAction, moveLessonAction, moveUnitAction, renameUnitAction } from '../actions';
import { moveInOrder, UNIT_TITLE_MAX } from '../rules';
import styles from './content.module.css';

// El esquema del curso (SCRUM-71): unidades con sus sesiones, en orden. Componentes de servidor; los botones son
// formularios con Server Actions (funcionan sin JavaScript). Subir o bajar manda el orden nuevo completo.

export const lessonHref = (courseId: string, lessonId: string) => `/admin/cursos/${courseId}/contenido/sesiones/${lessonId}`;
export const newLessonHref = (courseId: string, unitId: string) => `/admin/cursos/${courseId}/contenido/sesiones/nueva?unidad=${unitId}`;

/** Subir (-1) o bajar (1) un elemento: un formulario con el orden nuevo, o un botón apagado en el borde. */
function MoveButtons({ courseId, ids, id, label, action, unitId }: {
  courseId: string; ids: string[]; id: string; label: string; action: typeof moveUnitAction; unitId?: string;
}) {
  return (
    <>
      {([['↑', 'Subir', -1], ['↓', 'Bajar', 1]] as const).map(([symbol, verb, direction]) => {
        const next = moveInOrder(ids, id, direction);
        if (!next) return <button key={verb} type="button" className="btn btn--sm" disabled aria-label={`${verb} ${label} (no se puede)`}>{symbol}</button>;
        return (
          <ActionForm key={verb} action={action}>
            <input type="hidden" name="courseId" value={courseId} />
            {unitId && <input type="hidden" name="unitId" value={unitId} />}
            <input type="hidden" name="ids" value={next.join(',')} />
            <button type="submit" className="btn btn--sm" aria-label={`${verb} ${label}`}>{symbol}</button>
          </ActionForm>
        );
      })}
    </>
  );
}

function LessonRow({ courseId, unit, lesson }: { courseId: string; unit: ContentUnit; lesson: ContentLesson }) {
  const ids = unit.lessons.map((item) => item.id);
  const files = lesson.materials.filter((m) => m.fileId).length;
  return (
    <li className={styles.lesson}>
      <span className={styles.lessonMain}>
        <span className={styles.number}>Sesión {lesson.number}</span>
        <Link href={lessonHref(courseId, lesson.id)}>{lesson.title}</Link>
        <span className={styles.badges}>
          <span className={cn(styles.badge, lesson.isPublished ? styles.badgeOk : styles.badgeDraft)}>{lesson.isPublished ? 'Publicada' : 'Borrador'}</span>
          {(lesson.videoUrl || lesson.videoFileId) && <span className={styles.badge}>{lesson.videoFileId ? 'Video subido' : 'Video'}</span>}
          {lesson.materials.length > 0 && (
            <span className={styles.badge}>{lesson.materials.length} {lesson.materials.length === 1 ? 'material' : 'materiales'}{files > 0 ? ` (${files} ${files === 1 ? 'archivo' : 'archivos'})` : ''}</span>
          )}
        </span>
      </span>
      <span className={styles.tools}>
        <MoveButtons courseId={courseId} ids={ids} id={lesson.id} label={`la sesión ${lesson.title}`} action={moveLessonAction} unitId={unit.id} />
        <Link className="btn btn--sm btn--primary" href={lessonHref(courseId, lesson.id)}>Editar</Link>
      </span>
    </li>
  );
}

function UnitCard({ courseId, unit, unitIds }: { courseId: string; unit: ContentUnit; unitIds: string[] }) {
  return (
    <section className={cn('card', styles.unit)} aria-label={`Unidad ${unit.title}`}>
      <div className={styles.unitHead}>
        <ActionForm action={renameUnitAction} className={styles.rename}>
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="unitId" value={unit.id} />
          <label className="label">
            Unidad {unit.position}
            <input className="input" name="title" defaultValue={unit.title} maxLength={UNIT_TITLE_MAX} required aria-label={`Nombre de la unidad ${unit.position}`} />
          </label>
          <SubmitButton className="btn--sm" pendingLabel="Guardando…">Guardar nombre</SubmitButton>
        </ActionForm>
        <span className={styles.tools}>
          <MoveButtons courseId={courseId} ids={unitIds} id={unit.id} label={`la unidad ${unit.title}`} action={moveUnitAction} />
          {unit.lessons.length === 0 && (
            <ActionForm action={deleteUnitAction} confirmMessage={`¿Borrar la unidad «${unit.title}»?`}>
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="unitId" value={unit.id} />
              <SubmitButton className="btn--sm" pendingLabel="Borrando…">Borrar unidad</SubmitButton>
            </ActionForm>
          )}
        </span>
      </div>
      {unit.lessons.length === 0 ? (
        <p className={styles.empty}>Esta unidad todavía no tiene sesiones.</p>
      ) : (
        <ol role="list" className={styles.lessons}>
          {unit.lessons.map((lesson) => <LessonRow key={lesson.id} courseId={courseId} unit={unit} lesson={lesson} />)}
        </ol>
      )}
      <div><Link className="btn btn--sm" href={newLessonHref(courseId, unit.id)}>+ Nueva sesión</Link></div>
    </section>
  );
}

export function ContentOutline({ content }: { content: CourseContent }) {
  const unitIds = content.units.map((unit) => unit.id);
  return (
    <div className={styles.outline}>
      {content.units.length === 0 && <p className={styles.empty}>Este curso todavía no tiene unidades. Crea la primera aquí abajo.</p>}
      {content.units.map((unit) => <UnitCard key={unit.id} courseId={content.courseId} unit={unit} unitIds={unitIds} />)}
      <section className="card section" aria-labelledby="new-unit-title">
        <SectionTitle as="h2" title={<span id="new-unit-title">Nueva unidad</span>} />
        <ActionForm action={addUnitAction} className={styles.newUnit} resetOnSuccess>
          <input type="hidden" name="courseId" value={content.courseId} />
          <label className="label">
            Nombre de la unidad
            <input className="input" name="title" maxLength={UNIT_TITLE_MAX} required placeholder="Ej.: Fracciones" />
          </label>
          <SubmitButton className="btn--primary" pendingLabel="Creando…">Crear unidad</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
