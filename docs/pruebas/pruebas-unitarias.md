# Lista de pruebas unitarias

Las 103 pruebas de Vitest, por archivo. Todas pasaron el 10 de noviembre de 2026.

## `src/app/manifest.test.ts` (6)

- manifest de la PWA → cumple lo mínimo para instalarse
- manifest de la PWA → declara iconos de 192 y 512 y uno «maskable»
- manifest de la PWA → cada icono existe y mide lo que declara
- manifest de la PWA → los accesos directos llevan a pantallas reales del alumno
- service worker → solo precachea archivos que existen (si no, la instalación del SW falla entera)
- service worker → solo toca peticiones GET del mismo origen y nunca guarda páginas (HTML autenticado)

## `src/components/layout/side-nav.test.ts` (2)

- currentHref → marca el enlace más específico
- currentHref → respeta los enlaces exactos y no marca nada sin ruta

## `src/features/admin/attendance.test.ts` (4)

- parseAttendanceForm → envía solo a los alumnos marcados, con su nota limpia
- parseAttendanceForm → una nota vacía viaja como null
- parseAttendanceForm → pide marcar al menos a un alumno
- parseAttendanceForm → rechaza estados desconocidos, notas largas e ids alterados

## `src/features/admin/enrollments.test.ts` (3)

- parseEnrollmentFilters → lee estado, grupo y página válidos
- parseEnrollmentFilters → ignora estados desconocidos y grupos que no son un id
- enrollmentsHref → arma la URL omitiendo lo vacío

## `src/features/admin/format.test.ts` (7)

- parseUserFilters → lee búsqueda, rol, estado y página válidos
- parseUserFilters → ignora valores desconocidos o mal formados
- parseUserFilters → usa el primer valor si un parámetro se repite y recorta búsquedas largas
- parseUserFilters → un rol fijo (p. ej. la página de familias) gana sobre la URL
- usersHref → omite filtros vacíos y la página 1
- usersHref → no repite el rol en páginas que ya lo fijan
- pageCount → siempre hay al menos una página

## `src/features/admin/schedule.test.ts` (4)

- generateSessions → genera las clases en los días marcados, en hora de Perú (UTC-5)
- generateSessions → aplica la duración por etapa (90 min en secundaria)
- generateSessions → empieza el mismo día si coincide y salta los días no marcados
- generateSessions → valida los datos antes de generar

## `src/features/admin/validation.test.ts` (12)

- parseStudentForm → limpia espacios y omite opcionales vacíos
- parseStudentForm → exige nombres, apellido y documento, y valida el correo
- parseStudentForm → rechaza un tutor que no es un id válido
- parseGuardianForm → el correo es obligatorio y el documento opcional
- parseCourseForm → convierte textos vacíos en null y exige título
- parseCourseForm → acepta la duración de clase por etapa y rechaza valores fuera de rango
- checkCover → acepta imágenes livianas y rechaza otros tipos o tamaños
- parseOfferingForm → arma el grupo con la cantidad de clases del horario
- parseOfferingForm → rechaza horarios mal formados, enlaces no http y cupos inválidos
- parseTransferForm (SCRUM-45) → limpia el motivo y lo omite si queda vacío
- parseTransferForm (SCRUM-45) → exige una matrícula y un grupo de destino válidos
- parseTransferForm (SCRUM-45) → rechaza un motivo demasiado largo (igual que el backend)

## `src/features/diagnostic/rules.test.ts` (8)

- scoreDiagnostic → sugiere el primer nivel que aún no domina (igual que el backend)
- scoreDiagnostic → con el 60 % domina el nivel
- scoreDiagnostic → si domina todos, sugiere el más alto medido; si falla el primero, el primero
- scoreDiagnostic → los temas conservan su orden y se juntan sin importar mayúsculas
- ayudas → retoma en la primera sin responder
- ayudas → valida niveles y filtros que llegan del navegador
- ayudas → muestra los decimales con coma
- ayudas → cuenta en singular y plural

## `src/features/practice/answer.test.ts` (7)

- answerFormatError → opción múltiple: solo un índice de las opciones
- answerFormatError → numérica: acepta coma o punto decimal y signo, como el backend
- answerFormatError → numérica: rechaza texto, fracciones, miles y respuestas largas sin gastar una petición
- firstPending → retoma en el primer ejercicio sin resolver
- firstPending → si ya resolvió todos, empieza por el primero
- progressLabel → cuenta resueltos y porcentaje
- progressLabel → sin ejercicios no muestra 0 %

## `src/lib/math/fractions.test.ts` (5)

- fracciones → calcula el máximo común divisor
- fracciones → interpreta fracciones con espacios y enteros
- fracciones → rechaza formatos inválidos y denominador cero
- fracciones → acepta fracciones equivalentes
- fracciones → simplifica y formatea

## `src/lib/rate-limit.test.ts` (4)

- createRateLimiter → permite hasta el límite dentro de la ventana y luego bloquea
- createRateLimiter → libera cupos cuando la ventana se desliza
- createRateLimiter → separa las claves y permite reiniciarlas
- createRateLimiter → mantiene la memoria acotada

## `src/lib/time.test.ts` (4)

- tiempo y zonas horarias → formatea el reloj de la evaluación
- tiempo y zonas horarias → convierte hora local de Lima (UTC−5) a UTC
- tiempo y zonas horarias → obtiene el día local aunque en UTC ya sea mañana
- tiempo y zonas horarias → suma días y calcula el día de la semana

## `src/server/auth/backend-session.test.ts` (5)

- needsRenewal → renueva cuando falta menos de un minuto o ya venció
- needsRenewal → ignora tokens que no son JWT (modo mock)
- refreshTokenFrom → lee solo la cookie de renovación del backend
- renewBackendSession → peticiones simultáneas con el mismo token hacen UNA sola renovación (el backend rota y revoca reusos)
- renewBackendSession → distingue sesión terminada (401) de backend caído

## `src/server/auth/constants.test.ts` (1)

- areaOf → el diagnóstico del alumno es del área del alumno; su revisión, del profesor y del administrador

## `src/services/http/attendance.test.ts` (3)

- asistencia real → conserva los totales del backend y arma cada fila
- asistencia real → muestra la fecha en la zona horaria de quien mira
- asistencia real → el hijo real lleva su asistencia; sin reporte queda vacío, nunca con ejemplos

## `src/services/http/family-children.test.ts` (2)

- toChildOverview → convierte matrículas y clases reales
- toChildOverview → no rellena con datos de ejemplo lo que el backend aún no tiene

## `src/services/http/live-schedule.test.ts` (5)

- toLiveClass → convierte duración, profesor y enlace
- toLiveClass → detecta laboratorios y cubre clases sin profesor ni enlace
- rango y calendario → la semana empieza el lunes en hora de Perú
- rango y calendario → cada clase es un evento del día local
- rango y calendario → «Inicio» muestra solo las que aún no terminan

## `src/services/http/practice.test.ts` (5)

- toPracticeCourse → une el curso con su avance y arma el rótulo del nivel
- toPracticeCourse → un curso que no es nivel, o sin avance disponible, sigue apareciendo vacío
- uniqueCourses → el mismo curso por dos grupos se muestra una sola vez (y no se pide dos veces)
- roleFromBackend → el profesor (instructor) entra a su área
- roleFromBackend → gana el rol de más alcance

## `src/services/mock/grading.test.ts` (6)

- estrellas de la práctica → da 3 al primer intento sin pistas y nunca menos de 1
- checkFractionAnswer → acepta equivalentes y sugiere simplificar
- checkFractionAnswer → un formato inválido no cuenta como intento
- checkFractionAnswer → tras 2 intentos sugiere pedir pista
- gradeQuiz → califica y agrupa por competencia
- gradeQuiz → marca el envío tardío

## `src/services/mock/practice.test.ts` (6)

- checkPracticeAnswer → corrige opción múltiple por índice y numéricas con coma o punto
- checkPracticeAnswer → una respuesta ilegible no es ni buena ni mala
- mockPractice → el alumno no recibe la respuesta ni la explicación antes de responder
- mockPractice → responde, explica y recalcula el avance; un error y luego el acierto cuentan un resuelto
- mockPractice → una respuesta ilegible es 400 y no se guarda
- mockPractice → solo el alumno practica

## `src/services/mock/tutor-engine.test.ts` (4)

- tutor simulado → da las pistas de una en una y avisa al agotarlas
- tutor simulado → bloquea el plan paso a paso hasta 2 intentos fallidos
- tutor simulado → nunca entrega la respuesta aunque se la pidan
- tutor simulado → sin ejercicio activo no da pistas
