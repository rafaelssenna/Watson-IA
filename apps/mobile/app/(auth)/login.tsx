import { useState } from "react";
import { KeyboardAvoidingView, Platform, Image } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, H1, Text, Input, Button, Spinner, useTheme } from "tamagui";
import { useAuthStore } from "@/stores/authStore";
import { Ionicons } from "@expo/vector-icons";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";
const WATSON_SLATE = "#334155";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const theme = useTheme();

  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Preencha todos os campos");
      return;
    }

    setError("");

    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.background.val }}
    >
      <YStack
        flex={1}
        backgroundColor="$background"
        padding="$6"
        justifyContent="center"
      >
        {/* Logo Watson IA */}
        <YStack alignItems="center" marginBottom="$8">
          {/* Logo Icon - stylized W with brand colors */}
          <XStack alignItems="center" justifyContent="center" marginBottom="$3">
            <YStack
              width={80}
              height={80}
              alignItems="center"
              justifyContent="center"
              style={{
                transform: [{ rotate: "45deg" }],
              }}
            >
              {/* Outer diamond - slate */}
              <YStack
                position="absolute"
                width={60}
                height={60}
                borderWidth={4}
                borderColor={WATSON_SLATE}
                borderRadius={12}
              />
              {/* Inner diamond - teal */}
              <YStack
                position="absolute"
                width={40}
                height={40}
                borderWidth={4}
                borderColor={WATSON_TEAL}
                borderRadius={8}
                style={{
                  transform: [{ translateX: 8 }, { translateY: 8 }],
                }}
              />
            </YStack>
          </XStack>

          {/* Brand Name */}
          <XStack alignItems="center" gap="$2">
            <Text fontSize={28} fontWeight="300" color={WATSON_SLATE} letterSpacing={2}>
              WATSON
            </Text>
            <Text fontSize={28} fontWeight="600" color={WATSON_TEAL} letterSpacing={2}>
              IA
            </Text>
          </XStack>
          <Text color="$gray8" marginTop="$2" fontSize="$3">
            Assistente de vendas inteligente
          </Text>
        </YStack>

        {/* Form */}
        <YStack gap="$4">
          <YStack>
            <Text marginBottom="$1" fontSize="$3" color="$gray8">
              Email
            </Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={theme.gray7.val}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              size="$4"
              backgroundColor="$backgroundStrong"
              borderColor="$gray6"
              color="$color"
            />
          </YStack>

          <YStack>
            <Text marginBottom="$1" fontSize="$3" color="$gray8">
              Senha
            </Text>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.gray7.val}
              secureTextEntry
              autoComplete="password"
              size="$4"
              backgroundColor="$backgroundStrong"
              borderColor="$gray6"
              color="$color"
            />
          </YStack>

          {error && (
            <Text color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          <Button
            onPress={handleLogin}
            disabled={isLoading}
            size="$5"
            backgroundColor={WATSON_TEAL}
            pressStyle={{ opacity: 0.9 }}
            marginTop="$2"
            borderRadius="$4"
          >
            {isLoading ? <Spinner color="white" /> : <Text color="white" fontWeight="600" fontSize="$4">Entrar</Text>}
          </Button>

          <Link href="/(auth)/forgot-password" asChild>
            <Text color={WATSON_TEAL} textAlign="center" marginTop="$3" fontSize="$3">
              Esqueceu a senha?
            </Text>
          </Link>
        </YStack>

        {/* Register Link */}
        <XStack justifyContent="center" marginTop="$8">
          <Text color="$gray8">Nao tem conta? </Text>
          <Link href="/(auth)/register" asChild>
            <Text color={WATSON_TEAL} fontWeight="600">
              Criar conta
            </Text>
          </Link>
        </XStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}
