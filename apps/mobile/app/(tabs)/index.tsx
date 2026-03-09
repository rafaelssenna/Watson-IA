import { useEffect, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { YStack, XStack, H2, Text, Card, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { watsonColors, trendColors } from "@/theme/colors";

type IoniconsName = keyof typeof Ionicons.glyphMap;

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
  const { primary } = useAppColors();

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
      <YStack gap="$3">
        {/* Main Stats */}
        <XStack flexWrap="wrap" gap="$2">
          <StatCard
            title="Conversas Ativas"
            value={data?.activeConversations || 0}
            icon="chatbubbles-outline"
            color={primary}
          />
          <StatCard
            title="Intencao de Compra"
            value={data?.purchaseIntentCount || 0}
            icon="cart-outline"
            color={watsonColors.success[500]}
          />
          <StatCard
            title="Urgentes"
            value={data?.urgentCount || 0}
            icon="flame-outline"
            color={watsonColors.error[500]}
            highlight={data?.urgentCount ? data.urgentCount > 0 : false}
          />
          <StatCard
            title="Esfriando"
            value={data?.coolingCount || 0}
            icon="snow-outline"
            color={watsonColors.warning[500]}
          />
        </XStack>

        {/* Response Stats */}
        <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$2" color="$color">Metricas de Resposta</H2>
          <XStack gap="$6">
            <YStack>
              <Text color="$gray8" fontSize="$2">Taxa de Resposta</Text>
              <Text fontSize="$7" fontWeight="bold" color={watsonColors.success[500]}>
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
          <Card padding="$3" backgroundColor="$red10" borderRadius="$4">
            <XStack alignItems="center" gap="$3">
              <Ionicons name="warning-outline" size={24} color="white" />
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
        <Card padding="$3" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$2" color="$color">Resumo de Hoje</H2>
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
                <Ionicons
                  name={(data?.conversationTrend ?? 0) >= 0 ? "arrow-up" : "arrow-down"}
                  size={20}
                  color={(data?.conversationTrend ?? 0) >= 0 ? trendColors.up : trendColors.down}
                />
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
  icon: IoniconsName;
  color: string;
  highlight?: boolean;
}) {
  const theme = useTheme();

  return (
    <Card
      flex={1}
      minWidth={150}
      padding="$3"
      backgroundColor={highlight ? "$red10" : "$backgroundStrong"}
      borderRadius="$4"
    >
      <XStack alignItems="center" gap="$2" marginBottom="$1">
        <Ionicons name={icon} size={18} color={highlight ? "white" : color} />
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
