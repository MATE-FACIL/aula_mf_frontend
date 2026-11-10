# Pruebas del aula

Resultados del 10 de noviembre de 2026 sobre la rama `feature/scrum-45-asignacion-grupo`, con la asignación a grupo según el diagnóstico (SCRUM-45), el diagnóstico de entrada (SCRUM-48 y SCRUM-49), la práctica del alumno (SCRUM-61) y las pantallas del profesor (SCRUM-70). Las capturas y animaciones salen de un navegador real (Microsoft Edge) con el aula conectada a la API .NET y PostgreSQL en Docker. Las personas y los correos son ficticios, y los datos de acceso aparecen difuminados.

| Prueba | Dónde corre | Resultado |
|---|---|---|
| Unitarias (Vitest) | En memoria | **103 de 103**, en 21 archivos |
| Tipos (`tsc`) y lint (ESLint) | Código | Sin errores |
| Recorrido en navegador real | Aula conectada a la API en Docker | **33 de 33** |
| Panel de la familia con login real | Aula conectada a la API en Docker | **7 de 7** |
| Sesión y renovación | Aula conectada a la API en Docker | **12 de 12** |
| Práctica y profesor con login real | Aula conectada a la API en Docker | **18 de 18** |
| Diagnóstico con login real | Aula conectada a la API en Docker | **19 de 19** |
| Asignación a grupo y cambio de grupo | Aula conectada a la API en Docker | **16 de 16** |
| Contraste y desborde | Modo mock | 272 combinaciones: 0 problemas |
| Flujos en celular, tableta y modo oscuro | Modo mock | **38 de 38** |

Las dos pruebas en modo mock pasaron en Edge y en Chromium, el navegador del CI.

La lista completa está en [pruebas-unitarias.md](pruebas-unitarias.md). Las pruebas de la API están en las [pruebas del backend](https://github.com/MATE-FACIL/aula_mf_backend/blob/main/docs/pruebas/README.md).

## Limitaciones

**El aula corrió en modo híbrido.** El backend todavía no tiene todos los módulos, así que parte de lo que se ve son datos de ejemplo:

| Pantalla | Datos reales | Datos de ejemplo |
|---|---|---|
| Administración | Todo, incluida la asignación a grupo | Nada |
| Familia | Hijos, matrículas, próximas clases, profesores y asistencia | Notificación de la campana |
| Alumno | Clases en vivo, calendario, enlace para entrar, asistencia, **Mis prácticas** (ejercicios, corrección y avance) y el **diagnóstico de entrada** | Nombre del saludo («Valentina»), estrellas, la lección de ejemplo de «Lecciones», tareas, notas y avisos |
| Profesor | Todo | Nada |

**La sesión de administrador se firmó localmente.** Se usó la clave de desarrollo de Docker, sin pasar por el formulario de ingreso. Los logins de familia, alumno y profesor sí fueron reales, por el formulario.

**Las lecciones (SCRUM-55) y sus archivos (SCRUM-58) todavía no tienen pantalla.** Su API está lista y probada (ver las pruebas del backend); la pantalla del alumno es SCRUM-56 y la carga desde el panel es SCRUM-71. La práctica sí la tiene: «Lecciones › Mis prácticas». Los ejercicios se cargan por la API (`PUT /courses/{id}/lessons/{id}/exercises`) hasta que exista la pantalla de carga.

**El profesor ve asistencia y avance de práctica, todavía no notas.** Las notas llegan con las evaluaciones (SCRUM-62).

**El contraste se midió solo en modo mock.** El recorrido real comprobó el desborde horizontal en celular y tablet, pero no volvió a medir el contraste.

## Interacción

### Administración: crear alumno y grupo, publicar y gestionar matrículas

![Recorrido del administrador en escritorio](interaccion/admin-escritorio.gif)

### Familia: ingresar y cambiar de hijo

![Recorrido de la familia en escritorio](interaccion/familia-escritorio.gif)

### Alumno: ingresar y ver sus clases (celular, modo oscuro)

<img src="interaccion/alumno-celular.gif" alt="Recorrido del alumno en celular" width="300">

### Administración en celular (modo oscuro)

<img src="interaccion/admin-celular.gif" alt="Recorrido del administrador en celular" width="300">

## Cómo se ve

### Familia

Hija con matrícula activa y sus próximas clases:

![Panel de la familia con matrícula activa](capturas/familia-02-hija-activa-escritorio.png)

Hijo con matrícula pendiente de pago, todavía sin clases:

![Panel de la familia con matrícula pendiente](capturas/familia-03-hijo-pendiente-escritorio.png)

Celular y tablet:

<img src="capturas/familia-04-celular-claro.png" alt="Familia en celular, modo claro" width="240"> <img src="capturas/familia-04-celular-oscuro.png" alt="Familia en celular, modo oscuro" width="240"> <img src="capturas/familia-04-tablet-oscuro.png" alt="Familia en tablet, modo oscuro" width="320">

### Administración

Resumen, alumno creado y catálogo de cursos:

![Resumen del administrador](capturas/admin-01-resumen-escritorio.png)

![Alumno creado con sus datos de acceso difuminados](capturas/admin-02-alumno-creado-escritorio.png)

![Lista de cursos](capturas/admin-03-cursos-escritorio.png)

Horario generado, grupo publicado y matrículas:

![Horario generado](capturas/admin-04-horario-generado-escritorio.png)

![Grupo publicado](capturas/admin-05-grupo-publicado-escritorio.png)

![Matrículas](capturas/admin-06-matriculas-escritorio.png)

Asistencia de una clase (SCRUM-53): se marca toda la lista y se guarda en un solo envío.

![Asistencia de una clase](capturas/admin-08-asistencia-escritorio.png)

<img src="capturas/admin-09-asistencia-celular-oscuro.png" alt="Asistencia en celular, modo oscuro" width="280">

Niveles de Matemáticas (SCRUM-39): los 8 niveles con sus 14 sesiones, y el botón para crear los que falten.

![Niveles de Matemáticas](capturas/admin-10-niveles-escritorio.png)

<img src="capturas/admin-11-niveles-celular-oscuro.png" alt="Niveles en celular, modo oscuro" width="280">

Celular en modo oscuro:

<img src="capturas/admin-07-resumen-celular-oscuro.png" alt="Resumen en celular" width="240"> <img src="capturas/admin-07-usuarios-celular-oscuro.png" alt="Usuarios en celular" width="240"> <img src="capturas/admin-07-cursos-celular-oscuro.png" alt="Cursos en celular" width="240"> <img src="capturas/admin-07-matriculas-celular-oscuro.png" alt="Matrículas en celular" width="240">

Asignación a grupo (SCRUM-45). En escritorio, la ficha del alumno muestra qué dijo el diagnóstico (aquí, nivel confirmado Básico) y la matrícula con «Cambiar de grupo»; el selector de grupos pone primero los de ese nivel. En el celular, el formulario de cambio abierto:

<img src="capturas/admin-12-asignacion-escritorio.png" alt="Ficha del alumno con su nivel confirmado y sus matrículas" width="420"> <img src="capturas/admin-14-cambio-grupo-celular.png" alt="Formulario de cambio de grupo en el celular" width="240">

Después del cambio, la matrícula anterior dice a dónde cambió y el historial lo registra con su motivo:

<img src="capturas/admin-13-cambio-grupo-escritorio.png" alt="Ficha del alumno tras el cambio de grupo, con el historial" width="420">

### Alumno

Inicio y clases en celular con modo oscuro. La clase real muestra «Entrar» cuando faltan pocos minutos:

<img src="capturas/alumno-01-inicio-celular-oscuro.png" alt="Inicio del alumno" width="280"> <img src="capturas/alumno-02-clases-celular-oscuro.png" alt="Clases del alumno con el botón Entrar" width="280">

Práctica en el celular (SCRUM-61). A la izquierda, un acierto con su explicación; a la derecha, la práctica real terminada:

<img src="capturas/alumno-04-practica-respuesta-celular.png" alt="Ejercicio respondido con su explicación" width="280"> <img src="capturas/alumno-03-practica-celular.png" alt="Práctica terminada contra la API real" width="280">

Diagnóstico de entrada en el celular (SCRUM-49). A la izquierda, una pregunta con la barra de avance y «No lo sé»; a la derecha, el resultado por tema con el nivel sugerido:

<img src="capturas/alumno-05-diagnostico-celular.png" alt="Pregunta del diagnóstico con barra de avance" width="280"> <img src="capturas/alumno-06-diagnostico-resultado-celular.png" alt="Resultado del diagnóstico con el nivel sugerido" width="280">

### Profesor

Su grupo en tableta, con las clases, la asistencia y el avance de práctica de cada alumno (SCRUM-70):

<img src="capturas/profesor-01-grupo-tableta.png" alt="Grupo del profesor en tableta" width="420">

Asistencia tras «Todos presentes»: los dos alumnos quedan marcados en el backend y en la lista:

<img src="capturas/profesor-02-asistencia-tableta.png" alt="Asistencia del profesor en tableta" width="420">

Revisión del diagnóstico en tableta (SCRUM-48): el resultado, cada respuesta con la correcta y su explicación, y el nivel ya confirmado (el sistema sugería Básico; el profesor eligió Prebásico):

<img src="capturas/profesor-03-diagnostico-tableta.png" alt="Revisión del diagnóstico en tableta" width="420">

## Qué se comprobó en el navegador

### Administración en escritorio

- Crear alumno muestra sus datos de acceso una sola vez
- Matricular: el grupo en borrador aparece deshabilitado
- El generador arma 4 clases
- Crear el grupo en la API lleva a su ficha
- Asignar profesor muestra el aviso
- Publicar muestra el aviso aunque el botón desaparezca
- Activar matrícula actualiza la fila
- Retirar matrícula libera el cupo
- Asistencia: se guarda la lista y el resumen la cuenta
- Niveles: los 8 existen, cada uno con sus sesiones

### Administración en celular

- /admin sin desborde horizontal
- /admin/usuarios sin desborde horizontal
- /admin/cursos sin desborde horizontal
- /admin/matriculas sin desborde horizontal
- Ficha del curso sin desborde horizontal
- Niveles sin desborde horizontal
- Asistencia sin desborde horizontal

### Familia

- Login real con rol familia lleva a /familia
- La contraseña no queda escrita en la página oculta
- Se ve a la hija con su curso y profesora reales
- No aparecen datos de ejemplo
- Ve la asistencia real de su hija
- Cambiar de hijo muestra su matrícula pendiente
- celular-oscuro sin desborde horizontal
- tablet-oscuro sin desborde horizontal
- celular-claro sin desborde horizontal
- login real de la madre con rol familia
- muestra a sus dos hijos con su nombre real
- no aparece el hijo de otra familia
- matrículas, próximas clases y profesor reales
- pendiente con su aviso
- sin datos de ejemplo de otros niños
- padre sin hijos ve un mensaje claro

### Alumno

- Login real lleva a /inicio
- La contraseña no queda escrita en la página oculta
- /clases muestra el curso real
- La clase próxima ofrece «Entrar» con su enlace
- /clases sin desborde horizontal
- /clases muestra su asistencia real

### Sesión

- login real: redirige y guarda sesión, rol y renovación
- la sesión dura 7 días (no 15 min)
- la cookie de renovación es httpOnly
- /clases muestra el curso real del backend
- /clases: la clase que empieza en 5 min tiene «Entrar» con el enlace real
- /inicio muestra la próxima clase real
- 4 peticiones simultáneas a punto de vencer: todas cargan
- todas reciben el MISMO token de renovación nuevo (una sola renovación)
- reciben un token de acceso nuevo
- la sesión NO fue revocada (se renueva otra vez con el token rotado)
- token vigente: no renueva (sin Set-Cookie de sesión)
- renovación rechazada → /ingreso?expirada=1

### Práctica y profesor

- mis prácticas: el curso real con su lección y 0 de 2
- la práctica llega sin la respuesta ni la explicación
- una lección que no es suya (o no existe) → «no encontrada», sin datos
- incorrecta: el backend corrige y llega su explicación
- correcta: el avance real sube a 1 de 2
- termina la práctica con 2 de 2
- práctica sin desborde en el celular
- login real del profesor: rol teacher
- mis grupos: solo su grupo real, sin el del otro profesor
- el grupo: alumnos reales con su avance de práctica
- el grupo de otro profesor → «no encontrado», sin sus datos
- el profesor no entra a la administración
- la clase de hoy: 2 alumnos sin marcar
- asistencia en un clic: los 2 quedan presentes en el backend
- la lista se actualiza: los 2 aparecen marcados «Asistió»
- asistencia sin desborde en tableta
- el backend guardó las 2 marcas
- sin errores en el navegador

### Diagnóstico de entrada

- mi ruta lleva al diagnóstico
- diagnóstico: primaria disponible para empezar
- la prueba llega sin respuestas ni explicaciones
- empieza en 0 de 4 con su barra de avance
- sin responder: avisa y no gasta una petición
- responde sin decir si acertó: solo avanza
- al terminar: nivel sugerido Básico y resultado por tema
- diagnóstico sin desborde en el celular
- el profesor ve el diagnóstico por confirmar
- el profesor no entra a la pantalla del alumno
- el alumno no entra a la revisión
- detalle: cada respuesta, la correcta y la explicación
- tras confirmar, el selector queda en el nivel guardado
- la vista del profesor no le habla como alumno, y usa coma decimal
- revisión sin desborde en tableta
- el backend guardó el nivel confirmado por el profesor
- el alumno ve el nivel confirmado
- el banco de preguntas queda como estaba
- sin errores en el navegador

### Asignación a grupo

- terminado sin confirmar: muestra el nivel sugerido y pide confirmarlo
- ofrece revisar y confirmar el diagnóstico
- sin nivel confirmado no hay grupos recomendados
- confirmado: muestra el nivel y qué grupos salen primero
- al matricular, los grupos de primaria Básico van primero con su cupo
- el grupo lleno aparece deshabilitado
- el cambio se aplica y se ve en el historial con su motivo
- la matrícula anterior dice a dónde cambió, no «retirada»
- en el grupo nuevo queda su matrícula pendiente
- el cambio al grupo lleno no se puede elegir
- el backend liberó el cupo de A y ocupó el de B
- el backend guardó el cambio con su motivo
- ficha del alumno sin desborde en escritorio
- ficha del alumno sin desborde en el celular
- el banco de preguntas queda como estaba
- sin errores en el navegador

### General

- Sin errores de consola ni respuestas 5xx

### Modo mock

- crear alumno muestra usuario y contraseña
- credenciales legibles en oscuro (texto claro)
- errores por campo en el formulario
- el generador arma 4 clases en el navegador
- sin desborde con el horario generado
- crear grupo lleva a su ficha
- publicar: el grupo pasa a solo enlaces
- sin desborde en grupo publicado
- asistencia: una clase futura todavía está cerrada
- asistencia: el equipo marca la clase pasada
- asistencia: el resumen cuenta la marca
- sin desborde en la asistencia
- niveles: se crean los 8 con sus 14 sesiones
- niveles: ya no se ofrece crearlos otra vez
- sin desborde en niveles
- «Confirmar pago y activar» dentro de la pantalla, sin deslizar
- activar matrícula actualiza la lista
- retirar matrícula con confirmación
- arranca en oscuro
- el botón cambia a claro
- el tema elegido se recuerda
- alumno: las figuras no quedan en la página tras entrar
- familia: la contraseña no queda en la página tras entrar
- matricular: el grupo en borrador aparece deshabilitado
- mis prácticas lista las lecciones con su avance
- el navegador no recibe la respuesta ni la explicación antes de responder
- respuesta incorrecta: lo dice y muestra la explicación
- respuesta correcta: ¡Correcto! y botón para seguir
- formato inválido: se avisa sin enviar
- el avance de la lección sube con cada acierto
- práctica sin desborde en el celular
- la profesora entra a su área y ve solo sus grupos
- el grupo muestra clases y alumnos con su avance
- asistencia en un clic: no queda nadie sin marcar
- la lista refleja lo guardado (nadie queda sin opción elegida)
- pantallas del profesor sin desborde en tableta
- la profesora no entra a la administración
- sin errores en consola

## Hallazgos pendientes

- **Familia:** el subtítulo promete mensajes y membresía, pero un hijo real todavía no los muestra.
- **Matrículas en celular:** «Cupos por grupo» va antes de la lista. Con los datos de prueba de esta base, la página mide 10 495 px y las matrículas quedan muy abajo.
- **Estado HTTP de «no encontrado»:** las páginas cargan dentro de `<Suspense>`, así que un id ajeno muestra «Esta página no existe» pero con estado 200 (la respuesta ya empezó a enviarse). No filtra datos; solo afecta a buscadores y monitoreo.
- **Build:** falla de forma intermitente con SecurityFatalError, el aviso de vulnerabilidad de Next 16.4.0, y pasa al reintentar. Conviene actualizar Next.

## Cómo repetirlas

Las pruebas unitarias y de código solo necesitan el repo:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Las pruebas en navegador necesitan el build. Cada comando levanta el aula y la apaga al terminar:

```bash
pnpm build
pnpm e2e:mock    # sin backend; corre en el CI en cada pull request
pnpm e2e:real    # necesita el backend en Docker
```

- **`pnpm e2e:real`** busca el backend en `../aula_mf_backend`. Si está en otra carpeta, indícala con `E2E_BACKEND_DIR`. Una base nueva necesita antes `sh tests/e2e/setup-admin.sh` en el backend.
- **Navegador:** por defecto usan Microsoft Edge. Con `E2E_BROWSER=chromium` usan el Chromium de Playwright (`pnpm exec playwright-core install chromium`).
- **Capturas y video:** se guardan en `e2e/.output`, que no se sube a git. Con `E2E_VIDEO=1`, `pnpm e2e:real` también graba cada recorrido.
- **Límite:** `pnpm e2e:real` no corre en el CI, porque necesita los dos repositorios. Hay que correrla a mano antes de fusionar cambios de pantallas conectadas a la API.
