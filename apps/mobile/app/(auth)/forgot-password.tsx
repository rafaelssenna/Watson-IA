import { useState } from "react";
import { router } from "expo-router";
import { Alert, StyleSheet, View, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { YStack, XStack, Text, Input, Button, Spinner } from "tamagui";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

type Step = "email" | "code" | "password";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { gradient, primary } = useAppColors();

  const handleRequestCode = async () => {
    if (!email) {
      Alert.alert("Erro", "Digite seu email");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.toLowerCase().trim() });
      setStep("code");
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível enviar o código");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Erro", "Digite o código de 6 dígitos");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/verify-reset-code", {
        email: email.toLowerCase().trim(),
        code,
      });
      setStep("password");
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Código inválido ou expirado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Erro", "Senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas não conferem");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.toLowerCase().trim(),
        code,
        newPassword,
      });
      Alert.alert("Sucesso", "Senha alterada com sucesso!", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível alterar a senha");
    } finally {
      setIsLoading(false);
    }
  };

  const getHeaderTitle = () => {
    if (step === "email") return "Esqueceu a senha?";
    if (step === "code") return "Verificar código";
    return "Nova senha";
  };

  const getHeaderSubtitle = () => {
    if (step === "email") return "Digite seu email e enviaremos um código de 6 dígitos.";
    if (step === "code") return `Enviamos um código para ${email}`;
    return "Crie uma nova senha para sua conta.";
  };

  const handleBack = () => {
    if (step === "email") router.back();
    else if (step === "code") setStep("email");
    else setStep("code");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: gradient[0] }}
    >
      {/* Gradient header — clean */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
            <Text style={styles.headerSubtitle}>{getHeaderSubtitle()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Card */}
      <View style={styles.card}>
        {/* Step 1: Email */}
        {step === "email" && (
          <YStack gap="$3">
            <YStack>
              <Text style={styles.label}>Email</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
            </YStack>

            <Button
              onPress={handleRequestCode}
              disabled={isLoading || !email}
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
                  Enviar Código
                </Text>
              )}
            </Button>
          </YStack>
        )}

        {/* Step 2: Code */}
        {step === "code" && (
          <YStack gap="$3">
            <YStack alignItems="center" marginBottom="$2">
              <View style={[styles.iconCircle, { backgroundColor: `${primary}18` }]}>
                <Ionicons name="mail-open-outline" size={40} color={primary} />
              </View>
            </YStack>

            <YStack>
              <Text style={[styles.label, { textAlign: "center" }]}>Código de verificação</Text>
              <Input
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={6}
                size="$5"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
                textAlign="center"
                letterSpacing={8}
                fontSize={24}
                fontWeight="bold"
              />
            </YStack>

            <Button
              onPress={handleVerifyCode}
              disabled={isLoading || code.length !== 6}
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
                  Verificar Código
                </Text>
              )}
            </Button>

            <TouchableOpacity onPress={handleRequestCode}>
              <Text color={primary} textAlign="center" marginTop="$2" fontSize={14}>
                Reenviar código
              </Text>
            </TouchableOpacity>
          </YStack>
        )}

        {/* Step 3: New Password */}
        {step === "password" && (
          <YStack gap="$3">
            <YStack>
              <Text style={styles.label}>Nova senha</Text>
              <XStack alignItems="center">
                <Input
                  flex={1}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  size="$4"
                  backgroundColor="#f8f8f8"
                  borderColor="#e0e0e0"
                  borderWidth={1}
                  borderRadius={12}
                  color="#000"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </XStack>
            </YStack>

            <YStack>
              <Text style={styles.label}>Confirmar senha</Text>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a senha"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
            </YStack>

            <Button
              onPress={handleResetPassword}
              disabled={isLoading || !newPassword || !confirmPassword}
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
                  Alterar Senha
                </Text>
              )}
            </Button>
          </YStack>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 160,
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
