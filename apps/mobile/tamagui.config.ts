import { createTamagui } from "tamagui";
import { config as defaultConfig } from "@tamagui/config/v3";
import { lightTheme, darkTheme, watsonColors } from "./src/theme/colors";

const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      // Backgrounds
      background: lightTheme.background,
      backgroundHover: lightTheme.backgroundHover,
      backgroundPress: lightTheme.backgroundPress,
      backgroundFocus: lightTheme.backgroundSecondary,
      backgroundStrong: lightTheme.backgroundSecondary,
      backgroundTransparent: "transparent",

      // Colors
      color: lightTheme.color,
      colorHover: lightTheme.color,
      colorPress: lightTheme.colorSecondary,
      colorFocus: lightTheme.color,
      colorTransparent: "transparent",
      colorSubtle: lightTheme.colorSubtle,
      colorMuted: lightTheme.colorMuted,

      // Borders
      borderColor: lightTheme.borderColor,
      borderColorHover: lightTheme.borderColorStrong,
      borderColorFocus: lightTheme.primary,
      borderColorPress: lightTheme.borderColorStrong,

      // Primary (Watson Blue)
      blue10: lightTheme.primary,
      blue9: watsonColors.primary[500],
      blue8: watsonColors.primary[400],
      blue7: watsonColors.primary[300],
      blue6: watsonColors.primary[200],
      blue5: watsonColors.primary[100],

      // Success
      green10: lightTheme.success,
      green9: watsonColors.success[400],
      green5: lightTheme.successSubtle,

      // Error
      red10: lightTheme.error,
      red9: watsonColors.error[400],
      red5: lightTheme.errorSubtle,

      // Warning
      yellow10: lightTheme.warning,
      yellow9: watsonColors.warning[400],
      yellow5: lightTheme.warningSubtle,

      // Purple (Watson AI)
      purple10: lightTheme.watsonPurple,
      purple9: watsonColors.purple[500],
      purple5: watsonColors.purple[100],

      // Gray scale
      gray12: watsonColors.gray[900],
      gray11: watsonColors.gray[800],
      gray10: watsonColors.gray[700],
      gray9: watsonColors.gray[600],
      gray8: watsonColors.gray[500],
      gray7: watsonColors.gray[400],
      gray6: watsonColors.gray[300],
      gray5: watsonColors.gray[200],
      gray4: watsonColors.gray[100],
      gray3: watsonColors.gray[50],
      gray2: "#fafafa",
      gray1: "#ffffff",

      // Cards
      card: lightTheme.backgroundCard,
      cardHover: lightTheme.backgroundHover,

      // Shadows
      shadowColor: lightTheme.shadowColor,
      shadowColorHover: "rgba(0, 0, 0, 0.15)",
    },
    dark: {
      ...defaultConfig.themes.dark,
      // Backgrounds
      background: darkTheme.background,
      backgroundHover: darkTheme.backgroundHover,
      backgroundPress: darkTheme.backgroundPress,
      backgroundFocus: darkTheme.backgroundSecondary,
      backgroundStrong: darkTheme.backgroundSecondary,
      backgroundTransparent: "transparent",

      // Colors
      color: darkTheme.color,
      colorHover: darkTheme.color,
      colorPress: darkTheme.colorSecondary,
      colorFocus: darkTheme.color,
      colorTransparent: "transparent",
      colorSubtle: darkTheme.colorSubtle,
      colorMuted: darkTheme.colorMuted,

      // Borders
      borderColor: darkTheme.borderColor,
      borderColorHover: darkTheme.borderColorStrong,
      borderColorFocus: darkTheme.primary,
      borderColorPress: darkTheme.borderColorStrong,

      // Primary (Watson Blue)
      blue10: darkTheme.primary,
      blue9: watsonColors.primary[400],
      blue8: watsonColors.primary[300],
      blue7: watsonColors.primary[200],
      blue6: watsonColors.primary[100],
      blue5: darkTheme.primarySubtle,

      // Success
      green10: darkTheme.success,
      green9: watsonColors.success[300],
      green5: darkTheme.successSubtle,

      // Error
      red10: darkTheme.error,
      red9: watsonColors.error[300],
      red5: darkTheme.errorSubtle,

      // Warning
      yellow10: darkTheme.warning,
      yellow9: watsonColors.warning[300],
      yellow5: darkTheme.warningSubtle,

      // Purple (Watson AI)
      purple10: darkTheme.watsonPurple,
      purple9: watsonColors.purple[400],
      purple5: "rgba(168, 85, 247, 0.15)",

      // Gray scale
      gray12: watsonColors.gray[50],
      gray11: watsonColors.gray[100],
      gray10: watsonColors.gray[200],
      gray9: watsonColors.gray[300],
      gray8: watsonColors.gray[400],
      gray7: watsonColors.gray[500],
      gray6: watsonColors.gray[600],
      gray5: watsonColors.gray[700],
      gray4: watsonColors.gray[800],
      gray3: watsonColors.gray[900],
      gray2: watsonColors.gray[950],
      gray1: "#000000",

      // Cards
      card: darkTheme.backgroundCard,
      cardHover: darkTheme.backgroundHover,

      // Shadows
      shadowColor: darkTheme.shadowColor,
      shadowColorHover: "rgba(0, 0, 0, 0.5)",
    },
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
