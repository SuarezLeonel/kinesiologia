/**
 * @file colors.tsx
 * @description Paleta de colores accesible para modo claro y oscuro del consultorio kinésico.
 */
export interface SemanticColor {
  text: string;
  bg: string;
  border: string;
}

export interface ThemeColors {
  // Fondos y superficies
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;

  // Tipografía
  text: string;
  textSecondary: string;
  textMuted: string;

  // Bordes
  border: string;
  borderSubtle: string;

  // Identidad de marca (Verde Salvia)
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primarySoft: string;
  primaryContrast: string;

  // Estados semánticos (texto + fondo suave + borde)
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  // Legacy mappings para compatibilidad
  card: string;
  tint: string;
}

export const lightTheme: ThemeColors = {
  // Fondos y superficies
  background: '#F5F7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#EDF1EE',

  // Tipografía (Contraste WCAG 2.2 AA/AAA reforzado para adultos mayores)
  text: '#161C18',
  textSecondary: '#434D46',
  textMuted: '#5C665F',

  // Bordes claramente distinguibles
  border: '#CED6D0',
  borderSubtle: '#DDE3DF',

  // Acento Verde Salud Profesional (Contraste >= 6.8:1 con texto blanco)
  primary: '#2F664B',
  primaryHover: '#234F39',
  primaryLight: '#E3EFE9',
  primarySoft: '#EDF5F0',
  primaryContrast: '#FFFFFF',

  // Semánticos de alto contraste
  success: '#1B5E20',
  successBg: '#E8F5E9',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  error: '#B71C1C',
  errorBg: '#FFEBEE',
  info: '#0D47A1',
  infoBg: '#E3F2FD',

  // Legacy
  card: '#FFFFFF',
  tint: '#2F664B'
};

export const darkTheme: ThemeColors = {
  // Fondos y superficies
  background: '#111613',
  surface: '#1A211D',
  surfaceElevated: '#222B26',
  surfaceSubtle: '#151B18',

  // Tipografía (Contraste WCAG 2.2 AA/AAA en modo oscuro)
  text: '#F4F7F5',
  textSecondary: '#C2CCC5',
  textMuted: '#96A39A',

  // Bordes visibles en modo oscuro
  border: '#3A463E',
  borderSubtle: '#2C362F',

  // Acento Verde Salvia Claro
  primary: '#7CC49B',
  primaryHover: '#94D1AE',
  primaryLight: '#1E3328',
  primarySoft: '#17261E',
  primaryContrast: '#0A140E',

  // Semánticos
  success: '#81C784',
  successBg: '#193320',
  warning: '#FBBF24',
  warningBg: '#362B12',
  error: '#FCA5A5',
  errorBg: '#3D1A1A',
  info: '#90CAF9',
  infoBg: '#152A40',

  // Legacy
  card: '#1A211D',
  tint: '#7CC49B'
};
