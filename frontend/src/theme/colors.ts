export interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  tint: string;
}

export const lightTheme: ThemeColors = {
  primary: '#0D9488', // Teal profesional de salud
  primaryLight: '#CCFBF1',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  tint: '#0D9488'
};

export const darkTheme: ThemeColors = {
  primary: '#14B8A6',
  primaryLight: '#134E4A',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  tint: '#14B8A6'
};
