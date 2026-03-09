import { Pressable } from "react-native";
import { XStack, YStack, Text, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface SettingsItemProps {
  icon: IoniconsName;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
  primary?: string;
}

export function SettingsItem({
  icon,
  title,
  description,
  badge,
  badgeColor,
  onPress,
}: SettingsItemProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <XStack padding="$4" alignItems="center" gap="$3">
        <Ionicons name={icon} size={24} color={theme.gray8.val} />
        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <Text fontWeight="600" color="$color" fontSize="$4">{title}</Text>
            {badge && (
              <YStack
                backgroundColor={badgeColor || "$blue10"}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius="$2"
              >
                <Text fontSize={10} color="white" fontWeight="600">{badge}</Text>
              </YStack>
            )}
          </XStack>
          <Text fontSize="$2" color="$gray8" marginTop={2}>{description}</Text>
        </YStack>
        <Ionicons name="chevron-forward" size={20} color={theme.gray7.val} />
      </XStack>
    </Pressable>
  );
}
