import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, ScrollView as RNScrollView, Pressable } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { YStack, XStack, Text, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";

interface LeadDetail {
  id: string;
  customerPhone: string;
  customerName: string;
  email: string | null;
  company: string | null;
  funnelStage: { id: string; name: string; color: string } | null;
  messages: { role: "user" | "assistant"; content: string }[];
  messageCount: number;
  score: string;
  scoreLabel: { label: string; color: string };
  confidence: number;
  reasons: string[];
  suggestedAction: string | null;
  lastInteractionAt: string | null;
  createdAt: string;
}

const SCORE_COLORS: Record<string, string> = {
  qualified: "#22c55e",
  interested: "#eab308",
  new_lead: "#3b82f6",
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const theme = useTheme();
  const { primary } = useAppColors();

  useEffect(() => {
    loadLead();
  }, [id]);

  const loadLead = async () => {
    try {
      const response = await api.get<{ success: boolean; data: LeadDetail }>(`/crm/leads/${id}`);
      if (response.data.success) {
        setLead(response.data.data);
      }
    } catch (error) {
      console.error("Error loading lead:", error);
      Alert.alert("Erro", "Nao foi possivel carregar o lead");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReclassify = async () => {
    if (!lead) return;
    setIsReclassifying(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: {
          score: string;
          scoreLabel: { label: string; color: string };
          confidence: number;
          reasons: string[];
          suggestedAction: string | null;
        };
      }>(`/crm/leads/${id}/reclassify`);

      if (response.data.success) {
        setLead({
          ...lead,
          score: response.data.data.score,
          scoreLabel: response.data.data.scoreLabel,
          confidence: response.data.data.confidence,
          reasons: response.data.data.reasons,
          suggestedAction: response.data.data.suggestedAction || null,
        });
      }
    } catch (error) {
      Alert.alert("Erro", "Nao foi possivel reclassificar o lead");
    } finally {
      setIsReclassifying(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Lead" }} />
        <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
          <ActivityIndicator size="large" color={primary} />
          <Text color="$gray8" marginTop="$3">Classificando lead...</Text>
        </YStack>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Stack.Screen options={{ title: "Lead" }} />
        <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
          <Text color="$gray8">Lead nao encontrado</Text>
        </YStack>
      </>
    );
  }

  const scoreColor = SCORE_COLORS[lead.score] || "#6b7280";

  return (
    <>
      <Stack.Screen options={{ title: lead.customerName || "Lead" }} />
      <RNScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <YStack gap="$4">
          {/* Profile Card */}
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack gap="$3" alignItems="center">
              <YStack
                width={60}
                height={60}
                borderRadius={30}
                backgroundColor={scoreColor}
                alignItems="center"
                justifyContent="center"
              >
                <Text color="white" fontSize="$7" fontWeight="bold">
                  {lead.customerName?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </YStack>
              <YStack flex={1} gap={2}>
                <Text fontSize="$6" fontWeight="bold" color="$color">
                  {lead.customerName}
                </Text>
                {lead.customerPhone && (
                  <Text fontSize="$3" color="$gray8">
                    {lead.customerPhone}
                  </Text>
                )}
                {lead.email && (
                  <Text fontSize="$3" color="$gray8">
                    {lead.email}
                  </Text>
                )}
                {lead.company && (
                  <Text fontSize="$2" color="$gray8">
                    {lead.company}
                  </Text>
                )}
              </YStack>
            </XStack>

            {/* Score + Confidence */}
            <XStack marginTop="$3" gap="$3" alignItems="center">
              <XStack
                backgroundColor={`${scoreColor}20`}
                paddingHorizontal={12}
                paddingVertical={6}
                borderRadius={16}
                alignItems="center"
                gap={6}
              >
                <YStack width={10} height={10} borderRadius={5} backgroundColor={scoreColor} />
                <Text fontWeight="600" color={scoreColor}>
                  {lead.scoreLabel?.label || "Novo Lead"}
                </Text>
              </XStack>

              <XStack alignItems="center" gap={4}>
                <Ionicons name="analytics-outline" size={16} color="#94a3b8" />
                <Text fontSize="$3" color="$gray8">
                  Confianca: <Text fontWeight="600" color="$color">{lead.confidence}%</Text>
                </Text>
              </XStack>
            </XStack>

            {/* Funnel Stage */}
            {lead.funnelStage && (
              <XStack marginTop="$2" alignItems="center" gap={6}>
                <YStack width={8} height={8} borderRadius={4} backgroundColor={lead.funnelStage.color} />
                <Text fontSize="$2" color="$gray8">
                  Funil: {lead.funnelStage.name}
                </Text>
              </XStack>
            )}
          </Card>

          {/* Classification Reasons */}
          {lead.reasons.length > 0 && (
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Ionicons name="bulb-outline" size={18} color={primary} />
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Motivos da Classificacao
                </Text>
              </XStack>
              <YStack gap="$2">
                {lead.reasons.map((reason, index) => (
                  <XStack key={index} gap="$2" alignItems="flex-start">
                    <Ionicons name="checkmark-circle" size={16} color={scoreColor} style={{ marginTop: 2 }} />
                    <Text flex={1} fontSize="$3" color="$color">
                      {reason}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            </Card>
          )}

          {/* Suggested Action */}
          {lead.suggestedAction && (
            <Card padding="$4" backgroundColor={`${primary}15`} borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <Ionicons name="flash-outline" size={18} color={primary} />
                <Text fontSize="$4" fontWeight="600" color={primary}>
                  Acao Sugerida
                </Text>
              </XStack>
              <Text fontSize="$3" color="$color">
                {lead.suggestedAction}
              </Text>
            </Card>
          )}

          {/* Reclassify Button */}
          <Pressable onPress={handleReclassify} disabled={isReclassifying}>
            <XStack
              backgroundColor={primary}
              paddingVertical="$3"
              borderRadius="$3"
              alignItems="center"
              justifyContent="center"
              gap="$2"
              opacity={isReclassifying ? 0.6 : 1}
            >
              {isReclassifying ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="refresh" size={18} color="white" />
              )}
              <Text color="white" fontWeight="600">
                {isReclassifying ? "Reclassificando..." : "Reclassificar com IA"}
              </Text>
            </XStack>
          </Pressable>

          {/* Meta Info */}
          <XStack gap="$3">
            <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$3">
              <YStack alignItems="center" gap={2}>
                <Ionicons name="chatbubbles-outline" size={16} color="#94a3b8" />
                <Text fontSize="$5" fontWeight="bold" color="$color">
                  {lead.messageCount}
                </Text>
                <Text fontSize={10} color="$gray8">Mensagens</Text>
              </YStack>
            </Card>
            <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$3">
              <YStack alignItems="center" gap={2}>
                <Ionicons name="time-outline" size={16} color="#94a3b8" />
                <Text fontSize="$5" fontWeight="bold" color="$color">
                  {lead.lastInteractionAt ? formatRelative(lead.lastInteractionAt) : "-"}
                </Text>
                <Text fontSize={10} color="$gray8">Ultima Interacao</Text>
              </YStack>
            </Card>
            <Card flex={1} padding="$3" backgroundColor="$backgroundStrong" borderRadius="$3">
              <YStack alignItems="center" gap={2}>
                <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
                <Text fontSize="$5" fontWeight="bold" color="$color">
                  {formatDate(lead.createdAt)}
                </Text>
                <Text fontSize={10} color="$gray8">Criado em</Text>
              </YStack>
            </Card>
          </XStack>

          {/* Message History */}
          {lead.messages.length > 0 && (
            <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Ionicons name="chatbubbles-outline" size={18} color={primary} />
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Historico de Mensagens
                </Text>
              </XStack>
              <YStack gap="$2">
                {lead.messages.map((msg, index) => (
                  <XStack key={index} gap="$2" alignItems="flex-start">
                    <YStack
                      width={24}
                      height={24}
                      borderRadius={12}
                      backgroundColor={msg.role === "user" ? "#3b82f6" : "#64748b"}
                      alignItems="center"
                      justifyContent="center"
                      marginTop={2}
                    >
                      <Ionicons
                        name={msg.role === "user" ? "person" : "sparkles"}
                        size={12}
                        color="white"
                      />
                    </YStack>
                    <YStack flex={1}>
                      <Text fontSize={11} color="$gray8" marginBottom={2}>
                        {msg.role === "user" ? "Cliente" : "Atendente"}
                      </Text>
                      <Text fontSize="$3" color="$color">
                        {msg.content}
                      </Text>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </Card>
          )}

          {/* Navigate to Contact */}
          <Pressable onPress={() => router.push(`/contact/${lead.id}`)}>
            <XStack
              backgroundColor="$backgroundStrong"
              paddingVertical="$3"
              paddingHorizontal="$4"
              borderRadius="$3"
              alignItems="center"
              justifyContent="center"
              gap="$2"
            >
              <Ionicons name="person-outline" size={18} color={primary} />
              <Text color={primary} fontWeight="600">
                Ver Perfil Completo
              </Text>
            </XStack>
          </Pressable>
        </YStack>
      </RNScrollView>
    </>
  );
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "Agora";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  return `${days}d`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
