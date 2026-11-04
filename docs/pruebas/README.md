# Pruebas del aula

Resultados del 4 de noviembre de 2026 sobre el commit `d4bf9d2` de la rama `feat/scrum-67-68-familia`. Las capturas y animaciones salen de un navegador real (Microsoft Edge) con el aula conectada a la API .NET y PostgreSQL en Docker. Las personas y los correos son ficticios, y los datos de acceso aparecen difuminados.

| Prueba | Dónde corre | Resultado |
|---|---|---|
| Unitarias (Vitest) | En memoria | **64 de 64**, en 13 archivos |
| Tipos (`tsc`) y lint (ESLint) | Código | Sin errores |
| Recorrido en navegador real | Aula conectada a la API en Docker | **24 de 24** |
| Panel de la familia con login real | Aula conectada a la API en Docker | **7 de 7** |
| Contraste y desborde | Modo mock | 224 combinaciones: 0 problemas |
| Flujos en celular y modo oscuro | Modo mock | 15 de 15 |

La lista completa está en [pruebas-unitarias.md](pruebas-unitarias.md). Las pruebas de la API están en las [pruebas del backend](https://github.com/MATE-FACIL/aula_mf_backend/blob/main/docs/pruebas/README.md).

## Limitaciones

**El aula corrió en modo híbrido.** El backend todavía no tiene todos los módulos, así que parte de lo que se ve son datos de ejemplo:

| Pantalla | Datos reales | Datos de ejemplo |
|---|---|---|
| Administración | Todo | Nada |
| Familia | Hijos, matrículas, próximas clases y profesores | Notificación de la campana |
| Alumno | Clases en vivo, calendario y enlace para entrar | Nombre del saludo («Valentina»), estrellas, lecciones, tareas, notas, asistencia y avisos |

**La sesión de administrador se firmó localmente.** Se usó la clave de desarrollo de Docker, sin pasar por el formulario de ingreso. Los logins de familia y alumno sí fueron reales, por el formulario.

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

Celular en modo oscuro:

<img src="capturas/admin-07-resumen-celular-oscuro.png" alt="Resumen en celular" width="240"> <img src="capturas/admin-07-usuarios-celular-oscuro.png" alt="Usuarios en celular" width="240"> <img src="capturas/admin-07-cursos-celular-oscuro.png" alt="Cursos en celular" width="240"> <img src="capturas/admin-07-matriculas-celular-oscuro.png" alt="Matrículas en celular" width="240">

### Alumno

Inicio y clases en celular con modo oscuro. La clase real muestra «Entrar» cuando faltan pocos minutos:

<img src="capturas/alumno-01-inicio-celular-oscuro.png" alt="Inicio del alumno" width="280"> <img src="capturas/alumno-02-clases-celular-oscuro.png" alt="Clases del alumno con el botón Entrar" width="280">

## Qué se comprobó en el navegador

### Administración en escritorio

- Crear alumno muestra sus datos de acceso una sola vez
- El generador arma 4 clases
- Crear el grupo en la API lleva a su ficha
- Asignar profesor muestra el aviso
- Publicar muestra el aviso aunque el botón desaparezca
- Activar matrícula actualiza la fila
- Retirar matrícula libera el cupo

### Administración en celular

- /admin sin desborde horizontal
- /admin/usuarios sin desborde horizontal
- /admin/cursos sin desborde horizontal
- /admin/matriculas sin desborde horizontal
- Ficha del curso sin desborde horizontal

### Familia

- Login real con rol familia lleva a /familia
- Se ve a la hija con su curso y profesora reales
- No aparecen datos de ejemplo
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
- /clases muestra el curso real
- La clase próxima ofrece «Entrar» con su enlace
- /clases sin desborde horizontal

### General

- Sin errores de consola ni respuestas 5xx

## Hallazgos pendientes

- **Login:** después de iniciar sesión, el formulario de ingreso queda oculto en la página y conserva la contraseña escrita hasta recargar. Hay que limpiarla al entrar.
- **Familia:** el subtítulo promete mensajes y membresía, pero un hijo real todavía no los muestra.
- **Matrículas en celular:** «Cupos por grupo» va antes de la lista. Con los datos de prueba de esta base, la página mide 10 495 px y las matrículas quedan muy abajo.
- **Build:** `pnpm build` falló en el primer intento y pasó en el segundo. En corridas anteriores la causa fue el `SecurityFatalError` de Next 16.4.0; conviene actualizar Next.

## Cómo repetirlas

Las pruebas unitarias y de código solo necesitan el repo:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Para conectar el aula a la API en Docker, primero levanta el backend con `docker compose up -d --build` y luego:

```bash
pnpm build
API_MODE=hybrid API_BASE_URL=http://localhost:5087/api/v1 PORT=3124 node scripts/start-standalone.mjs
```

Los scripts del recorrido en navegador todavía no están en este repositorio. Son scripts locales de Node.js con Playwright, así que por ahora estos resultados no se pueden repetir solo con el repo.
