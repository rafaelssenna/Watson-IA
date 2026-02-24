import { useState } from "react";
import { Link, router } from "expo-router";
import { Alert, Pressable } from "react-native";
import { YStack, XStack, Text, Input, Button, Spinner, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

type Step = "email" | "code" | "password";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();

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
      Alert.alert("Erro", error?.message || "Nao foi possivel enviar o codigo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Erro", "Digite o codigo de 6 digitos");
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
      Alert.alert("Erro", error?.message || "Codigo invalido ou expirado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Erro", "Senha deve ter no minimo 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas nao conferem");
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
      Alert.alert("Erro", error?.message || "Nao foi possivel alterar a senha");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Email
  if (step === "email") {
    return (
      <YStack flex={1} padding="$6" justifyContent="center" backgroundColor="$background">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.color.val} />
        </Pressable>

        <YStack marginTop="$6">
          <Text fontSize={28} fontWeight="bold" color="$color">
            Esqueceu a senha?
          </Text>
          <Text color="$gray8" marginTop="$2" fontSize={15}>
            Digite seu email e enviaremos um codigo de 6 digitos para recuperar sua senha.
          </Text>
        </YStack>

        <YStack gap="$4" marginTop="$8">
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
              size="$4"
              backgroundColor="$backgroundStrong"
              borderColor="$gray6"
              color="$color"
            />
          </YStack>

          <Button
            onPress={handleRequestCode}
            disabled={isLoading || !email}
            size="$5"
            backgroundColor={WATSON_TEAL}
            pressStyle={{ opacity: 0.9 }}
            marginTop="$4"
          >
            {isLoading ? (
              <Spinner color="white" />
            ) : (
              <Text color="white" fontWeight="600">Enviar Codigo</Text>
            )}
          </Button>
        </YStack>
      </YStack>
    );
  }

  // Step 2: Code
  if (step === "code") {
    return (
      <YStack flex={1} padding="$6" justifyContent="center" backgroundColor="$background">
        <Pressable onPress={() => setStep("email")}>
          <Ionicons name="arrow-back" size={24} color={theme.color.val} />
        </Pressable>

        <YStack marginTop="$6" alignItems="center">
          <YStack
            width={80}
            height={80}
            borderRadius={40}
            backgroundColor={`${WATSON_TEAL}20`}
            alignItems="center"
            justifyContent="center"
          >
            <Ionicons name="mail-open-outline" size={40} color={WATSON_TEAL} />
          </YStack>

          <Text fontSize={24} fontWeight="bold" color="$color" marginTop="$4">
            Verifique seu email
          </Text>
          <Text color="$gray8" marginTop="$2" fontSize={15} textAlign="center">
            Enviamos um codigo de 6 digitos para{"\n"}
            <Text fontWeight="600" color="$color">{email}</Text>
          </Text>
        </YStack>

        <YStack gap="$4" marginTop="$8">
          <YStack>
            <Text marginBottom="$1" fontSize="$3" color="$gray8" textAlign="center">
              Codigo de verificacao
            </Text>
            <Input
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={theme.gray7.val}
              keyboardType="number-pad"
              maxLength={6}
              size="$5"
              backgroundColor="$backgroundStrong"
              borderColor="$gray6"
              color="$color"
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
            backgroundColor={WATSON_TEAL}
            pressStyle={{ opacity: 0.9 }}
            marginTop="$2"
          >
            {isLoading ? (
              <Spinner color="white" />
            ) : (
              <Text color="white" fontWeight="600">Verificar Codigo</Text>
            )}
          </Button>

          <Pressable onPress={handleRequestCode}>
            <Text color={WATSON_TEAL} textAlign="center" marginTop="$2" fontSize={14}>
              Reenviar codigo
            </Text>
          </Pressable>
        </YStack>
      </YStack>
    );
  }

  // Step 3: New Password
  return (
    <YStack flex={1} padding="$6" justifyContent="center" backgroundColor="$background">
      <Pressable onPress={() => setStep("code")}>
        <Ionicons name="arrow-back" size={24} color={theme.color.val} />
      </Pressable>

      <YStack marginTop="$6">
        <Text fontSize={28} fontWeight="bold" color="$color">
          Nova senha
        </Text>
        <Text color="$gray8" marginTop="$2" fontSize={15}>
          Crie uma nova senha para sua conta.
        </Text>
      </YStack>

      <YStack gap="$4" marginTop="$8">
        <YStack>
          <Text marginBottom="$1" fontSize="$3" color="$gray8">
            Nova senha
          </Text>
          <XStack alignItems="center">
            <Input
              flex={1}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor={theme.gray7.val}
              secureTextEntry={!showPassword}
              size="$4"
              backgroundColor="$backgroundStrong"
              borderColor="$gray6"
              color="$color"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 12 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.gray7.val}
              />
            </Pressable>
          </XStack>
        </YStack>

        <YStack>
          <Text marginBottom="$1" fontSize="$3" color="$gray8">
            Confirmar senha
          </Text>
          <Input
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a senha"
            placeholderTextColor={theme.gray7.val}
            secureTextEntry={!showPassword}
            size="$4"
            backgroundColor="$backgroundStrong"
            borderColor="$gray6"
            color="$color"
          />
        </YStack>

        <Button
          onPress={handleResetPassword}
          disabled={isLoading || !newPassword || !confirmPassword}
          size="$5"
          backgroundColor={WATSON_TEAL}
          pressStyle={{ opacity: 0.9 }}
          marginTop="$4"
        >
          {isLoading ? (
            <Spinner color="white" />
          ) : (
            <Text color="white" fontWeight="600">Alterar Senha</Text>
          )}
        </Button>
      </YStack>
    </YStack>
  );
}
