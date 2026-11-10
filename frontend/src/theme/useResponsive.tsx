/**
 * @file useResponsive.tsx
 * @description Hook unificado para diseño Mobile First y adaptación responsive fluida.
 * Contempla resoluciones desde 320px hasta 1440px+ en tiempo real (móvil, tablet, escritorio).
 */
import { useWindowDimensions, Platform } from 'react-native';

export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface ResponsiveInfo {
  width: number;
  height: number;
  // Categorías de dispositivo
  isSmallPhone: boolean;       // <= 360px (celulares compactos y pequeños como iPhone SE o Galaxy A)
  isPhone: boolean;            // < 768px (todos los celulares)
  isTablet: boolean;           // >= 768px && < 1200px (tablets tanto verticales como horizontales, iPads)
  isTabletPortrait: boolean;   // >= 768px && < 1024px (tablets en orientación vertical)
  isTabletLandscape: boolean;  // >= 1024px && < 1200px (tablets en orientación horizontal / iPads en apaisado)
  isDesktop: boolean;          // >= 1200px (laptops, notebooks y monitores)
  isLargeDesktop: boolean;     // >= 1440px (monitores anchos de escritorio)
  
  // Navbar específico para tablets
  showNavbarIconsOnly: boolean;// >= 768px && < 1200px (oculta nombres y muestra sólo iconos en navbar)

  // Clave exacta de breakpoint
  breakpoint: BreakpointKey;

  // Helpers de estilo fluido
  isLandscape: boolean;
  contentMaxWidth: number;
  
  // Selector de valor responsivo según breakpoint
  select: <T>(values: {
    xs: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    xxl?: T;
  }) => T;

  // Cálculo de columnas para grids (cards, métricas, etc.)
  columns: (options?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }) => number;
}

export const useResponsive = (): ResponsiveInfo => {
  const { width, height } = useWindowDimensions();

  // Breakpoints oficiales del proyecto
  // xs: < 390px (320px - 389px)
  // sm: 390px - 767px (celulares estándar y grandes)
  // md: 768px - 1023px (tablets portrait / iPad vertical)
  // lg: 1024px - 1199px (tablets landscape / iPad horizontal)
  // xl: 1200px - 1439px (notebooks y escritorios estándar)
  // xxl: >= 1440px (monitores grandes)
  let breakpoint: BreakpointKey = 'sm';
  if (width < 390) {
    breakpoint = 'xs';
  } else if (width < 768) {
    breakpoint = 'sm';
  } else if (width < 1024) {
    breakpoint = 'md';
  } else if (width < 1200) {
    breakpoint = 'lg';
  } else if (width < 1440) {
    breakpoint = 'xl';
  } else {
    breakpoint = 'xxl';
  }

  const isSmallPhone = width <= 360;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1200;
  const isTabletPortrait = width >= 768 && width < 1024;
  const isTabletLandscape = width >= 1024 && width < 1200;
  const isDesktop = width >= 1200;
  const isLargeDesktop = width >= 1440;
  const isLandscape = width > height;

  // Modo sólo iconos en navbar para tablets (tanto vertical como horizontal)
  const showNavbarIconsOnly = width >= 768 && width < 1200;

  // Ancho máximo fluido: 100% del ancho disponible sin restricciones arbitrarias ni bandas negras
  const contentMaxWidth: number = width;

  const select = <T,>(values: {
    xs: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    xxl?: T;
  }): T => {
    if (breakpoint === 'xxl' && values.xxl !== undefined) return values.xxl;
    if ((breakpoint === 'xxl' || breakpoint === 'xl') && values.xl !== undefined) return values.xl;
    if ((breakpoint === 'xxl' || breakpoint === 'xl' || breakpoint === 'lg') && values.lg !== undefined) return values.lg;
    if ((breakpoint === 'xxl' || breakpoint === 'xl' || breakpoint === 'lg' || breakpoint === 'md') && values.md !== undefined) return values.md;
    if (breakpoint !== 'xs' && values.sm !== undefined) return values.sm;
    return values.xs;
  };

  const columns = (options?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number }) => {
    const xs = options?.xs ?? 1;
    const sm = options?.sm ?? (width >= 480 ? 2 : 1);
    const md = options?.md ?? 2;
    const lg = options?.lg ?? 3;
    const xl = options?.xl ?? 4;

    return select({ xs, sm, md, lg, xl });
  };

  return {
    width,
    height,
    isSmallPhone,
    isPhone,
    isTablet,
    isTabletPortrait,
    isTabletLandscape,
    isDesktop,
    isLargeDesktop,
    showNavbarIconsOnly,
    breakpoint,
    isLandscape,
    contentMaxWidth,
    select,
    columns
  };
};

