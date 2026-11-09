import { UserMenu } from '@/features/account/components/header-widgets';
import { requireSession } from '@/server/auth/dal';

// Parte de la cabecera del profesor que depende de la sesión (va dentro de <Suspense> en el layout).
// Reutiliza la verificación de la página (React `cache`): no agrega peticiones al backend.

export async function TeacherStatus() {
  const ctx = await requireSession('teacher');
  const initials = ctx.user.displayName.split(/\s+/).slice(0, 2).map((word) => word[0] ?? '').join('').toUpperCase();
  return <UserMenu name={ctx.user.displayName} avatar={initials || 'MF'} subtitle="Profesor" textAvatar />;
}
