import { YStack, XStack, H2, Text, Card, useTheme } from "tamagui";
import { ScrollView } from "react-native";

export default function InsightsScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <YStack gap="$4">
        <Text fontSize="$6" fontWeight="bold" color="$color">Relatorios</Text>
        <Text color="$gray8" marginBottom="$4">
          Analise detalhada do desempenho do Watson AI
        </Text>

        {/* Period Selector */}
        <XStack gap="$2">
          <PeriodChip label="Hoje" active />
          <PeriodChip label="7 dias" />
          <PeriodChip label="30 dias" />
          <PeriodChip label="Custom" />
        </XStack>

        {/* Conversion Metrics */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$4" color="$color">Taxa de Conversao</H2>
          <YStack alignItems="center">
            <Text fontSize={60} fontWeight="bold" color="$green10">
              12.5%
            </Text>
            <Text color="$gray8">+2.3% vs periodo anterior</Text>
          </YStack>
          <XStack marginTop="$4" justifyContent="space-around">
            <MetricItem label="Leads" value="150" />
            <MetricItem label="Qualificados" value="45" />
            <MetricItem label="Convertidos" value="19" />
          </XStack>
        </Card>

        {/* Response Metrics */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$4" color="$color">Metricas de Resposta</H2>
          <XStack justifyContent="space-around">
            <MetricItem label="Taxa de Resposta" value="94%" color="$green10" />
            <MetricItem label="Tempo Medio" value="3min" />
            <MetricItem label="Respostas/Dia" value="127" />
          </XStack>
        </Card>

        {/* AI Performance */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$4" color="$color">Performance Watson AI</H2>
          <XStack justifyContent="space-around">
            <MetricItem label="Auto-Respostas" value="78%" />
            <MetricItem label="Sugeridas" value="18%" />
            <MetricItem label="Escaladas" value="4%" />
          </XStack>
          <YStack marginTop="$4" padding="$3" backgroundColor="$gray5" borderRadius="$3">
            <Text fontSize="$2" color="$gray8">
              Watson respondeu automaticamente 78% das mensagens com uma taxa de aprovacao de 92%.
            </Text>
          </YStack>
        </Card>

        {/* Top Products */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$4" color="$color">Produtos Mais Perguntados</H2>
          <YStack gap="$3">
            <ProductItem rank={1} name="Produto A" count={45} />
            <ProductItem rank={2} name="Produto B" count={32} />
            <ProductItem rank={3} name="Produto C" count={28} />
            <ProductItem rank={4} name="Servico X" count={21} />
            <ProductItem rank={5} name="Servico Y" count={15} />
          </YStack>
        </Card>

        {/* Peak Hours */}
        <Card padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
          <H2 fontSize="$5" marginBottom="$4" color="$color">Horarios de Pico</H2>
          <Text color="$gray8" marginBottom="$3">
            Maior volume de mensagens
          </Text>
          <YStack gap="$2">
            <HourBar hour="09:00" percentage={45} />
            <HourBar hour="10:00" percentage={62} />
            <HourBar hour="11:00" percentage={78} />
            <HourBar hour="14:00" percentage={85} />
            <HourBar hour="15:00" percentage={70} />
            <HourBar hour="16:00" percentage={55} />
          </YStack>
        </Card>
      </YStack>
    </ScrollView>
  );
}

function PeriodChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <YStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$3"
      backgroundColor={active ? "$blue10" : "$backgroundStrong"}
    >
      <Text
        fontSize="$2"
        color={active ? "white" : "$color"}
        fontWeight={active ? "600" : "400"}
      >
        {label}
      </Text>
    </YStack>
  );
}

function MetricItem({
  label,
  value,
  color = "$color",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <YStack alignItems="center">
      <Text fontSize="$7" fontWeight="bold" color={color}>
        {value}
      </Text>
      <Text fontSize="$2" color="$gray8">
        {label}
      </Text>
    </YStack>
  );
}

function ProductItem({
  rank,
  name,
  count,
}: {
  rank: number;
  name: string;
  count: number;
}) {
  return (
    <XStack alignItems="center" gap="$3">
      <YStack
        width={24}
        height={24}
        borderRadius={12}
        backgroundColor={rank <= 3 ? "$blue10" : "$gray5"}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="$1" color={rank <= 3 ? "white" : "$color"} fontWeight="600">
          {rank}
        </Text>
      </YStack>
      <Text flex={1} color="$color">{name}</Text>
      <Text color="$gray8">{count} perguntas</Text>
    </XStack>
  );
}

function HourBar({ hour, percentage }: { hour: string; percentage: number }) {
  return (
    <XStack alignItems="center" gap="$3">
      <Text width={50} fontSize="$2" color="$gray8">{hour}</Text>
      <YStack flex={1} height={20} backgroundColor="$gray5" borderRadius="$2" overflow="hidden">
        <YStack
          height="100%"
          width={`${percentage}%`}
          backgroundColor="$blue10"
          borderRadius="$2"
        />
      </YStack>
      <Text width={40} fontSize="$2" textAlign="right" color="$color">{percentage}%</Text>
    </XStack>
  );
}
