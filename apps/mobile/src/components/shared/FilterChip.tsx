import { Pressable } from "react-native";
import { XStack, YStack, Text } from "tamagui";

interface FilterChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
  primary: string;
  dotColor?: string;
}

export function FilterChip({
  label,
  count,
  active = false,
  onPress,
  primary,
  dotColor,
}: FilterChipProps) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={20}
        backgroundColor={active ? primary : "$backgroundStrong"}
        alignItems="center"
        gap="$1"
      >
        {dotColor && !active && (
          <YStack width={8} height={8} borderRadius={4} backgroundColor={dotColor} />
        )}
        <Text
          fontSize="$2"
          color={active ? "white" : "$color"}
          fontWeight={active ? "600" : "400"}
        >
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <YStack
            backgroundColor={active ? "white" : primary}
            paddingHorizontal={6}
            borderRadius={8}
            minWidth={18}
            alignItems="center"
          >
            <Text fontSize={10} color={active ? primary : "white"} fontWeight="bold">
              {count}
            </Text>
          </YStack>
        )}
      </XStack>
    </Pressable>
  );
}
