import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ColorPreset {
  name: string;
  label: string;
  gradient: [string, string];
  primary: string;
  primaryLight: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  ocean: {
    name: "ocean",
    label: "Ocean",
    gradient: ["#0ea5e9", "#6366f1"],
    primary: "#0ea5e9",
    primaryLight: "#e0f2fe",
  },
  teal: {
    name: "teal",
    label: "Teal",
    gradient: ["#14b8a6", "#0d9488"],
    primary: "#0d9488",
    primaryLight: "#f0fdfa",
  },
  purple: {
    name: "purple",
    label: "Purple",
    gradient: ["#8b5cf6", "#ec4899"],
    primary: "#8b5cf6",
    primaryLight: "#f5f3ff",
  },
  sunset: {
    name: "sunset",
    label: "Sunset",
    gradient: ["#f97316", "#ef4444"],
    primary: "#f97316",
    primaryLight: "#fff7ed",
  },
  emerald: {
    name: "emerald",
    label: "Emerald",
    gradient: ["#10b981", "#059669"],
    primary: "#10b981",
    primaryLight: "#ecfdf5",
  },
  slate: {
    name: "slate",
    label: "Slate",
    gradient: ["#64748b", "#334155"],
    primary: "#64748b",
    primaryLight: "#f1f5f9",
  },
};

interface ThemeState {
  preset: string;
  getColors: () => ColorPreset;
  setPreset: (preset: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preset: "ocean",

      getColors: () => {
        return COLOR_PRESETS[get().preset] || COLOR_PRESETS.ocean;
      },

      setPreset: (preset: string) => {
        if (COLOR_PRESETS[preset]) {
          set({ preset });
        }
      },
    }),
    {
      name: "watson-theme",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preset: state.preset }),
    }
  )
);
