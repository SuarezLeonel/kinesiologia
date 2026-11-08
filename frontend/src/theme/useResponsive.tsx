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
  isSmallPhone: boolean;  // <= 360px (celulares compactos y pequeños como iPhone SE o Galaxy A)
  isPhone: boolean;       // < 768px (todos los celulares)
  isTablet: boolean;      // >= 768px && < 1024px (tablets verticales y horizontales)
  isDesktop: boolean;     // >= 1024px (laptops, notebooks y monitores)
  isLargeDesktop: boolean;// >= 1440px (monitores anchos de escritorio)
  
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
  // md: 768px - 1023px (tablets)
  // lg: 1024px - 1279px (notebooks y pantallas medianas)
  // xl: 1280px - 1439px (monitores estándar)
  // xxl: >= 1440px (monitores grandes)
  let breakpoint: BreakpointKey = 'sm';
  if (width < 390) {
    breakpoint = 'xs';
  } else if (width < 768) {
    breakpoint = 'sm';
  } else if (width < 1024) {
    breakpoint = 'md';
  } else if (width < 1280) {
    breakpoint = 'lg';
  } else if (width < 1440) {
    breakpoint = 'xl';
  } else {
    breakpoint = 'xxl';
  }

  const isSmallPhone = width <= 360;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const isLargeDesktop = width >= 1440;
  const isLandscape = width > height;

  // Ancho máximo contenido centralizado para pantallas grandes (evita estiramiento excesivo)
  let contentMaxWidth = width;
  if (width >= 1440) {
    contentMaxWidth = 1380;
  } else if (width >= 1024) {
    contentMaxWidth = 1140;
  }

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
    isDesktop,
    isLargeDesktop,
    breakpoint,
    isLandscape,
    contentMaxWidth,
    select,
    columns
  };
};

