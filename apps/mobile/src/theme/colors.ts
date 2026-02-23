/**
 * Watson IA - Sistema de Cores
 * Paleta de cores baseada na identidade visual Watson IA
 * Teal/Cyan + Slate/Charcoal
 */

// Cores primarias Watson IA
export const watsonColors = {
  // Teal Watson (Principal) - baseado na logo
  primary: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },

  // Slate (Cinza-azulado da logo)
  gray: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
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

  // Info (Cyan)
  info: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
  },

  // Accent (Charcoal/Slate escuro da logo)
  accent: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },

  // Roxo (para highlights especiais)
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
  watsonTeal: watsonColors.primary[600],
  watsonSlate: watsonColors.gray[700],

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
  watsonTeal: watsonColors.primary[500],
  watsonSlate: watsonColors.gray[600],

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
