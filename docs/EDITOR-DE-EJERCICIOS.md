# Editor de ejercicios de práctica

Cada sesión de un curso tiene una lista ordenada de ejercicios que el alumno resuelve y que se corrigen en el servidor
(SCRUM-59/60/61). Hasta ahora solo se podían cargar por API; este editor lo hace desde el navegador.

## Quién puede editar

| Quién | Dónde | Alcance |
|---|---|---|
| Administrador | Curso → Contenido → una sesión → **Ejercicios de práctica** (`/admin/cursos/{curso}/contenido/sesiones/{sesión}/ejercicios`) | Cualquier curso |
| Profesor | Mis grupos → un grupo → **Ejercicios de práctica** (`/profesor/cursos/{curso}`) → una sesión | Solo los cursos donde tiene un grupo asignado |

El administrador asigna al profesor a un grupo (como siempre). Un profesor que abre un curso que no enseña recibe
«no encontrado», igual que si no existiera. Esa regla la decide el backend, no la pantalla.

## Tipos de ejercicio

- **Opción múltiple:** de 2 a 6 opciones, una correcta (se marca con el círculo), sin opciones repetidas.
- **Respuesta numérica:** un número correcto y una tolerancia (0 = exacto; con 0,01, 3,14 ± 0,01). Se acepta coma o punto.
- Ambos llevan una **explicación** opcional que el alumno ve **después** de responder.

Máximo 30 ejercicios por sesión. Los límites de largo son los del backend (enunciado 1000, explicación 2000, opción 200).

## Qué pasa al guardar

- Se envía la lista completa y en orden. Lo escrito no se pierde si hay un error: se avisa qué falta en qué ejercicio.
- Un ejercicio que ya existía **conserva su identificador**, así que lo que sus alumnos respondieron sigue siendo válido.
- Un ejercicio que se quita **se archiva**: deja de verse para el alumno, pero su historial se conserva y el avance sigue honesto.
- Cambiar el orden solo cambia los números.
- La respuesta correcta nunca viaja al navegador del alumno antes de que responda.

## API

- Administrador: `GET/PUT /courses/{curso}/lessons/{sesión}/exercises` (permiso `courses.manage`).
- Profesor: `GET /teachers/me/courses/{curso}/lessons`, `GET/PUT /teachers/me/courses/{curso}/lessons/{sesión}/exercises`.
  Si el profesor no tiene un grupo en el curso, todo responde 404.

## Pruebas

- Vitest: `src/features/practice/editor-rules.test.ts` (validación, ida y vuelta, envío del servidor).
- Backend: pruebas unitarias del acceso del profesor y `tests/e2e/teacher.mjs`.
- `pnpm e2e:real` → `e2e/real/exercises.mjs`: administrador y profesor en el navegador, el alumno recibe sin respuesta,
  un curso ajeno da «no encontrado», quitar un ejercicio conserva el otro.
