/**
 * @file colors.ts
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
  background: '#F7F8F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F0F2F0',

  // Tipografía
  text: '#202522',
  textSecondary: '#727873',
  textMuted: '#9AA09B',

  // Bordes
  border: '#E7EAE7',
  borderSubtle: '#EFF2EF',

  // Acento Verde Salvia
  primary: '#537C68',
  primaryHover: '#426353',
  primaryLight: '#E9F0EC',
  primarySoft: '#F2F6F3',
  primaryContrast: '#FFFFFF',

  // Semánticos
  success: '#2E7D32',
  successBg: '#E8F5E9',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  error: '#C62828',
  errorBg: '#FFEBEE',
  info: '#1565C0',
  infoBg: '#E3F2FD',

  // Legacy
  card: '#FFFFFF',
  tint: '#537C68'
};

export const darkTheme: ThemeColors = {
  // Fondos y superficies
  background: '#151816',
  surface: '#1D211E',
  surfaceElevated: '#252B26',
  surfaceSubtle: '#191E1A',

  // Tipografía
  text: '#F0F2F0',
  textSecondary: '#A2AAA4',
  textMuted: '#6E7670',

  // Bordes
  border: '#303631',
  borderSubtle: '#262C27',

  // Acento Verde Salvia Claro
  primary: '#91B7A0',
  primaryHover: '#A6C8B4',
  primaryLight: '#1E2E25',
  primarySoft: '#18241D',
  primaryContrast: '#0D1510',

  // Semánticos
  success: '#81C784',
  successBg: '#1B3322',
  warning: '#FBBF24',
  warningBg: '#332A15',
  error: '#E57373',
  errorBg: '#3A1E1E',
  info: '#64B5F6',
  infoBg: '#16293D',

  // Legacy
  card: '#1D211E',
  tint: '#91B7A0'
};
