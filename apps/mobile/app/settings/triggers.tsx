import { useEffect, useState } from "react";
import { Pressable, Alert, ActivityIndicator, Switch } from "react-native";
import { Stack } from "expo-router";
import { YStack, XStack, Text, Card, ScrollView, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface Trigger {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
}

interface TriggerType {
  type: string;
  name: string;
  description: string;
  icon: IoniconsName;
  example: string;
}

const TRIGGER_TYPES: TriggerType[] = [
  {
    type: "KEYWORD",
    name: "Palavra-chave",
    description: "Cliente menciona palavras como \"atendente\", \"humano\", \"falar com alguem\"",
    icon: "text-outline",
    example: "\"Quero falar com um atendente\"",
  },
  {
    type: "URGENCY",
    name: "Urgencia",
    description: "Cliente demonstra urgencia ou emergencia",
    icon: "alert-circle-outline",
    example: "\"Preciso de ajuda urgente!\"",
  },
  {
    type: "SENTIMENT",
    name: "Cliente irritado",
    description: "Cliente demonstra insatisfacao ou frustacao",
    icon: "sad-outline",
    example: "\"Estou muito frustrado com voces\"",
  },
  {
    type: "NEW_CONTACT",
    name: "Novo contato",
    description: "Primeira mensagem de um cliente novo",
    icon: "person-add-outline",
    example: "Qualquer primeira mensagem",
  },
];

export default function TriggersScreen() {
  const theme = useTheme();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    try {
      const response = await api.get<{ success: boolean; data: Trigger[] }>("/triggers");
      setTriggers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching triggers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isTypeEnabled = (type: string): boolean => {
    return triggers.some((t) => t.triggerType === type && t.isActive);
  };

  const getTriggerByType = (type: string): Trigger | undefined => {
    return triggers.find((t) => t.triggerType === type);
  };

  const handleToggle = async (triggerType: TriggerType) => {
    setSaving(triggerType.type);

    const existingTrigger = getTriggerByType(triggerType.type);

    try {
      if (existingTrigger) {
        // Toggle existing trigger
        const response = await api.post<{ success: boolean; data: Trigger }>(
          `/triggers/${existingTrigger.id}/toggle`
        );
        if (response.data.success) {
          setTriggers((prev) =>
            prev.map((t) =>
              t.id === existingTrigger.id ? { ...t, isActive: !t.isActive } : t
            )
          );
        }
      } else {
        // Generate message with AI
        let message = "Ola! Vou transferir voce para um atendente humano. Aguarde um momento.";
        try {
          const msgResponse = await api.post<{ success: boolean; data: { message: string } }>(
            "/personas/generate-message",
            { triggerType: triggerType.type }
          );
          if (msgResponse.data.success && msgResponse.data.data?.message) {
            message = msgResponse.data.data.message;
          }
        } catch {
          // Use default message if AI fails
        }

        // Create new trigger with transfer to human + AI message
        const response = await api.post<{ success: boolean; data: Trigger }>(
          "/triggers",
          {
            name: `Transferir: ${triggerType.name}`,
            triggerType: triggerType.type,
            conditions: triggerType.type === "KEYWORD"
              ? { keywords: ["atendente", "humano", "falar com alguem", "pessoa real"], matchType: "any" }
              : {},
            actions: {
              transferToHuman: true,
              sendMessage: message,
            },
            isActive: true,
          }
        );
        setTriggers((prev) => [...prev, response.data.data]);
      }
    } catch (error: any) {
      console.error("Error toggling trigger:", error);
      Alert.alert("Erro", error?.message || "Nao foi possivel salvar");
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <ActivityIndicator size="large" color={WATSON_TEAL} />
      </YStack>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Chamar Atendente" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Header */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <YStack
                width={48}
                height={48}
                borderRadius={24}
                backgroundColor="$orange5"
                alignItems="center"
                justifyContent="center"
              >
                <Ionicons name="person-outline" size={24} color="#f97316" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Transferir para Humano
                </Text>
                <Text fontSize="$2" color="$gray8" marginTop="$1">
                  Escolha quando a IA deve chamar um atendente automaticamente
                </Text>
              </YStack>
            </XStack>
          </Card>

          {/* Trigger Options */}
          <YStack gap="$3">
            {TRIGGER_TYPES.map((type) => {
              const isEnabled = isTypeEnabled(type.type);
              const isSaving = saving === type.type;

              return (
                <Card
                  key={type.type}
                  padding="$4"
                  backgroundColor={isEnabled ? "$orange3" : "$backgroundStrong"}
                  borderRadius="$4"
                  borderWidth={isEnabled ? 2 : 0}
                  borderColor={isEnabled ? "#f97316" : "transparent"}
                >
                  <XStack alignItems="center" gap="$3">
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={22}
                      backgroundColor={isEnabled ? "$orange5" : "$gray5"}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons
                        name={type.icon}
                        size={22}
                        color={isEnabled ? "#f97316" : theme.gray8.val}
                      />
                    </YStack>

                    <YStack flex={1}>
                      <Text
                        fontSize="$4"
                        fontWeight="600"
                        color={isEnabled ? "#f97316" : "$color"}
                      >
                        {type.name}
                      </Text>
                      <Text fontSize="$2" color="$gray8" marginTop="$1">
                        {type.description}
                      </Text>
                    </YStack>

                    {isSaving ? (
                      <ActivityIndicator size="small" color="#f97316" />
                    ) : (
                      <Switch
                        value={isEnabled}
                        onValueChange={() => handleToggle(type)}
                        trackColor={{ false: theme.gray6.val, true: "#f97316" }}
                        thumbColor="white"
                      />
                    )}
                  </XStack>

                  {/* Example */}
                  <XStack
                    marginTop="$3"
                    paddingTop="$3"
                    borderTopWidth={1}
                    borderTopColor={isEnabled ? "$orange5" : "$gray5"}
                    alignItems="center"
                    gap="$2"
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={14}
                      color={theme.gray7.val}
                    />
                    <Text fontSize="$2" color="$gray7" fontStyle="italic">
                      {type.example}
                    </Text>
                  </XStack>
                </Card>
              );
            })}
          </YStack>

          {/* Info */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <YStack gap="$3">
              <XStack alignItems="flex-start" gap="$2">
                <Ionicons name="chatbubble-outline" size={18} color={WATSON_TEAL} />
                <Text fontSize="$2" color="$gray8" flex={1}>
                  Envia uma mensagem automatica gerada pela IA
                </Text>
              </XStack>
              <XStack alignItems="flex-start" gap="$2">
                <Ionicons name="person-outline" size={18} color="#f97316" />
                <Text fontSize="$2" color="$gray8" flex={1}>
                  Transfere a conversa para atendimento humano
                </Text>
              </XStack>
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  );
}
