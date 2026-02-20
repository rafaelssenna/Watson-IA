import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, H1, Text, Input, Button, Spinner, Checkbox, Label, useTheme } from "tamagui";
import { useAuthStore } from "@/stores/authStore";

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    organizationName: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const theme = useTheme();

  const { register, isLoading } = useAuthStore();

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "Nome obrigatorio";
    if (!formData.email) newErrors.email = "Email obrigatorio";
    if (!formData.organizationName) newErrors.organizationName = "Nome da empresa obrigatorio";
    if (formData.password.length < 8) {
      newErrors.password = "Senha deve ter no minimo 8 caracteres";
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Senhas nao conferem";
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Aceite os termos para continuar";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      await register(formData);
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrors({ general: err.message });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.background.val }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: theme.background.val }}
      >
        <YStack flex={1} padding="$6" paddingTop="$10" backgroundColor="$background">
          <YStack marginBottom="$6">
            <H1 color="$color">Criar Conta</H1>
            <Text color="$gray8">
              Comece seu teste gratuito de 7 dias
            </Text>
          </YStack>

          <YStack gap="$4">
            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Seu nome
              </Text>
              <Input
                value={formData.name}
                onChangeText={(v) => updateField("name", v)}
                placeholder="Joao Silva"
                placeholderTextColor={theme.gray7.val}
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              {errors.name && (
                <Text color="$red10" fontSize="$2">{errors.name}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Email
              </Text>
              <Input
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="seu@email.com"
                placeholderTextColor={theme.gray7.val}
                keyboardType="email-address"
                autoCapitalize="none"
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              {errors.email && (
                <Text color="$red10" fontSize="$2">{errors.email}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Telefone (WhatsApp)
              </Text>
              <Input
                value={formData.phone}
                onChangeText={(v) => updateField("phone", v)}
                placeholder="(11) 99999-9999"
                placeholderTextColor={theme.gray7.val}
                keyboardType="phone-pad"
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Nome da Empresa
              </Text>
              <Input
                value={formData.organizationName}
                onChangeText={(v) => updateField("organizationName", v)}
                placeholder="Minha Empresa LTDA"
                placeholderTextColor={theme.gray7.val}
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              {errors.organizationName && (
                <Text color="$red10" fontSize="$2">{errors.organizationName}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Senha
              </Text>
              <Input
                value={formData.password}
                onChangeText={(v) => updateField("password", v)}
                placeholder="Minimo 8 caracteres"
                placeholderTextColor={theme.gray7.val}
                secureTextEntry
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              {errors.password && (
                <Text color="$red10" fontSize="$2">{errors.password}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$gray8">
                Confirmar Senha
              </Text>
              <Input
                value={formData.confirmPassword}
                onChangeText={(v) => updateField("confirmPassword", v)}
                placeholder="Confirme sua senha"
                placeholderTextColor={theme.gray7.val}
                secureTextEntry
                size="$4"
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
                color="$color"
              />
              {errors.confirmPassword && (
                <Text color="$red10" fontSize="$2">{errors.confirmPassword}</Text>
              )}
            </YStack>

            <XStack alignItems="center" gap="$2">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(v) => updateField("acceptTerms", v)}
                backgroundColor="$backgroundStrong"
                borderColor="$gray6"
              >
                <Checkbox.Indicator>
                  <Text color="$blue10">✓</Text>
                </Checkbox.Indicator>
              </Checkbox>
              <Label htmlFor="terms" fontSize="$2" color="$gray8">
                Li e aceito os Termos de Uso e Politica de Privacidade
              </Label>
            </XStack>
            {errors.acceptTerms && (
              <Text color="$red10" fontSize="$2">{errors.acceptTerms}</Text>
            )}

            {errors.general && (
              <Text color="$red10" textAlign="center">{errors.general}</Text>
            )}

            <Button
              onPress={handleRegister}
              disabled={isLoading}
              size="$5"
              backgroundColor="$blue10"
              pressStyle={{ backgroundColor: "$blue9" }}
              marginTop="$2"
            >
              {isLoading ? <Spinner color="white" /> : <Text color="white" fontWeight="600">Criar Conta Gratuita</Text>}
            </Button>

            <XStack justifyContent="center" marginTop="$4">
              <Text color="$gray8">Ja tem conta? </Text>
              <Link href="/(auth)/login" asChild>
                <Text color="$blue10" fontWeight="600">Entrar</Text>
              </Link>
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
