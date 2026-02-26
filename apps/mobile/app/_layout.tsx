import { useEffect, useRef } from "react";
import { Stack, Redirect, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { TamaguiProvider, Theme } from "tamagui";
import { useFonts } from "expo-font";
import { useColorScheme, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import config from "../tamagui.config";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

async function registerForPushNotifications() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Watson",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      });
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "watson-ia",
    });

    // Save token to API
    await api.post("/auth/push-token", { pushToken: token.data });
  } catch (error) {
    console.log("Push notification registration error:", error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialize, isLoading: authLoading, isAuthenticated } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
  });

  useEffect(() => {
    initialize();
  }, []);

  // Register for push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config}>
        <Theme name={colorScheme === "dark" ? "dark" : "light"}>
          <StatusBar style="auto" />
          <RootNavigator isAuthenticated={isAuthenticated} />
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ isAuthenticated }: { isAuthenticated: boolean }) {
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";

  // Handle redirects
  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="conversation/[id]"
        options={{
          headerShown: true,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="contact/[id]"
        options={{
          headerShown: true,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
