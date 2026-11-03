# Panel de administración (`/admin`)

Gestión de usuarios nuevos, padres/tutores (familias) y cursos. Lo usa el equipo de Mate Fácil.

| Página | Qué hace |
|---|---|
| `/admin` | Resumen: nuevos en 7 días, alumnos, familias, cursos publicados y últimos registrados |
| `/admin/usuarios` | Lista paginada con búsqueda (sin tildes), filtro por rol y estado de cuenta |
| `/admin/usuarios/nuevo` | Alta de alumno o de padre/tutor. La contraseña inicial se muestra **una sola vez** |
| `/admin/usuarios/[id]` | Ficha: activar/desactivar cuenta, vincular o quitar hijos, alta de un hijo ya vinculado |
| `/admin/familias` | Padres y tutores con su número de hijos |
| `/admin/matriculas` | Matrícula con activación manual (SCRUM-44): cupos por grupo, filtros por estado y grupo, confirmar pago y activar, retirar. Desde la ficha de un alumno se lo matricula en un grupo |
| `/admin/cursos` · `/nuevo` · `/[id]` | Cursos: textos, categoría, portada (JPG/PNG/WebP ≤ 5 MB) y publicación |
| `/admin/categorias` | Crear, renombrar y borrar categorías (solo si no tienen cursos) |

## Probarlo

**Sin backend (`API_MODE=mock`):** en `/ingreso`, pestaña **Equipo**: `admin@matefacil.pe` / `matefacil123`.
La subida de portadas responde «almacenamiento no configurado» en este modo.

**Con el backend (`API_MODE=hybrid` o `http`):**

1. Aplicar migraciones (crea `users.guardian_links`, la extensión `unaccent` y el esquema `enrollments`).
2. Actualizar el catálogo de permisos a v3 (rol `guardian` y permisos `users.manage` y `enrollments.manage`):
   `dotnet run --project tools/AulaVirtual.AuthorizationProvisioning -- provision-catalog --confirm-authorization-change`
3. Si aún no hay administrador: `... -- assign-first-administrator <user-id> --confirm-authorization-change`.
4. Ingresar con ese correo en la pestaña **Equipo**.

El rol de la sesión lo decide el backend (`GET /auth/me` → `roles`), no la pestaña usada:
`administrator` → `/admin`, `guardian` → `/familia`, `student` → `/inicio`.

## Cómo está armado

- **Datos en el servidor.** Las páginas son Server Components con *Partial Prerender*: el armazón llega al instante
  y los datos entran por streaming. Lecturas independientes van en paralelo (`Promise.all`).
- **Filtros en la URL.** Búsqueda, rol, estado y página son parámetros (`?q=&rol=&estado=&pagina=`): una petición por
  vista, enlaces compartibles y funcionan sin JavaScript. El backend pagina en la base de datos.
- **Mutaciones con Server Actions** (`features/admin/actions.ts`): verifican la sesión de administrador, aplican un
  límite de frecuencia, validan el formulario y usan `refresh()` para devolver la página actualizada en el mismo viaje.
- **Portadas por Route Handler** (`admin/cursos/[id]/portada`): tiene su propio límite de 5 MB y revisa origen,
  sesión, tamaño y tipo antes de reenviar el archivo. Así no se sube el límite global de 1 MB de las Server Actions.

## Endpoints del backend que usa

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/admin/summary` | `users.manage` |
| GET | `/admin/users?search=&role=&status=&page=&pageSize=` | `users.manage` |
| GET | `/admin/users/{id}` | `users.manage` |
| POST | `/admin/students` · `/admin/guardians` | `users.manage` |
| PUT | `/admin/users/{id}/status` `{ isActive }` | `users.manage` |
| PUT · DELETE | `/admin/guardians/{guardianId}/students/{studentId}` | `users.manage` |
| GET | `/enrollments?courseOfferingId=&studentUserId=&status=&page=` | `enrollments.manage` |
| GET | `/enrollments/offerings` (grupos con cupo y lugares ocupados) | `enrollments.manage` |
| POST | `/enrollments` `{ studentUserId, courseOfferingId, paymentNote }` | `enrollments.manage` |
| POST | `/enrollments/{id}/activate` `{ paymentNote }` · `/enrollments/{id}/withdraw` | `enrollments.manage` |
| GET · POST · PUT | `/courses`, `/courses/{id}`, `/courses/{id}/publication`, `/courses/{id}/cover` | `courses.manage` |
| GET · POST · PUT · DELETE | `/course-categories`, `/course-categories/{id}` | `courses.manage` |

## Matrícula: reglas

- Estados: **pendiente** (registrada, pago por confirmar) → **activa** (pago confirmado) o **retirada**.
  Se guarda quién registró, activó o retiró y cuándo.
- Las pendientes y activas ocupan cupo. El tope es el `MaximumCapacity` de la edición (grupo): el backend reserva
  el cupo con un bloqueo por grupo dentro de una transacción, así dos altas simultáneas no pasan del tope.
- Un alumno no puede tener dos matrículas vigentes en el mismo grupo (índice único en la base).
- La nota de pago es texto libre mientras se define la regla de pago del verano (SCRUM-43).
