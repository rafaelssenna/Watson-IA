import { Pressable } from "react-native";
import { XStack, Input } from "tamagui";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isDark: boolean;
}

export function SearchBar({ value, onChangeText, placeholder = "Buscar...", isDark }: SearchBarProps) {
  return (
    <XStack
      backgroundColor={isDark ? "#1e293b" : "#f1f5f9"}
      borderRadius={12}
      paddingHorizontal="$3"
      alignItems="center"
      gap="$2"
    >
      <Ionicons name="search" size={18} color="#94a3b8" />
      <Input
        unstyled
        flex={1}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        fontSize={15}
        color="$color"
        paddingVertical={10}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")}>
          <Ionicons name="close-circle" size={18} color="#94a3b8" />
        </Pressable>
      )}
    </XStack>
  );
}
