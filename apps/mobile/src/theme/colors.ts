/**
 * Watson AI - Sistema de Cores
 * Paleta de cores para temas claro e escuro
 */

// Cores primarias Watson
export const watsonColors = {
  // Azul Watson (Principal)
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },

  // Cinza Neutro
  gray: {
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
    950: "#09090b",
  },

  // Sucesso
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
  },

  // Erro
  error: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
  },

  // Alerta
  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
  },

  // Info
  info: {
    50: "#f0f9ff",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
  },

  // Roxo (Watson AI)
  purple: {
    50: "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",
    600: "#9333ea",
    700: "#7c3aed",
  },
};

// Tema Claro
export const lightTheme = {
  // Backgrounds
  background: "#ffffff",
  backgroundSecondary: watsonColors.gray[50],
  backgroundTertiary: watsonColors.gray[100],
  backgroundHover: watsonColors.gray[100],
  backgroundPress: watsonColors.gray[200],
  backgroundCard: "#ffffff",

  // Textos
  color: watsonColors.gray[900],
  colorSecondary: watsonColors.gray[700],
  colorSubtle: watsonColors.gray[500],
  colorMuted: watsonColors.gray[400],

  // Bordas
  borderColor: watsonColors.gray[200],
  borderColorStrong: watsonColors.gray[300],

  // Primaria
  primary: watsonColors.primary[600],
  primaryHover: watsonColors.primary[700],
  primarySubtle: watsonColors.primary[50],
  primaryText: "#ffffff",

  // Status
  success: watsonColors.success[500],
  successSubtle: watsonColors.success[50],
  error: watsonColors.error[500],
  errorSubtle: watsonColors.error[50],
  warning: watsonColors.warning[500],
  warningSubtle: watsonColors.warning[50],
  info: watsonColors.info[500],
  infoSubtle: watsonColors.info[50],

  // Watson especificos
  watsonPurple: watsonColors.purple[600],
  watsonBlue: watsonColors.primary[600],

  // Urgencia (Lead Score)
  urgencyCold: watsonColors.info[500],
  urgencyWarm: watsonColors.warning[500],
  urgencyHot: watsonColors.error[500],
  urgencyCritical: watsonColors.error[600],

  // Mensagens
  messageBubbleUser: watsonColors.primary[600],
  messageBubbleOther: watsonColors.gray[100],
  messageTextUser: "#ffffff",
  messageTextOther: watsonColors.gray[900],

  // Input
  inputBackground: "#ffffff",
  inputBorder: watsonColors.gray[300],
  inputPlaceholder: watsonColors.gray[400],

  // Shadows
  shadowColor: "rgba(0, 0, 0, 0.1)",
};

// Tema Escuro
export const darkTheme = {
  // Backgrounds
  background: watsonColors.gray[950],
  backgroundSecondary: watsonColors.gray[900],
  backgroundTertiary: watsonColors.gray[800],
  backgroundHover: watsonColors.gray[800],
  backgroundPress: watsonColors.gray[700],
  backgroundCard: watsonColors.gray[900],

  // Textos
  color: watsonColors.gray[50],
  colorSecondary: watsonColors.gray[200],
  colorSubtle: watsonColors.gray[400],
  colorMuted: watsonColors.gray[500],

  // Bordas
  borderColor: watsonColors.gray[800],
  borderColorStrong: watsonColors.gray[700],

  // Primaria
  primary: watsonColors.primary[500],
  primaryHover: watsonColors.primary[400],
  primarySubtle: watsonColors.primary[900],
  primaryText: "#ffffff",

  // Status
  success: watsonColors.success[400],
  successSubtle: "rgba(34, 197, 94, 0.15)",
  error: watsonColors.error[400],
  errorSubtle: "rgba(239, 68, 68, 0.15)",
  warning: watsonColors.warning[400],
  warningSubtle: "rgba(245, 158, 11, 0.15)",
  info: watsonColors.info[400],
  infoSubtle: "rgba(14, 165, 233, 0.15)",

  // Watson especificos
  watsonPurple: watsonColors.purple[500],
  watsonBlue: watsonColors.primary[500],

  // Urgencia (Lead Score)
  urgencyCold: watsonColors.info[400],
  urgencyWarm: watsonColors.warning[400],
  urgencyHot: watsonColors.error[400],
  urgencyCritical: watsonColors.error[500],

  // Mensagens
  messageBubbleUser: watsonColors.primary[600],
  messageBubbleOther: watsonColors.gray[800],
  messageTextUser: "#ffffff",
  messageTextOther: watsonColors.gray[50],

  // Input
  inputBackground: watsonColors.gray[900],
  inputBorder: watsonColors.gray[700],
  inputPlaceholder: watsonColors.gray[500],

  // Shadows
  shadowColor: "rgba(0, 0, 0, 0.4)",
};

export type ThemeColors = typeof lightTheme;
