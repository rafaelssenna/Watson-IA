import { createTamagui } from "tamagui";
import { config as defaultConfig } from "@tamagui/config/v3";

const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: "#ffffff",
      backgroundHover: "#f5f5f5",
      backgroundPress: "#e5e5e5",
      color: "#1a1a1a",
      colorSubtle: "#666666",
      borderColor: "#e5e5e5",
      blue10: "#2563eb",
      blue9: "#3b82f6",
      green10: "#22c55e",
      red10: "#ef4444",
      yellow10: "#f59e0b",
      purple10: "#8b5cf6",
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: "#0a0a0a",
      backgroundHover: "#1a1a1a",
      backgroundPress: "#2a2a2a",
      color: "#fafafa",
      colorSubtle: "#a0a0a0",
      borderColor: "#2a2a2a",
      blue10: "#3b82f6",
      blue9: "#60a5fa",
      green10: "#4ade80",
      red10: "#f87171",
      yellow10: "#fbbf24",
      purple10: "#a78bfa",
    },
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
