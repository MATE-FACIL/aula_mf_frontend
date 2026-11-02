import type { NavIconName } from '@/components/layout/nav-icon';

// Navegación del aula (prototipo B: barra lateral fija; en móvil, barra inferior).

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: NavIconName;
  /** Solo se marca como actual en su ruta exacta (para la portada de un área, p. ej. /admin). */
  exact?: boolean;
}

export const STUDENT_NAV: NavItem[] = [
  { href: '/inicio', label: 'Inicio', icon: 'home' },
  { href: '/ruta', label: 'Mi ruta', icon: 'route' },
  { href: '/lecciones', label: 'Lecciones', icon: 'lessons' },
  { href: '/evaluaciones', label: 'Evaluaciones', short: 'Evaluar', icon: 'exams' },
  { href: '/clases', label: 'Clases y tareas', short: 'Clases', icon: 'classes' },
  { href: '/logros', label: 'Logros', icon: 'trophy' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Resumen', icon: 'dashboard', exact: true },
  { href: '/admin/usuarios', label: 'Usuarios', icon: 'users' },
  { href: '/admin/familias', label: 'Familias', icon: 'family' },
  { href: '/admin/cursos', label: 'Cursos', icon: 'courses' },
  { href: '/admin/categorias', label: 'Categorías', short: 'Categ.', icon: 'categories' },
];
