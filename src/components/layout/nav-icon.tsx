import type { ReactNode } from 'react';

// Iconos de la navegación: SVG en línea (sin dependencias ni peticiones), heredan el color del texto.

export type NavIconName = 'home' | 'route' | 'lessons' | 'exams' | 'classes' | 'trophy' | 'dashboard' | 'users' | 'family' | 'courses' | 'categories';

const PATHS: Record<NavIconName, ReactNode> = {
  // Casa
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  // Camino con punto de partida y meta
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
      <path d="M18 2.5v6M18 3h3l-1 1.5 1 1.5h-3" />
    </>
  ),
  // Botón de reproducir dentro de una pantalla (video-lección)
  lessons: (
    <>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2.5" />
      <path d="m10.5 8.5 4 2.75-4 2.75z" />
      <path d="M8 20.5h8" />
    </>
  ),
  // Hoja con check y lápiz (evaluación)
  exams: (
    <>
      <path d="M13 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8" />
      <path d="M13 3.5 17 7.5V9" />
      <path d="M8.5 9.5h3M8.5 13h3" />
      <path d="m14 19.5.5-2.5 5.5-5.5a1.4 1.4 0 0 1 2 2L16.5 19z" />
    </>
  ),
  // Calendario con check (clases y tareas)
  classes: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2.2 2.2L15.5 13" />
    </>
  ),
  // Cuatro paneles (resumen)
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
    </>
  ),
  // Dos personas
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  // Adulto con niño
  family: (
    <>
      <circle cx="8" cy="6" r="3" />
      <path d="M3 21v-4.5a5 5 0 0 1 10 0V21" />
      <circle cx="17.5" cy="11" r="2.3" />
      <path d="M14 21v-2.5a3.5 3.5 0 0 1 7 0V21" />
    </>
  ),
  // Libro abierto
  courses: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 3.5 4.5v14c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2v-14c-4 0-6.5.5-8.5 2z" />
      <path d="M12 6.5v14" />
    </>
  ),
  // Etiqueta
  categories: (
    <>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </>
  ),
  // Trofeo
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H4.5a3 3 0 0 0 3.5 4.5M16 6h3.5A3 3 0 0 1 16 10.5" />
      <path d="M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
