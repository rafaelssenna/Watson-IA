import { useEffect, useState, useCallback } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { YStack, XStack, Text, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";

const WATSON_TEAL = "#0d9488";

type IoniconsName = keyof typeof Ionicons.glyphMap;

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
      <YStack gap="$4">
        {/* Header */}
        <YStack gap="$3">
          <Text fontSize="$7" fontWeight="bold" color="$color">
            Insights
          </Text>
          <XStack gap="$2">
            <PeriodChip label="Hoje" value="today" active={period === "today"} onPress={setPeriod} />
            <PeriodChip label="7 dias" value="7d" active={period === "7d"} onPress={setPeriod} />
            <PeriodChip label="30 dias" value="30d" active={period === "30d"} onPress={setPeriod} />
          </XStack>
        </YStack>

        {/* Card 1 - Performance IA */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Ionicons name="sparkles-outline" size={18} color={WATSON_TEAL} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Performance da IA
            </Text>
          </XStack>

          <YStack alignItems="center" marginBottom="$4">
            <Text fontSize={48} fontWeight="bold" color={WATSON_TEAL}>
              {data?.aiPercentage || 0}%
            </Text>
            <Text color="$gray8" fontSize="$3">
              das respostas foram automaticas
            </Text>
          </YStack>

          {/* AI vs Human bar */}
          <YStack marginBottom="$3">
            <XStack height={12} borderRadius={6} overflow="hidden" backgroundColor="$gray5">
              <YStack
                height="100%"
                width={`${data?.aiPercentage || 0}%`}
                backgroundColor={WATSON_TEAL}
                borderRadius={6}
              />
            </XStack>
            <XStack justifyContent="space-between" marginTop="$2">
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={WATSON_TEAL} />
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

          <XStack
            padding="$3"
            backgroundColor="$background"
            borderRadius="$3"
            alignItems="center"
            gap="$2"
          >
            <Ionicons name="people-outline" size={16} color="#eab308" />
            <Text fontSize="$2" color="$gray8">
              {data?.transfersToHuman || 0} transferencia(s) para humano
            </Text>
          </XStack>
        </Card>

        {/* Card 2 - Conversas */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Ionicons name="chatbubbles-outline" size={18} color={WATSON_TEAL} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Conversas
            </Text>
          </XStack>
          <XStack flexWrap="wrap" gap="$3">
            <MiniStat
              label="Total"
              value={data?.totalConversations || 0}
              icon="chatbubble-outline"
              color={WATSON_TEAL}
            />
            <MiniStat
              label="Abertas"
              value={data?.openConversations || 0}
              icon="ellipse-outline"
              color="#3b82f6"
            />
            <MiniStat
              label="Resolvidas"
              value={data?.resolvedConversations || 0}
              icon="checkmark-circle-outline"
              color="#22c55e"
            />
            <MiniStat
              label="Fechadas"
              value={data?.closedConversations || 0}
              icon="lock-closed-outline"
              color="#64748b"
            />
          </XStack>
        </Card>

        {/* Card 3 - Velocidade */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Ionicons name="speedometer-outline" size={18} color={WATSON_TEAL} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Velocidade
            </Text>
          </XStack>
          <XStack justifyContent="space-around">
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color="#22c55e">
                {data?.responseRate || 0}%
              </Text>
              <Text fontSize="$2" color="$gray8">
                Taxa de Resposta
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color="$color">
                {data?.avgResponseTime || 0}min
              </Text>
              <Text fontSize="$2" color="$gray8">
                Tempo Medio
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Card 4 - Contatos */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Ionicons name="person-add-outline" size={18} color={WATSON_TEAL} />
            <Text fontSize="$4" fontWeight="600" color="$color">
              Contatos
            </Text>
          </XStack>
          <XStack justifyContent="space-around">
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color={WATSON_TEAL}>
                {data?.newContacts || 0}
              </Text>
              <Text fontSize="$2" color="$gray8">
                Novos no Periodo
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color="$color">
                {data?.totalContacts || 0}
              </Text>
              <Text fontSize="$2" color="$gray8">
                Total
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Card 5 - Horarios de Pico */}
        {(data?.peakHours?.length || 0) > 0 && (
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Ionicons name="time-outline" size={18} color={WATSON_TEAL} />
              <Text fontSize="$4" fontWeight="600" color="$color">
                Horarios de Pico
              </Text>
            </XStack>
            <Text color="$gray8" fontSize="$2" marginBottom="$3">
              Mensagens por hora (ultimas 24h)
            </Text>
            <YStack gap="$2">
              {data!.peakHours.map((h) => (
                <XStack key={h.hour} alignItems="center" gap="$3">
                  <Text width={45} fontSize="$2" color="$gray8">
                    {h.hour}
                  </Text>
                  <YStack
                    flex={1}
                    height={16}
                    backgroundColor="$gray5"
                    borderRadius={8}
                    overflow="hidden"
                  >
                    <YStack
                      height="100%"
                      width={`${Math.max((h.count / maxPeakCount) * 100, 2)}%`}
                      backgroundColor={WATSON_TEAL}
                      borderRadius={8}
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

        {/* Card 6 - Mensagens por Dia */}
        {(data?.messagesPerDay?.length || 0) > 1 && (
          <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Ionicons name="bar-chart-outline" size={18} color={WATSON_TEAL} />
              <Text fontSize="$4" fontWeight="600" color="$color">
                Mensagens por Dia
              </Text>
            </XStack>
            <YStack gap="$2">
              {data!.messagesPerDay.map((d) => {
                const label = formatDayLabel(d.date);
                const total = d.inbound + d.outbound;
                return (
                  <YStack key={d.date} gap="$1">
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
                        backgroundColor="#3b82f6"
                      />
                      <YStack
                        height="100%"
                        width={`${maxDayCount > 0 ? (d.outbound / maxDayCount) * 100 : 0}%`}
                        backgroundColor={WATSON_TEAL}
                      />
                    </XStack>
                  </YStack>
                );
              })}
            </YStack>
            <XStack marginTop="$3" gap="$4">
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor="#3b82f6" />
                <Text fontSize="$1" color="$gray8">
                  Recebidas
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={WATSON_TEAL} />
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

function PeriodChip({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: Period;
  active: boolean;
  onPress: (v: Period) => void;
}) {
  return (
    <YStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$3"
      backgroundColor={active ? WATSON_TEAL : "$backgroundStrong"}
      pressStyle={{ opacity: 0.7 }}
      onPress={() => onPress(value)}
    >
      <Text fontSize="$2" color={active ? "white" : "$color"} fontWeight={active ? "600" : "400"}>
        {label}
      </Text>
    </YStack>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: IoniconsName;
  color: string;
}) {
  return (
    <YStack flex={1} minWidth={140} alignItems="center" padding="$3" gap="$1">
      <Ionicons name={icon} size={16} color={color} />
      <Text fontSize="$7" fontWeight="bold" color="$color">
        {value}
      </Text>
      <Text fontSize="$1" color="$gray8">
        {label}
      </Text>
    </YStack>
  );
}

function formatDayLabel(dateStr: string): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const date = new Date(dateStr + "T12:00:00");
  const day = days[date.getDay()];
  const num = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day} ${num}/${month}`;
}
