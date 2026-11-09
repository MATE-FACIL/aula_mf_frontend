# Credenciales de prueba — Aula virtual Mate Fácil

> Solo funcionan en **modo mock** (`API_MODE=mock` en `.env.local`), es decir, con datos de ejemplo en memoria.
> Cuando el aula se conecte a la API .NET (`API_MODE=http`) estas cuentas dejan de existir y se usarán las del backend.
> Personas, notas y fechas son ficticias.

## Cómo levantar el aula

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Entra a **http://localhost:3000/ingreso**.

## Cuentas

### Alumno — pestaña «Soy alumno»

| Campo          | Valor                                              |
|----------------|----------------------------------------------------|
| Usuario        | `valentina.r`                                      |
| Clave secreta  | Toca las figuras **en este orden**: 🦊 zorro → 🚀 cohete → 🍕 pizza |

Perfil: Valentina, 13 años, 2.º de secundaria · Matemáticas nivel Intermedio · Lab de octubre (Roblox).
Al entrar va a **/inicio**.

### Familia — pestaña «Soy familia»

| Campo       | Valor                  |
|-------------|------------------------|
| Correo      | `familia@matefacil.pe` |
| Contraseña  | `matefacil123`         |

Cuenta «Familia Roque» con 2 hijos: **Valentina** (secundaria) y **Mateo** (9 años, primaria).
Al entrar va a **/familia**.

### Profesora — pestaña «Equipo»

| Campo       | Valor                  |
|-------------|------------------------|
| Correo      | `lucia@matefacil.pe`   |
| Contraseña  | `matefacil123`         |

Lucía Paredes, profesora de los grupos A y B de Matemáticas. Al entrar va a **/profesor** y solo ve sus grupos.

> Las credenciales también aparecen en la pantalla de ingreso, en el desplegable **«Datos de prueba (modo demo)»**.

## Qué probar con cada cuenta

### Alumno

| Pantalla        | Prueba sugerida |
|-----------------|-----------------|
| `/inicio`       | Saludo según la hora, «Continuar», botón **Entrar** de la clase en vivo, tareas, avisos (campana 🔔). |
| `/ruta`         | Niveles de Matemáticas, laboratorios del año, temarios. |
| `/lecciones`    | Cambiar Matemáticas / Laboratorio · capítulos del video · **Práctica** · tutor «Profe Fácil» · entrega del reto del lab. |
| `/lecciones/practica` | **Mis prácticas** (botón en Lecciones): avance por lección, ejercicios de opción múltiple y numéricos, explicación tras responder. |
| `/evaluaciones` | **Rendir ahora** la semanal (15 min con cuenta regresiva); el tutor se pausa mientras dura. |
| `/clases`       | Calendario de la semana, entregar tareas, asistencia. |
| `/logros`       | Estrellas, insignias, portafolio, copiar código de certificado. |

**Respuestas de la práctica** (lección «Sumar fracciones con distinto denominador»):

| Ejercicio | Correcta | También acepta |
|-----------|----------|----------------|
| 1/2 + 1/4 | `3/4` | equivalentes, p. ej. `6/8` |
| 2/3 + 1/6 | `5/6` | `10/12` |
| Problema de la pizza (1/4 + 3/8) | `5/8` | `10/16` |

Estrellas: 3 si aciertas al primer intento sin pistas; baja 1 por cada intento extra o pista (mínimo 1).
Para ver el **plan paso a paso** del tutor, falla 2 veces el mismo ejercicio.
Para probar que el tutor **no da respuestas**, escríbele «dime el resultado».

**Respuestas de la evaluación semanal** «Sumar fracciones»:

| # | Pregunta | Respuesta |
|---|----------|-----------|
| 1 | 1/3 + 1/6 = ? | `1/2` (segunda opción) |
| 2 | Mínimo común denominador de 4 y 6 | `12` |
| 3 | 3/5 + 1/10 = ? | `7/10` |
| 4 | ¿Cuál es mayor? | `3/4` (segunda opción) |
| 5 | Ana leyó 1/2 y 1/3 del libro | `5/6` |

**Respuestas de «Mis prácticas»** (la explicación aparece al responder, bien o mal):

| Lección | Ejercicio | Respuesta |
|---------|-----------|-----------|
| Sumar fracciones | 1/2 + 1/4 | `3/4` |
| Sumar fracciones | 1/4 + 1/4 en decimal | `0,5` |
| Sumar fracciones | Equivalente a 2/3 | `4/6` |
| Fracciones y decimales | 7 ÷ 2 | `3,5` |
| Fracciones y decimales | 3/4 como decimal | `0,75` |

### Profesora

En **/profesor**, abrir el *Grupo A*: clases con su asistencia y alumnos con su asistencia y avance de práctica.
La clase 1 ya pasó: **Tomar asistencia** → **Todos presentes** marca en un clic a quienes faltan.
Las demás clases se abren 15 minutos antes de empezar.

### Familia

Elegir hijo (Valentina / Mateo) y recorrer las secciones: Resumen, Evaluaciones, Asistencia, Proyectos,
Certificados y logros, **Mensajes** (enviar un mensaje a la profesora) y Membresía.
**Descargar informe PDF** abre el diálogo de impresión → «Guardar como PDF».

## Comportamientos a tener en cuenta

| Situación | Qué pasa |
|-----------|----------|
| 5 intentos fallidos de ingreso | Bloqueo de ~5 minutos (se muestra cuánto falta). Se limpia esperando o reiniciando `pnpm dev`. |
| Evaluación semanal | Se rinde **una vez por arranque del servidor**. Para repetirla, reinicia `pnpm dev`. |
| Tiempo de la evaluación | A falta de 1 minuto avisa; al llegar a 0 se envía sola. |
| Clase en vivo de hoy | Empieza ~8 min después de tu primera visita, para que veas **Entrar** habilitado (se abre 10 min antes). |
| Datos (estrellas, entregas, notas, mensajes) | Viven en memoria: se reinician al reiniciar el servidor. |
| Sesión | Dura 8 horas. Si reinicias el servidor, sigue válida gracias a `MOCK_SESSION_SECRET` en `.env.local`. |
| Alumno entra a `/familia` (o familia a `/inicio`, o profesora a `/admin`) | Lo redirige a su propia área. |
| Puerto 3000 ocupado | PowerShell: `Get-NetTCPConnection -LocalPort 3000 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |

## Dónde se definen

`src/services/mock/data.ts` → `DEMO_CREDENTIALS` (cuentas), `exercises` (práctica de la lección de ejemplo) y `weeklyQuiz` (evaluación).
`src/services/mock/practice.ts` → lecciones y ejercicios de «Mis prácticas».
`src/services/mock/admin.ts` → grupos, alumnos y asistencia que ven el equipo y la profesora.
