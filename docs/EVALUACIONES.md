# Evaluaciones con nota automática y plazo

Semanal, intermedia (sesión 8) y final (sesión 14). Cada evaluación es de **un grupo**: la arma el profesor de ese grupo,
la rinden sus alumnos y el backend la corrige (SCRUM-62 backend, SCRUM-63 pantallas).

## Quién hace qué

| Quién | Qué hace | Dónde |
|---|---|---|
| Profesor del grupo | Crea, edita, publica, borra y ve los resultados | Mis grupos → un grupo → **Evaluaciones** |
| Alumno con matrícula activa | Ve las publicadas de su grupo y las rinde | **Evaluaciones** |
| Administrador | Asigna al profesor a un grupo (como siempre) | Administración |

Un profesor solo toca los grupos que tiene asignados: la evaluación o el grupo de otro profesor responde «no encontrado».

## Cómo se arma

- **Datos:** título, tipo (semanal, intermedia, final), cuándo **abre** y **cierra** (hora de Perú), **minutos para rendirla** (5 a 180) y si está **publicada**.
- **Preguntas:** opción múltiple o respuesta numérica (con tolerancia), cada una con su **competencia** y una explicación opcional que el alumno ve al terminar. Máximo 50.
- **Borrador:** mientras no se publica, ningún alumno la ve. Para publicarla necesita al menos una pregunta.
- **Competencias (genéricas por ahora):** Cálculo y operaciones, Razonamiento lógico, Resolución de problemas. Están en el backend (`Competencies`):
  cambiarlas no toca el resto, porque cada pregunta guarda solo el código.

## Cómo se rinde y quién manda en el tiempo

El **servidor** decide todo con su reloj; el del navegador solo dibuja la cuenta regresiva.

1. **Iniciar:** solo entre la apertura y el cierre. Un alumno tiene **un intento**. Si lo inicia dos veces (otra pestaña, recarga), recibe el mismo intento con el mismo reloj.
2. **Plazo del intento:** el tiempo que dura la evaluación contado desde que empezó, sin pasar del cierre.
3. **Enviar:** hasta el plazo más 30 segundos de gracia (red y relojes). Dentro de la gracia se acepta marcada como «fuera de tiempo»; después, se rechaza. Al llegar a 0 la pantalla la envía sola.
4. **Corrección:** en el servidor. Una respuesta ilegible o ausente cuenta como mala, nunca como error. Un segundo envío es un conflicto: nunca hay dos notas.
5. **Nota:** correctas ÷ total × 20, con un decimal, más el porcentaje y el resultado **por competencia**.

La respuesta correcta nunca viaja al navegador del alumno antes de enviar; después recibe la explicación de cada pregunta.

## Cuando ya empezaron

Si al menos un alumno empezó la evaluación, **no se pueden cambiar las preguntas** (la nota de cada uno es sobre las preguntas que vio),
ni volverla a borrador ni borrarla. Sí se puede corregir el título, ampliar el plazo o cambiar los minutos.

## Resultados del profesor

Por evaluación: promedio del grupo sobre 20, cuántos la enviaron, el acierto de todo el grupo por competencia y, por alumno, su estado
(calificada, empezó y no envió, no empezó), su nota y su resultado por competencia. Una alumna que envió y luego salió del grupo conserva su resultado.

## API

- Profesor: `GET /teachers/me/competencies`, `GET|POST /teachers/me/groups/{grupo}/evaluations`, `GET|PUT|DELETE /teachers/me/evaluations/{id}`, `GET /teachers/me/evaluations/{id}/results`.
- Alumno: `GET /students/me/evaluations`, `POST /students/me/evaluations/{id}/attempts`, `POST /students/me/evaluations/attempts/{intento}/submit`, `GET /students/me/evaluations/{id}/result`.

## Qué falta

- Las evaluaciones del **modo demo** (mock) del alumno siguen siendo de ejemplo y no ven lo que crea el profesor en la demo; en modo real (hybrid/http) todo es de verdad.
- La **familia** y el panel del alumno todavía muestran notas de ejemplo; falta conectar el reporte de la familia con estos resultados.
- El administrador aún no gestiona evaluaciones (solo el profesor del grupo).
- El **banco de preguntas por curso** que se habló no existe: las preguntas son de cada evaluación. Para reutilizar, hay que copiar de otra evaluación.

## Pruebas

- Backend: `tests/AulaVirtual.Modules.Exams.Tests/EvaluationTests.cs` (ventana, plazo, gracia, nota, competencias, intento único) y `tests/e2e/evaluations.mjs`.
- Frontend: `features/evaluations/rules.test.ts`, `services/http/assessments.test.ts`, el flujo mock del profesor y `e2e/real/evaluations.mjs`
  (la profesora arma y publica desde el celular, la alumna la rinde, el backend la corrige, los resultados y el acceso de otro profesor).
