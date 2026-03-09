import { useEffect, useState, useCallback } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { YStack, XStack, Text, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { LinearGradient } from "expo-linear-gradient";
import { PeriodChip } from "@/components/shared/PeriodChip";
import { formatDayLabel } from "@/utils/formatters";
import { statusColors, watsonColors } from "@/theme/colors";

interface InsightsData {
  totalOutbound: number;
  aiMessages: number;
  humanMessages: number;
  aiPercentage: number;
  transfersToHuman: number;
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  closedConversations: number;
  avgResponseTime: number;
  responseRate: number;
  newContacts: number;
  totalContacts: number;
  peakHours: Array<{ hour: string; count: number }>;
  messagesPerDay: Array<{ date: string; inbound: number; outbound: number }>;
}

type Period = "today" | "7d" | "30d";

export default function InsightsScreen() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [period, setPeriod] = useState<Period>("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  const { primary, gradient } = useAppColors();

  const fetchInsights = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: InsightsData }>(
        `/dashboard/insights?period=${period}`
      );
      setData(response.data.data);
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setIsLoading(true);
    fetchInsights();
  }, [fetchInsights]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchInsights();
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text color="$gray8">Carregando insights...</Text>
      </YStack>
    );
  }

  const maxPeakCount = Math.max(...(data?.peakHours?.map((h) => h.count) || [1]), 1);
  const maxDayCount = Math.max(
    ...(data?.messagesPerDay?.flatMap((d) => [d.inbound, d.outbound]) || [1]),
    1
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <YStack gap="$3">
        {/* Header */}
        <YStack gap="$2">
          <Text fontSize="$7" fontWeight="bold" color="$color">
            Insights
          </Text>
          <XStack gap="$2">
            <PeriodChip label="Hoje" value="today" active={period === "today"} onPress={setPeriod} primary={primary} />
            <PeriodChip label="7 dias" value="7d" active={period === "7d"} onPress={setPeriod} primary={primary} />
            <PeriodChip label="30 dias" value="30d" active={period === "30d"} onPress={setPeriod} primary={primary} />
          </XStack>
        </YStack>

        {/* Card 1 - Performance IA + Conversas */}
        <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Ionicons name="sparkles-outline" size={18} color={primary} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Performance da IA
            </Text>
          </XStack>

          <YStack alignItems="center" marginBottom="$3">
            <Text fontSize={42} fontWeight="bold" color={primary}>
              {data?.aiPercentage || 0}%
            </Text>
            <Text color="$gray8" fontSize="$2">
              das respostas foram automaticas
            </Text>
          </YStack>

          {/* AI vs Human bar */}
          <YStack marginBottom="$2">
            <XStack height={10} borderRadius={5} overflow="hidden" backgroundColor="$gray5">
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: "100%",
                  width: `${data?.aiPercentage || 0}%`,
                  borderRadius: 5,
                }}
              />
            </XStack>
            <XStack justifyContent="space-between" marginTop="$1">
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={primary} />
                <Text fontSize="$2" color="$gray8">
                  IA: {data?.aiMessages || 0}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor="$gray5" />
                <Text fontSize="$2" color="$gray8">
                  Humano: {data?.humanMessages || 0}
                </Text>
              </XStack>
            </XStack>
          </YStack>

          {/* Conversations summary inline */}
          <XStack justifyContent="space-between" padding="$2" backgroundColor="$background" borderRadius="$3">
            <YStack alignItems="center" flex={1}>
              <Text fontSize="$4" fontWeight="bold" color="$color">{data?.totalConversations || 0}</Text>
              <Text fontSize={10} color="$gray8">Total</Text>
            </YStack>
            <YStack alignItems="center" flex={1}>
              <Text fontSize="$4" fontWeight="bold" color={statusColors.blue}>{data?.openConversations || 0}</Text>
              <Text fontSize={10} color="$gray8">Abertas</Text>
            </YStack>
            <YStack alignItems="center" flex={1}>
              <Text fontSize="$4" fontWeight="bold" color={statusColors.qualified}>{data?.resolvedConversations || 0}</Text>
              <Text fontSize={10} color="$gray8">Resolvidas</Text>
            </YStack>
            <YStack alignItems="center" flex={1}>
              <Text fontSize="$4" fontWeight="bold" color={watsonColors.gray[500]}>{data?.closedConversations || 0}</Text>
              <Text fontSize={10} color="$gray8">Fechadas</Text>
            </YStack>
          </XStack>

          <XStack
            padding="$2"
            marginTop="$2"
            backgroundColor="$background"
            borderRadius="$3"
            alignItems="center"
            gap="$2"
          >
            <Ionicons name="people-outline" size={14} color={watsonColors.warning[500]} />
            <Text fontSize="$2" color="$gray8">
              {data?.transfersToHuman || 0} transferencia(s) para humano
            </Text>
          </XStack>
        </Card>

        {/* Card 2 - Velocidade + Contatos */}
        <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Ionicons name="speedometer-outline" size={18} color={primary} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Metricas
            </Text>
          </XStack>
          <XStack justifyContent="space-around" marginBottom="$3">
            <YStack alignItems="center">
              <Text fontSize="$7" fontWeight="bold" color={watsonColors.success[500]}>
                {data?.responseRate || 0}%
              </Text>
              <Text fontSize="$2" color="$gray8">
                Taxa de Resposta
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$7" fontWeight="bold" color="$color">
                {data?.avgResponseTime || 0}min
              </Text>
              <Text fontSize="$2" color="$gray8">
                Tempo Medio
              </Text>
            </YStack>
          </XStack>
          <XStack justifyContent="space-around" padding="$2" backgroundColor="$background" borderRadius="$3">
            <YStack alignItems="center">
              <Text fontSize="$5" fontWeight="bold" color={primary}>
                {data?.newContacts || 0}
              </Text>
              <Text fontSize="$2" color="$gray8">
                Novos Contatos
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$5" fontWeight="bold" color="$color">
                {data?.totalContacts || 0}
              </Text>
              <Text fontSize="$2" color="$gray8">
                Total Contatos
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Card 3 - Horarios de Pico */}
        {(data?.peakHours?.length || 0) > 0 && (
          <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <Ionicons name="time-outline" size={18} color={primary} />
              <Text fontSize="$4" fontWeight="600" color="$color">
                Horarios de Pico
              </Text>
            </XStack>
            <Text color="$gray8" fontSize="$2" marginBottom="$2">
              Mensagens por hora (ultimas 24h)
            </Text>
            <YStack gap="$1">
              {data!.peakHours.map((h) => (
                <XStack key={h.hour} alignItems="center" gap="$2">
                  <Text width={45} fontSize="$2" color="$gray8">
                    {h.hour}
                  </Text>
                  <YStack
                    flex={1}
                    height={14}
                    backgroundColor="$gray5"
                    borderRadius={7}
                    overflow="hidden"
                  >
                    <YStack
                      height="100%"
                      width={`${Math.max((h.count / maxPeakCount) * 100, 2)}%`}
                      backgroundColor={primary}
                      borderRadius={7}
                    />
                  </YStack>
                  <Text width={35} fontSize="$2" textAlign="right" color="$color" fontWeight="600">
                    {h.count}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </Card>
        )}

        {/* Card 4 - Mensagens por Dia */}
        {(data?.messagesPerDay?.length || 0) > 1 && (
          <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <Ionicons name="bar-chart-outline" size={18} color={primary} />
              <Text fontSize="$4" fontWeight="600" color="$color">
                Mensagens por Dia
              </Text>
            </XStack>
            <YStack gap="$1">
              {data!.messagesPerDay.map((d) => {
                const label = formatDayLabel(d.date);
                const total = d.inbound + d.outbound;
                return (
                  <YStack key={d.date} gap={2}>
                    <XStack justifyContent="space-between">
                      <Text fontSize="$2" color="$gray8">
                        {label}
                      </Text>
                      <Text fontSize="$2" color="$color" fontWeight="600">
                        {total}
                      </Text>
                    </XStack>
                    <XStack height={10} borderRadius={5} overflow="hidden" backgroundColor="$gray5">
                      <YStack
                        height="100%"
                        width={`${maxDayCount > 0 ? (d.inbound / maxDayCount) * 100 : 0}%`}
                        backgroundColor={statusColors.blue}
                      />
                      <YStack
                        height="100%"
                        width={`${maxDayCount > 0 ? (d.outbound / maxDayCount) * 100 : 0}%`}
                        backgroundColor={primary}
                      />
                    </XStack>
                  </YStack>
                );
              })}
            </YStack>
            <XStack marginTop="$2" gap="$4">
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={statusColors.blue} />
                <Text fontSize="$1" color="$gray8">
                  Recebidas
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={primary} />
                <Text fontSize="$1" color="$gray8">
                  Enviadas
                </Text>
              </XStack>
            </XStack>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
