import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { Text } from "tamagui";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const tabBarStyle = {
    backgroundColor: colorScheme === "dark" ? "#0a0a0a" : "#ffffff",
    borderTopColor: colorScheme === "dark" ? "#2a2a2a" : "#e5e5e5",
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  };

  const activeColor = "#2563eb";
  const inactiveColor = colorScheme === "dark" ? "#666666" : "#999999";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle,
        headerStyle: {
          backgroundColor: colorScheme === "dark" ? "#0a0a0a" : "#ffffff",
        },
        headerTintColor: colorScheme === "dark" ? "#ffffff" : "#000000",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerTitle: "Watson Insights",
          tabBarIcon: ({ color }) => <TabIcon name="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: "Conversas",
          tabBarIcon: ({ color }) => <TabIcon name="💬" color={color} />,
          tabBarBadge: undefined, // Will be dynamic
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: "CRM",
          tabBarIcon: ({ color }) => <TabIcon name="👥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <TabIcon name="📈" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => <TabIcon name="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <Text fontSize={20} style={{ opacity: color === "#2563eb" ? 1 : 0.6 }}>
      {name}
    </Text>
  );
}
