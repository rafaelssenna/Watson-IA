import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function SettingsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? "#09090b" : "#ffffff",
        },
        headerTintColor: isDark ? "#fafafa" : "#18181b",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    />
  );
}
