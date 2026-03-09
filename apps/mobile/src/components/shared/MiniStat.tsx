import { YStack, Text, Card } from "tamagui";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface MiniStatProps {
  label: string;
  value: number | string;
  icon: IoniconsName;
  color: string;
}

export function MiniStat({ label, value, icon, color }: MiniStatProps) {
  return (
    <Card flex={1} minWidth={100} padding="$2" backgroundColor="$backgroundStrong" borderRadius="$3">
      <YStack alignItems="center" gap={2}>
        <Ionicons name={icon} size={14} color={color} />
        <Text fontSize="$5" fontWeight="bold" color={color}>
          {value}
        </Text>
        <Text fontSize={10} color="$gray8" numberOfLines={1}>
          {label}
        </Text>
      </YStack>
    </Card>
  );
}
