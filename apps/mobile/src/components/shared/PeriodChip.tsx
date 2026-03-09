import { YStack, Text } from "tamagui";

interface PeriodChipProps {
  label: string;
  value: string;
  active: boolean;
  onPress: (v: any) => void;
  primary: string;
}

export function PeriodChip({ label, value, active, onPress, primary }: PeriodChipProps) {
  return (
    <YStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$3"
      backgroundColor={active ? primary : "$backgroundStrong"}
      pressStyle={{ opacity: 0.7 }}
      onPress={() => onPress(value)}
    >
      <Text fontSize="$2" color={active ? "white" : "$color"} fontWeight={active ? "600" : "400"}>
        {label}
      </Text>
    </YStack>
  );
}
