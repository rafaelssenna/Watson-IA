import { useEffect, useState } from "react";
import { Pressable, Switch, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Card, Separator, useTheme } from "tamagui";
import { ScrollView } from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

type IoniconsName = keyof typeof Ionicons.glyphMap;

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

interface RemarketingConfig {
  enabled: boolean;
  totalActive: number;
  steps: { step: number; count: number }[];
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const theme = useTheme();
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        {/* User Card */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack gap="$4" alignItems="center">
            <YStack
              width={60}
              height={60}
              borderRadius={30}
              backgroundColor={WATSON_TEAL}
              alignItems="center"
              justifyContent="center"
            >
              <Text color="white" fontSize="$7" fontWeight="bold">
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </YStack>
            <YStack flex={1}>
              <Text fontSize="$5" fontWeight="bold" color="$color">{user?.name}</Text>
              <Text color="$gray8" fontSize="$3">{user?.email}</Text>
              <Text fontSize="$2" color={WATSON_TEAL} marginTop="$1">
                {user?.organizationName}
              </Text>
            </YStack>
          </XStack>
        </Card>

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
            <SettingsItem
              icon="flash-outline"
              title="Triggers"
              description="Gatilhos inteligentes"
              onPress={() => router.push("/settings/triggers")}
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
                        backgroundColor={WATSON_TEAL}
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
                  <ActivityIndicator size="small" color={WATSON_TEAL} />
                ) : (
                  <Switch
                    value={remarketingConfig?.enabled || false}
                    onValueChange={handleToggleRemarketing}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
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
              badge="Trial"
              badgeColor="$yellow10"
            />
          </Card>
        </YStack>

        {/* Danger Zone */}
        <YStack marginTop="$2">
          <Pressable onPress={handleLogout}>
            <Card
              padding="$4"
              backgroundColor="$red5"
              borderRadius="$4"
            >
              <XStack alignItems="center" justifyContent="center" gap="$2">
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
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

function SettingsItem({
  icon,
  title,
  description,
  badge,
  badgeColor,
  onPress,
}: {
  icon: IoniconsName;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <XStack padding="$4" alignItems="center" gap="$3">
        <Ionicons name={icon} size={24} color={theme.gray8.val} />
        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <Text fontWeight="600" color="$color" fontSize="$4">{title}</Text>
            {badge && (
              <YStack
                backgroundColor={badgeColor || "$blue10"}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius="$2"
              >
                <Text fontSize={10} color="white" fontWeight="600">{badge}</Text>
              </YStack>
            )}
          </XStack>
          <Text fontSize="$2" color="$gray8" marginTop={2}>{description}</Text>
        </YStack>
        <Ionicons name="chevron-forward" size={20} color={theme.gray7.val} />
      </XStack>
    </Pressable>
  );
}
