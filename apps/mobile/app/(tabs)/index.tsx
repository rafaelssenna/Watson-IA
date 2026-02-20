import { useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { YStack, XStack, H2, Text, Card, useTheme } from "tamagui";
import { api } from "@/services/api";

interface DashboardData {
  activeConversations: number;
  purchaseIntentCount: number;
  urgentCount: number;
  coolingCount: number;
  responseRate: number;
  avgResponseTime: number;
  hotLeadsNotResponded: number;
  todayConversations: number;
  todayMessages: number;
  conversationTrend: number;
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();

  const fetchDashboard = async () => {
    try {
      const response = await api.get<{ success: boolean; data: DashboardData }>(
        "/dashboard/summary"
      );
      setData(response.data.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboard();
  };

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Text color="$color">Carregando...</Text>
      </YStack>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <YStack gap="$4">
        {/* Main Stats */}
        <XStack flexWrap="wrap" gap="$3">
          <StatCard
            title="Conversas Ativas"
            value={data?.activeConversations || 0}
            icon="💬"
            color="$blue10"
          />
          <StatCard
            title="Intencao de Compra"
            value={data?.purchaseIntentCount || 0}
            icon="🛒"
            color="$green10"
          />
          <StatCard
            title="Urgentes"
            value={data?.urgentCount || 0}
            icon="🔥"
            color="$red10"
            highlight={data?.urgentCount ? data.urgentCount > 0 : false}
          />
          <StatCard
            title="Esfriando"
            value={data?.coolingCount || 0}
            icon="❄️"
            color="$yellow10"
          />
        </XStack>

        {/* Response Stats */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$3" color="$color">Metricas de Resposta</H2>
          <XStack gap="$6">
            <YStack>
              <Text color="$gray8" fontSize="$2">Taxa de Resposta</Text>
              <Text fontSize="$7" fontWeight="bold" color="$green10">
                {data?.responseRate || 0}%
              </Text>
            </YStack>
            <YStack>
              <Text color="$gray8" fontSize="$2">Tempo Medio</Text>
              <Text fontSize="$7" fontWeight="bold" color="$color">
                {data?.avgResponseTime || 0}min
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Alerts */}
        {(data?.hotLeadsNotResponded ?? 0) > 0 && (
          <Card padding="$4" backgroundColor="$red10" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <Text fontSize={24}>⚠️</Text>
              <YStack flex={1}>
                <Text color="white" fontWeight="bold">
                  {data?.hotLeadsNotResponded} leads quentes sem resposta
                </Text>
                <Text color="white" opacity={0.8} fontSize="$2">
                  Aguardando ha mais de 30 minutos
                </Text>
              </YStack>
            </XStack>
          </Card>
        )}

        {/* Today's Summary */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$3" color="$color">Resumo de Hoje</H2>
          <XStack justifyContent="space-between">
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color="$color">
                {data?.todayConversations || 0}
              </Text>
              <Text color="$gray8" fontSize="$2">Conversas</Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$8" fontWeight="bold" color="$color">
                {data?.todayMessages || 0}
              </Text>
              <Text color="$gray8" fontSize="$2">Mensagens</Text>
            </YStack>
            <YStack alignItems="center">
              <XStack alignItems="center">
                <Text fontSize="$8" fontWeight="bold" color="$color">
                  {data?.conversationTrend || 0}%
                </Text>
                <Text fontSize="$4" color={(data?.conversationTrend ?? 0) >= 0 ? "$green10" : "$red10"}>
                  {(data?.conversationTrend ?? 0) >= 0 ? "↑" : "↓"}
                </Text>
              </XStack>
              <Text color="$gray8" fontSize="$2">vs Ontem</Text>
            </YStack>
          </XStack>
        </Card>
      </YStack>
    </ScrollView>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  highlight = false,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <Card
      flex={1}
      minWidth={150}
      padding="$4"
      backgroundColor={highlight ? color : "$backgroundStrong"}
      borderRadius="$4"
    >
      <XStack alignItems="center" gap="$2" marginBottom="$2">
        <Text fontSize={18}>{icon}</Text>
        <Text
          fontSize="$2"
          color={highlight ? "white" : "$gray8"}
          numberOfLines={1}
        >
          {title}
        </Text>
      </XStack>
      <Text
        fontSize="$9"
        fontWeight="bold"
        color={highlight ? "white" : color}
      >
        {value}
      </Text>
    </Card>
  );
}
