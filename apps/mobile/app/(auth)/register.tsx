import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, H1, Text, Input, Button, Spinner, Checkbox, Label } from "tamagui";
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
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} padding="$6" paddingTop="$10">
          <YStack marginBottom="$6">
            <H1>Criar Conta</H1>
            <Text color="$colorSubtle">
              Comece seu teste gratuito de 7 dias
            </Text>
          </YStack>

          <YStack gap="$4">
            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Seu nome
              </Text>
              <Input
                value={formData.name}
                onChangeText={(v) => updateField("name", v)}
                placeholder="Joao Silva"
                size="$4"
              />
              {errors.name && (
                <Text color="$red10" fontSize="$2">{errors.name}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Email
              </Text>
              <Input
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                size="$4"
              />
              {errors.email && (
                <Text color="$red10" fontSize="$2">{errors.email}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Telefone (WhatsApp)
              </Text>
              <Input
                value={formData.phone}
                onChangeText={(v) => updateField("phone", v)}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
                size="$4"
              />
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Nome da Empresa
              </Text>
              <Input
                value={formData.organizationName}
                onChangeText={(v) => updateField("organizationName", v)}
                placeholder="Minha Empresa LTDA"
                size="$4"
              />
              {errors.organizationName && (
                <Text color="$red10" fontSize="$2">{errors.organizationName}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Senha
              </Text>
              <Input
                value={formData.password}
                onChangeText={(v) => updateField("password", v)}
                placeholder="Minimo 8 caracteres"
                secureTextEntry
                size="$4"
              />
              {errors.password && (
                <Text color="$red10" fontSize="$2">{errors.password}</Text>
              )}
            </YStack>

            <YStack>
              <Text marginBottom="$1" fontSize="$3" color="$colorSubtle">
                Confirmar Senha
              </Text>
              <Input
                value={formData.confirmPassword}
                onChangeText={(v) => updateField("confirmPassword", v)}
                placeholder="Confirme sua senha"
                secureTextEntry
                size="$4"
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
              >
                <Checkbox.Indicator>
                  <Text>✓</Text>
                </Checkbox.Indicator>
              </Checkbox>
              <Label htmlFor="terms" fontSize="$2">
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
              color="white"
              marginTop="$2"
            >
              {isLoading ? <Spinner color="white" /> : "Criar Conta Gratuita"}
            </Button>

            <XStack justifyContent="center" marginTop="$4">
              <Text color="$colorSubtle">Ja tem conta? </Text>
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
