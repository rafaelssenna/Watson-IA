import { useThemeStore, COLOR_PRESETS } from "@/stores/themeStore";

export function useAppColors() {
  const preset = useThemeStore((s) => s.preset);
  const colors = COLOR_PRESETS[preset] || COLOR_PRESETS.ocean;

  return {
    gradient: colors.gradient,
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    bubbleOut: colors.gradient[0],
  };
}
