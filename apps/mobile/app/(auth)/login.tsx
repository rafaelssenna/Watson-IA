import { useState } from "react";
import { KeyboardAvoidingView, Platform, Image, Alert, StyleSheet, View } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, Text, Input, Button, Spinner } from "tamagui";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/authStore";
import { useAppColors } from "@/hooks/useAppColors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { gradient, primary } = useAppColors();

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
      const msg = err.message || "Erro ao fazer login";
      setError(msg);

      if (msg.includes("expirou") || msg.includes("cancelada")) {
        Alert.alert("Acesso bloqueado", msg);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: gradient[0] }}
    >
      {/* Gradient header — clean, no shapes */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Image
          source={require("../../assets/watson-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </LinearGradient>

      {/* Card with form */}
      <View style={styles.card}>
        <Text style={styles.title}>Entrar</Text>

        <YStack gap="$3" marginTop="$3">
          <YStack>
            <Text style={styles.label}>Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              size="$4"
              backgroundColor="#f8f8f8"
              borderColor="#e0e0e0"
              borderWidth={1}
              borderRadius={12}
              color="#000"
            />
          </YStack>

          <YStack>
            <Text style={styles.label}>Senha</Text>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#999"
              secureTextEntry
              autoComplete="password"
              size="$4"
              backgroundColor="#f8f8f8"
              borderColor="#e0e0e0"
              borderWidth={1}
              borderRadius={12}
              color="#000"
            />
          </YStack>

          {error && (
            <YStack
              backgroundColor={error.includes("expirou") || error.includes("cancelada") ? "#fff3e0" : "#fde8e8"}
              borderRadius={12}
              padding="$3"
              borderWidth={1}
              borderColor={error.includes("expirou") || error.includes("cancelada") ? "#ffb74d" : "#ef5350"}
            >
              <Text
                color={error.includes("expirou") || error.includes("cancelada") ? "#e65100" : "#c62828"}
                textAlign="center"
                fontWeight="600"
                fontSize={13}
              >
                {error}
              </Text>
            </YStack>
          )}

          <Button
            onPress={handleLogin}
            disabled={isLoading}
            size="$5"
            backgroundColor={primary}
            pressStyle={{ opacity: 0.8 }}
            marginTop="$2"
            borderRadius={14}
          >
            {isLoading ? (
              <Spinner color="white" />
            ) : (
              <Text color="white" fontWeight="700" fontSize={16}>
                Entrar
              </Text>
            )}
          </Button>

          <Link href="/(auth)/forgot-password" asChild>
            <Text color="#666" textAlign="center" marginTop="$2" fontSize={13}>
              Esqueceu a senha?
            </Text>
          </Link>
        </YStack>

        <XStack justifyContent="center" marginTop="$6">
          <Text color="#666" fontSize={14}>Não tem conta? </Text>
          <Link href="/(auth)/register" asChild>
            <Text color={primary} fontWeight="700" fontSize={14}>
              Criar Conta
            </Text>
          </Link>
        </XStack>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: "25%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: {
    width: 120,
    height: 120,
    tintColor: "#fff",
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    marginTop: -20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
});
