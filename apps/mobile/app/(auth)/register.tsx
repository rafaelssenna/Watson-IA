import { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet, View, TouchableOpacity } from "react-native";
import { Link, router } from "expo-router";
import { YStack, XStack, Text, Input, Button, Spinner, Checkbox, Label } from "tamagui";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/authStore";
import { useAppColors } from "@/hooks/useAppColors";
import { Ionicons } from "@expo/vector-icons";

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
  const { gradient, primary } = useAppColors();

  const { register, isLoading } = useAuthStore();

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "Nome obrigatório";
    if (!formData.email) newErrors.email = "Email obrigatório";
    if (!formData.organizationName) newErrors.organizationName = "Nome da empresa obrigatório";
    if (formData.password.length < 8) {
      newErrors.password = "Senha deve ter no mínimo 8 caracteres";
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Senhas não conferem";
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar Conta</Text>
        </View>
      </LinearGradient>

      {/* Card with form */}
      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <YStack gap="$3">
            <YStack>
              <Text style={styles.label}>Nome</Text>
              <Input
                value={formData.name}
                onChangeText={(v) => updateField("name", v)}
                placeholder="João Silva"
                placeholderTextColor="#999"
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
              {errors.name && (
                <Text color="#c62828" fontSize={12} marginTop="$1">{errors.name}</Text>
              )}
            </YStack>

            <YStack>
              <Text style={styles.label}>Email</Text>
              <Input
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
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
              {errors.email && (
                <Text color="#c62828" fontSize={12} marginTop="$1">{errors.email}</Text>
              )}
            </YStack>

            <YStack>
              <Text style={styles.label}>Telefone (WhatsApp)</Text>
              <Input
                value={formData.phone}
                onChangeText={(v) => updateField("phone", v)}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
            </YStack>

            <YStack>
              <Text style={styles.label}>Nome da Empresa</Text>
              <Input
                value={formData.organizationName}
                onChangeText={(v) => updateField("organizationName", v)}
                placeholder="Minha Empresa LTDA"
                placeholderTextColor="#999"
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
              {errors.organizationName && (
                <Text color="#c62828" fontSize={12} marginTop="$1">{errors.organizationName}</Text>
              )}
            </YStack>

            <YStack>
              <Text style={styles.label}>Senha</Text>
              <Input
                value={formData.password}
                onChangeText={(v) => updateField("password", v)}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#999"
                secureTextEntry
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
              {errors.password && (
                <Text color="#c62828" fontSize={12} marginTop="$1">{errors.password}</Text>
              )}
            </YStack>

            <YStack>
              <Text style={styles.label}>Confirmar Senha</Text>
              <Input
                value={formData.confirmPassword}
                onChangeText={(v) => updateField("confirmPassword", v)}
                placeholder="Confirme sua senha"
                placeholderTextColor="#999"
                secureTextEntry
                size="$4"
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
                borderWidth={1}
                borderRadius={12}
                color="#000"
              />
              {errors.confirmPassword && (
                <Text color="#c62828" fontSize={12} marginTop="$1">{errors.confirmPassword}</Text>
              )}
            </YStack>

            <XStack alignItems="center" gap="$2">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(v) => updateField("acceptTerms", v)}
                backgroundColor="#f8f8f8"
                borderColor="#e0e0e0"
              >
                <Checkbox.Indicator>
                  <Text color={primary}>✓</Text>
                </Checkbox.Indicator>
              </Checkbox>
              <Label htmlFor="terms" fontSize={12} color="#666">
                Li e aceito os Termos de Uso e Política de Privacidade
              </Label>
            </XStack>
            {errors.acceptTerms && (
              <Text color="#c62828" fontSize={12}>{errors.acceptTerms}</Text>
            )}

            {errors.general && (
              <YStack
                backgroundColor="#fde8e8"
                borderRadius={12}
                padding="$3"
                borderWidth={1}
                borderColor="#ef5350"
              >
                <Text color="#c62828" textAlign="center" fontWeight="600" fontSize={13}>
                  {errors.general}
                </Text>
              </YStack>
            )}

            <Button
              onPress={handleRegister}
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
                  Criar Conta
                </Text>
              )}
            </Button>

            <XStack justifyContent="center" marginTop="$4">
              <Text color="#666" fontSize={14}>Já tem conta? </Text>
              <Link href="/(auth)/login" asChild>
                <Text color={primary} fontWeight="700" fontSize={14}>
                  Entrar
                </Text>
              </Link>
            </XStack>
          </YStack>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 140,
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    marginTop: -20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
});
