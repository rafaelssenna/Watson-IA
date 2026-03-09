import { useEffect, useState } from "react";
import { Pressable, Switch, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Card, Separator, useTheme } from "tamagui";
import { ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/authStore";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { useThemeStore, COLOR_PRESETS } from "@/stores/themeStore";
import { SettingsItem } from "@/components/shared/SettingsItem";
import { watsonColors } from "@/theme/colors";
import * as Haptics from "expo-haptics";

interface RemarketingConfig {
  enabled: boolean;
  totalActive: number;
  steps: { step: number; count: number }[];
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const theme = useTheme();
  const { gradient, primary } = useAppColors();
  const { preset, setPreset } = useThemeStore();
  const [remarketingConfig, setRemarketingConfig] = useState<RemarketingConfig | null>(null);
  const [togglingRemarketing, setTogglingRemarketing] = useState(false);

  useEffect(() => {
    loadRemarketingConfig();
  }, []);

  const loadRemarketingConfig = async () => {
    try {
      const response = await api.get<{ success: boolean; data: RemarketingConfig }>("/automations/remarketing/config");
      if (response.data.success) {
        setRemarketingConfig(response.data.data);
      }
    } catch (error) {
      console.error("Error loading remarketing config:", error);
    }
  };

  const handleToggleRemarketing = async () => {
    if (!remarketingConfig) return;
    const newEnabled = !remarketingConfig.enabled;

    if (!newEnabled && remarketingConfig.totalActive > 0) {
      Alert.alert(
        "Desativar Remarketing?",
        `Existem ${remarketingConfig.totalActive} follow-ups ativos. Todos serao cancelados.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Desativar",
            style: "destructive",
            onPress: () => doToggleRemarketing(newEnabled),
          },
        ]
      );
      return;
    }
    doToggleRemarketing(newEnabled);
  };

  const doToggleRemarketing = async (enabled: boolean) => {
    setTogglingRemarketing(true);
    try {
      await api.patch("/automations/remarketing/config", { enabled });
      setRemarketingConfig((prev) =>
        prev ? { ...prev, enabled, totalActive: enabled ? prev.totalActive : 0 } : null
      );
    } catch (error) {
      Alert.alert("Erro", "Erro ao alterar remarketing");
    } finally {
      setTogglingRemarketing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleSelectPreset = (name: string) => {
    setPreset(name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        {/* User Card with gradient avatar */}
        <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack gap="$3" alignItems="center">
            <YStack width={52} height={52} borderRadius={26} overflow="hidden">
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
              >
                <Text color="white" fontSize="$6" fontWeight="bold">
                  {user?.name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </LinearGradient>
            </YStack>
            <YStack flex={1}>
              <Text fontSize="$5" fontWeight="bold" color="$color">{user?.name}</Text>
              <Text color="$gray8" fontSize="$3">{user?.email}</Text>
              <Text fontSize="$2" color={primary} marginTop="$1">
                {user?.organizationName}
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Appearance */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            APARENCIA
          </Text>
          <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Ionicons name="color-palette-outline" size={20} color={primary} />
              <Text fontSize="$4" fontWeight="600" color="$color">
                Tema de Cores
              </Text>
            </XStack>

            {/* Color preset grid */}
            <XStack flexWrap="wrap" gap="$3" justifyContent="center">
              {Object.values(COLOR_PRESETS).map((p) => (
                <Pressable key={p.name} onPress={() => handleSelectPreset(p.name)}>
                  <YStack alignItems="center" gap="$1">
                    <YStack
                      width={48}
                      height={48}
                      borderRadius={24}
                      overflow="hidden"
                      borderWidth={preset === p.name ? 3 : 0}
                      borderColor="$color"
                    >
                      <LinearGradient
                        colors={p.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
                      >
                        {preset === p.name && (
                          <Ionicons name="checkmark" size={20} color="white" />
                        )}
                      </LinearGradient>
                    </YStack>
                    <Text fontSize={11} color={preset === p.name ? "$color" : "$gray8"} fontWeight={preset === p.name ? "600" : "400"}>
                      {p.label}
                    </Text>
                  </YStack>
                </Pressable>
              ))}
            </XStack>

            {/* Preview bar */}
            <YStack marginTop="$3" height={6} borderRadius={3} overflow="hidden">
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </YStack>
          </Card>
        </YStack>

        {/* Watson Configuration */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            CONFIGURACOES DO WATSON
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="book-outline"
              title="Base de Conhecimento"
              description="PDFs, FAQs e informacoes da empresa"
              onPress={() => router.push("/settings/knowledge-base")}
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="person-circle-outline"
              title="Persona da IA"
              description="Configure a personalidade do Watson"
              onPress={() => router.push("/settings/persona-edit")}
            />
            <Separator backgroundColor="$gray6" />
            <Pressable onPress={() => router.push("/settings/automations")}>
              <XStack padding="$4" alignItems="center" gap="$3">
                <Ionicons name="megaphone-outline" size={24} color={theme.gray8.val} />
                <YStack flex={1}>
                  <XStack alignItems="center" gap="$2">
                    <Text fontWeight="600" color="$color" fontSize="$4">Remarketing</Text>
                    {remarketingConfig?.enabled && remarketingConfig.totalActive > 0 && (
                      <YStack
                        backgroundColor={primary}
                        paddingHorizontal="$2"
                        paddingVertical={2}
                        borderRadius="$2"
                      >
                        <Text fontSize={10} color="white" fontWeight="600">
                          {remarketingConfig.totalActive} ativos
                        </Text>
                      </YStack>
                    )}
                  </XStack>
                  <Text fontSize="$2" color="$gray8" marginTop={2}>
                    Follow-up automatico em 7 etapas com IA
                  </Text>
                </YStack>
                {togglingRemarketing ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Switch
                    value={remarketingConfig?.enabled || false}
                    onValueChange={handleToggleRemarketing}
                    trackColor={{ false: theme.gray6.val, true: primary }}
                  />
                )}
              </XStack>
            </Pressable>
          </Card>
        </YStack>

        {/* WhatsApp */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            WHATSAPP
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="logo-whatsapp"
              title="Conexao WhatsApp"
              description="Status e configuracoes da conexao"
              onPress={() => router.push("/settings/whatsapp")}
            />
            <Separator backgroundColor="$gray6" />
            <SettingsItem
              icon="notifications-outline"
              title="Notificacoes"
              description="Numero e grupo para receber avisos"
              onPress={() => router.push("/settings/notification-group")}
            />
          </Card>
        </YStack>

        {/* Account */}
        <YStack>
          <Text fontSize="$3" fontWeight="600" marginBottom="$3" color="$gray8" letterSpacing={1}>
            CONTA
          </Text>
          <Card backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden">
            <SettingsItem
              icon="card-outline"
              title="Assinatura"
              description="Gerenciar plano e pagamento"
              badge="Teste"
              badgeColor="$yellow10"
            />
          </Card>
        </YStack>

        {/* Danger Zone */}
        <YStack marginTop="$2">
          <Pressable onPress={handleLogout}>
            <Card padding="$3" backgroundColor="$red5" borderRadius="$4">
              <XStack alignItems="center" justifyContent="center" gap="$2">
                <Ionicons name="log-out-outline" size={20} color={watsonColors.error[500]} />
                <Text color="$red10" fontWeight="600" fontSize="$4">Sair da Conta</Text>
              </XStack>
            </Card>
          </Pressable>
        </YStack>

        {/* Version */}
        <Text textAlign="center" color="$gray8" fontSize="$2" marginTop="$4">
          Watson IA v1.0.0
        </Text>
      </YStack>
    </ScrollView>
  );
}
