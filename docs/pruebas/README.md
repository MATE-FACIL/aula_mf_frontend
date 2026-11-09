# Pruebas del aula

Resultados del 9 de noviembre de 2026 sobre el commit `e5784d3` de la rama `feat/scrum-53-55-asistencia-lecciones`. Las capturas y animaciones salen de un navegador real (Microsoft Edge) con el aula conectada a la API .NET y PostgreSQL en Docker. Las personas y los correos son ficticios, y los datos de acceso aparecen difuminados.

| Prueba | Dónde corre | Resultado |
|---|---|---|
| Unitarias (Vitest) | En memoria | **71 de 71**, en 15 archivos |
| Tipos (`tsc`) y lint (ESLint) | Código | Sin errores |
| Recorrido en navegador real | Aula conectada a la API en Docker | **31 de 31** |
| Panel de la familia con login real | Aula conectada a la API en Docker | **7 de 7** |
| Sesión y renovación | Aula conectada a la API en Docker | **12 de 12** |
| Contraste y desborde | Modo mock | 224 combinaciones: 0 problemas |
| Flujos en celular y modo oscuro | Modo mock | **22 de 22** |

Las dos pruebas en modo mock pasaron en Edge y en Chromium, el navegador del CI.

La lista completa está en [pruebas-unitarias.md](pruebas-unitarias.md). Las pruebas de la API están en las [pruebas del backend](https://github.com/MATE-FACIL/aula_mf_backend/blob/main/docs/pruebas/README.md).

## Limitaciones

**El aula corrió en modo híbrido.** El backend todavía no tiene todos los módulos, así que parte de lo que se ve son datos de ejemplo:

| Pantalla | Datos reales | Datos de ejemplo |
|---|---|---|
| Administración | Todo | Nada |
| Familia | Hijos, matrículas, próximas clases, profesores y asistencia | Notificación de la campana |
| Alumno | Clases en vivo, calendario, enlace para entrar y asistencia | Nombre del saludo («Valentina»), estrellas, lecciones, tareas, notas y avisos |

**La sesión de administrador se firmó localmente.** Se usó la clave de desarrollo de Docker, sin pasar por el formulario de ingreso. Los logins de familia y alumno sí fueron reales, por el formulario.

**Las lecciones (SCRUM-55) todavía no tienen pantalla.** Su API está lista y probada (ver las pruebas del backend); la pantalla del alumno es SCRUM-56 y la carga desde el panel es SCRUM-71.

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

Celular en modo oscuro:

<img src="capturas/admin-07-resumen-celular-oscuro.png" alt="Resumen en celular" width="240"> <img src="capturas/admin-07-usuarios-celular-oscuro.png" alt="Usuarios en celular" width="240"> <img src="capturas/admin-07-cursos-celular-oscuro.png" alt="Cursos en celular" width="240"> <img src="capturas/admin-07-matriculas-celular-oscuro.png" alt="Matrículas en celular" width="240">

### Alumno

Inicio y clases en celular con modo oscuro. La clase real muestra «Entrar» cuando faltan pocos minutos:

<img src="capturas/alumno-01-inicio-celular-oscuro.png" alt="Inicio del alumno" width="280"> <img src="capturas/alumno-02-clases-celular-oscuro.png" alt="Clases del alumno con el botón Entrar" width="280">

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

### Administración en celular

- /admin sin desborde horizontal
- /admin/usuarios sin desborde horizontal
- /admin/cursos sin desborde horizontal
- /admin/matriculas sin desborde horizontal
- Ficha del curso sin desborde horizontal
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
- «Confirmar pago y activar» dentro de la pantalla, sin deslizar
- activar matrícula actualiza la lista
- retirar matrícula con confirmación
- arranca en oscuro
- el botón cambia a claro
- el tema elegido se recuerda
- alumno: las figuras no quedan en la página tras entrar
- familia: la contraseña no queda en la página tras entrar
- matricular: el grupo en borrador aparece deshabilitado
- sin errores en consola

## Hallazgos pendientes

- **Familia:** el subtítulo promete mensajes y membresía, pero un hijo real todavía no los muestra.
- **Matrículas en celular:** «Cupos por grupo» va antes de la lista. Con los datos de prueba de esta base, la página mide 10 495 px y las matrículas quedan muy abajo.
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
