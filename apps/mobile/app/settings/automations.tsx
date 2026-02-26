import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, Switch } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

// Watson IA brand colors
const WATSON_TEAL = "#0d9488";

const STEP_LABELS = ["5min", "2h", "8h", "2d", "4d", "7d", "10d"];
const STEP_STRATEGIES = ["Sutil", "Gentil", "Lembrete", "Valor", "Urgencia", "Direto", "Adeus"];

interface RemarketingConfig {
  enabled: boolean;
  totalActive: number;
  steps: { step: number; count: number }[];
}

export default function AutomationsScreen() {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  // Remarketing state
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
    } finally {
      setIsLoading(false);
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
      setRemarketingConfig((prev) => prev ? { ...prev, enabled, totalActive: enabled ? prev.totalActive : 0, steps: enabled ? prev.steps : prev.steps.map((s) => ({ ...s, count: 0 })) } : null);
    } catch (error) {
      Alert.alert("Erro", "Erro ao alterar remarketing");
    } finally {
      setTogglingRemarketing(false);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
        <Text color="$gray8" marginTop="$3">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Remarketing" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Remarketing 7 Etapas Card */}
          {remarketingConfig && (
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <XStack alignItems="center" gap="$2">
                  <Ionicons name="megaphone-outline" size={22} color={WATSON_TEAL} />
                  <YStack>
                    <Text fontSize="$4" fontWeight="700" color="$color">
                      Remarketing 7 Etapas
                    </Text>
                    <Text fontSize="$2" color="$gray8">
                      Follow-up automatico com IA
                    </Text>
                  </YStack>
                </XStack>
                {togglingRemarketing ? (
                  <ActivityIndicator size="small" color={WATSON_TEAL} />
                ) : (
                  <Switch
                    value={remarketingConfig.enabled}
                    onValueChange={handleToggleRemarketing}
                    trackColor={{ false: theme.gray6.val, true: WATSON_TEAL }}
                  />
                )}
              </XStack>

              {remarketingConfig.enabled && (
                <>
                  {/* 7 step circles */}
                  <XStack justifyContent="space-between" marginBottom="$3">
                    {remarketingConfig.steps.map((s, i) => (
                      <YStack key={s.step} alignItems="center" gap={4}>
                        <YStack
                          width={36}
                          height={36}
                          borderRadius={18}
                          backgroundColor={s.count > 0 ? WATSON_TEAL : "$gray4"}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text
                            fontSize="$2"
                            fontWeight="700"
                            color={s.count > 0 ? "white" : "$gray8"}
                          >
                            {s.count}
                          </Text>
                        </YStack>
                        <Text fontSize={10} color="$gray8">{STEP_LABELS[i]}</Text>
                        <Text fontSize={9} color="$gray7">{STEP_STRATEGIES[i]}</Text>
                      </YStack>
                    ))}
                  </XStack>

                  {/* Total active */}
                  <Card padding="$3" backgroundColor="$background" borderRadius="$3">
                    <XStack alignItems="center" justifyContent="space-between">
                      <XStack alignItems="center" gap="$2">
                        <Ionicons name="people-outline" size={18} color={WATSON_TEAL} />
                        <Text fontSize="$3" color="$color">
                          Follow-ups ativos
                        </Text>
                      </XStack>
                      <Text fontSize="$5" fontWeight="700" color={WATSON_TEAL}>
                        {remarketingConfig.totalActive}
                      </Text>
                    </XStack>
                  </Card>

                  {/* How it works */}
                  <XStack alignItems="center" gap="$2" marginTop="$3">
                    <Ionicons name="sparkles" size={14} color={WATSON_TEAL} />
                    <Text fontSize="$2" color="$gray8" flex={1}>
                      A IA le o historico da conversa para continuar no mesmo assunto
                    </Text>
                  </XStack>
                </>
              )}
            </Card>
          )}

          {/* Info Card */}
          <Card padding="$4" backgroundColor="$teal5" borderRadius="$4">
            <XStack gap="$3" alignItems="flex-start">
              <Ionicons name="sync-outline" size={24} color={WATSON_TEAL} />
              <YStack flex={1}>
                <Text color={WATSON_TEAL} fontWeight="600" fontSize="$4">
                  Como funciona?
                </Text>
                <Text color="$color" marginTop="$2" fontSize="$3">
                  Quando o cliente para de responder, o Watson envia mensagens automaticas em 7 etapas progressivas (5min ate 10 dias). A IA le o historico para continuar no mesmo assunto. Se o cliente disser "nao obrigado", o remarketing para automaticamente.
                </Text>
              </YStack>
            </XStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}
