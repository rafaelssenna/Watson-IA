import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, H1, Text, Input, Button, Spinner, useTheme } from "tamagui";
import { useAuthStore } from "@/stores/authStore";

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
        {/* Logo */}
        <YStack alignItems="center" marginBottom="$8">
          <YStack
            width={100}
            height={100}
            backgroundColor="$blue10"
            borderRadius={20}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={40}>🤖</Text>
          </YStack>
          <H1 marginTop="$4" color="$color">Watson AI</H1>
          <Text color="$gray8">Seu assistente de vendas inteligente</Text>
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
            backgroundColor="$blue10"
            pressStyle={{ backgroundColor: "$blue9" }}
            marginTop="$2"
          >
            {isLoading ? <Spinner color="white" /> : <Text color="white" fontWeight="600">Entrar</Text>}
          </Button>

          <Link href="/(auth)/forgot-password" asChild>
            <Text color="$blue10" textAlign="center" marginTop="$2">
              Esqueceu a senha?
            </Text>
          </Link>
        </YStack>

        {/* Register Link */}
        <XStack justifyContent="center" marginTop="$8">
          <Text color="$gray8">Nao tem conta? </Text>
          <Link href="/(auth)/register" asChild>
            <Text color="$blue10" fontWeight="600">
              Criar conta
            </Text>
          </Link>
        </XStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}
