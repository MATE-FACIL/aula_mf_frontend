# Carga de contenido del curso (SCRUM-71)

Guía para el equipo que arma los cursos en el panel de administración, sin programar.

## Dónde está

**Administración → Cursos →** el curso **→ Administrar contenido**. Cada curso tiene **unidades**, y cada unidad tiene **sesiones** en orden. Los niveles de Matemáticas (Prebásico a Avanzado, de primaria y de secundaria) ya traen 14 sesiones vacías («Sesión 1» a «Sesión 14») para llenarlas.

## Cómo se arma un curso

1. **Crea las unidades** (por ejemplo «Fracciones»). Se pueden renombrar y reordenar con ↑ y ↓. Una unidad solo se borra si no tiene sesiones.
2. **Crea las sesiones** con **+ Nueva sesión** dentro de cada unidad. Cada sesión tiene:
   - **Título** y **resumen** (opcional).
   - **Video** (opcional): un enlace o un archivo.
   - **Materiales** (hasta 20): guías, fichas o enlaces, cada uno un enlace o un archivo.
   - **Publicada**: marcada, la ven los alumnos con matrícula activa; sin marcar, es un borrador que solo ve el equipo.
3. **Ordena** las sesiones con ↑ y ↓. La numeración («Sesión 1, 2, 3…») corre por todo el curso y se actualiza sola.
4. Para **pasar una sesión a otra unidad**, cambia la unidad en su editor y guarda.

## Enlaces y archivos

El video y cada material son **un enlace o un archivo, nunca los dos**.

| | Enlace | Archivo |
|---|---|---|
| **Qué admite** | Una dirección `https://` (YouTube, Drive, Vimeo…). Una `http://` no se acepta: el navegador la bloquea en el aula | Video: **MP4 o WebM**, hasta **2 GB**. Material: **PDF, PNG, JPG, WebP, Word, PowerPoint o Excel**, hasta **50 MB** |
| **Cuándo** | Siempre | Solo cuando la sesión **ya existe**: crea la sesión, y en su pantalla ya puedes subir archivos |

**Subir un archivo:** elige «Archivo», selecciona el archivo y espera a que termine la barra. El archivo viaja directo al almacenamiento (no pasa por el aula) y **queda adjunto al guardar la sesión**. Si eliges un tipo no permitido o uno demasiado grande, el aula te avisa antes de subir nada.

**Quitar o reemplazar un archivo:** «Quitar archivo» y guarda la sesión. El archivo se borra del almacenamiento. Lo mismo al borrar una sesión: se borran también sus archivos.

## Lo que hay que saber

- **Un archivo subido que no se guarda queda huérfano.** Si subes un archivo y sales sin pulsar «Guardar sesión», el archivo queda en el almacenamiento sin usarse. No se ve en ningún lado, solo ocupa espacio.
- **Los enlaces a los archivos vencen a los 15 minutos.** El aula los vuelve a pedir en cada pantalla; si dejas el editor abierto mucho rato, el «Ver» de un archivo puede haber vencido (recarga la página).
- **Lo que carguen hoy todavía no lo ven los alumnos en su pantalla de Lecciones.** Esa pantalla (SCRUM-56) aún muestra datos de ejemplo. El contenido ya queda guardado y publicado en el backend, listo para cuando se conecte.
- **Ejercicios de práctica y preguntas del diagnóstico** todavía no se cargan desde aquí: se cargan por la API (`PUT …/exercises` y `PUT /diagnostics/questions/{etapa}`). Es lo siguiente a construir.

## Para quien despliega

- La **subida directa del navegador** necesita que el bucket privado de R2 tenga una **regla CORS** que permita `PUT` desde el origen del aula (ver el README del backend). Sin ella, el navegador bloquea la subida y el aula muestra «No pudimos subir el archivo».
- El almacenamiento local de desarrollo (RustFS) ya trae esa regla: `docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d --build` en el backend.
- Sin almacenamiento en el ambiente, el editor sigue funcionando con enlaces y explica que la subida de archivos no está activa.
